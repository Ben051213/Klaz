import { NextResponse } from "next/server"
import { anthropic, buildSystemPrompt, tagMessage } from "@/lib/anthropic"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
// Sonnet streaming + post-stream Haiku tagging + score upserts can run past
// the 10s Hobby default, especially on slower cold starts. 60s gives head-
// room while still failing loudly if something is truly stuck.
export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { message, session_id } = body as {
    message?: string
    session_id?: string
  }
  if (!message || !session_id) {
    return NextResponse.json(
      { error: "message and session_id are required" },
      { status: 400 }
    )
  }

  const { data: session } = await supabase
    .from("sessions")
    .select(
      "id, title, ai_context, class_id, status, classes(subject, grade, teacher_id, profiles:profiles!classes_teacher_id_fkey(name))"
    )
    .eq("id", session_id)
    .single()

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }
  if (session.status !== "active") {
    return NextResponse.json({ error: "Session has ended" }, { status: 400 })
  }

  const { data: enrollment } = await supabase
    .from("class_enrollments")
    .select("id")
    .eq("class_id", session.class_id)
    .eq("student_id", user.id)
    .maybeSingle()
  if (!enrollment) {
    return NextResponse.json({ error: "Not enrolled" }, { status: 403 })
  }

  const { data: insertedMessage, error: insertError } = await supabase
    .from("messages")
    .insert({
      session_id,
      student_id: user.id,
      student_text: message,
    })
    .select()
    .single()
  if (insertError || !insertedMessage) {
    return NextResponse.json(
      { error: insertError?.message || "Could not save message" },
      { status: 500 }
    )
  }

  const { data: priorMessages } = await supabase
    .from("messages")
    .select("student_text, ai_response")
    .eq("session_id", session_id)
    .eq("student_id", user.id)
    .order("created_at", { ascending: true })
    .limit(20)

  const history: { role: "user" | "assistant"; content: string }[] = []
  for (const m of priorMessages ?? []) {
    if (m.student_text && m.ai_response) {
      history.push({ role: "user", content: m.student_text })
      history.push({ role: "assistant", content: m.ai_response })
    }
  }
  history.push({ role: "user", content: message })

  type SessionShape = {
    title: string
    ai_context?: string | null
    classes?: {
      subject: string
      grade?: string | null
      profiles?: { name: string } | null
    } | null
  }
  const normalizeSession = (raw: unknown): SessionShape => {
    const r = raw as {
      title: string
      ai_context?: string | null
      classes?:
        | {
            subject: string
            grade?: string | null
            profiles?: { name: string } | { name: string }[] | null
          }
        | { subject: string; grade?: string | null; profiles?: { name: string } | { name: string }[] | null }[]
        | null
    }
    const c = Array.isArray(r.classes) ? r.classes[0] : r.classes
    const p = c
      ? Array.isArray(c.profiles)
        ? c.profiles[0]
        : c.profiles
      : null
    return {
      title: r.title,
      ai_context: r.ai_context,
      classes: c
        ? { subject: c.subject, grade: c.grade, profiles: p ?? null }
        : null,
    }
  }
  const systemPrompt = buildSystemPrompt(normalizeSession(session))

  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages: history,
  })

  const { data: sessionTopicsRow } = await supabase
    .from("student_topic_scores")
    .select("topic")
    .eq("class_id", session.class_id)
  const sessionTopics = (sessionTopicsRow ?? []).map((t) => t.topic)

  const encoder = new TextEncoder()
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      let fullText = ""
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const chunk = event.delta.text
            fullText += chunk
            controller.enqueue(encoder.encode(chunk))
          }
        }
      } catch (err) {
        controller.error(err)
        return
      }

      // Persist the AI response and run tagging BEFORE closing the stream.
      // The earlier version ran this after controller.close() — which on
      // Vercel means the serverless function could be torn down the moment
      // the response body completes, so tagging silently never ran (no
      // scores, no heatmap, no "[tagMessage]" log lines). Keeping the
      // controller open here holds the function alive while tagging finishes.
      // The client has already received every text chunk; they just wait a
      // few extra hundred ms for fetch() to resolve.
      console.log("[chat] stream complete, starting persist+tag", {
        messageId: insertedMessage.id,
        textLen: fullText.length,
      })
      try {
        const sb = await createClient()
        await sb
          .from("messages")
          .update({ ai_response: fullText })
          .eq("id", insertedMessage.id)
        const normalized = normalizeSession(session)
        await tagMessage({
          studentText: message,
          aiResponse: fullText,
          sessionTitle: normalized.title ?? null,
          sessionTopics,
          lessonSummary: normalized.ai_context ?? null,
          grade: normalized.classes?.grade ?? null,
          subject: normalized.classes?.subject ?? null,
          messageId: insertedMessage.id,
          studentId: user.id,
          classId: session.class_id,
        })
        console.log("[chat] persist+tag done", { messageId: insertedMessage.id })
      } catch (err) {
        console.error("[chat] persist+tag failed", err)
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  })
}
