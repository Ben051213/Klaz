import { NextResponse } from "next/server"
import { anthropic } from "@/lib/anthropic"
import { createClient } from "@/lib/supabase/server"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { studentId } = (await request.json()) as { studentId?: string }
  if (!studentId) {
    return NextResponse.json({ error: "studentId required" }, { status: 400 })
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("id, class_id, classes(teacher_id)")
    .eq("id", sessionId)
    .single()
  type S = { id: string; class_id: string; classes: { teacher_id: string } | null }
  const s = session as S | null
  if (!s || s.classes?.teacher_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data: messages } = await supabase
    .from("messages")
    .select("student_text, ai_response, confidence_signal, topics")
    .eq("session_id", sessionId)
    .eq("student_id", studentId)
    .order("created_at", { ascending: true })

  if (!messages || messages.length === 0) {
    return NextResponse.json({ summary: "No questions asked yet." })
  }

  const transcript = messages
    .map(
      (m) =>
        `Student: ${m.student_text}\nAI: ${(m.ai_response ?? "").substring(
          0,
          300
        )}\nSignal: ${m.confidence_signal ?? "unknown"}`
    )
    .join("\n\n")

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 250,
      messages: [
        {
          role: "user",
          content: `Write a 2-3 sentence summary for a teacher about one student's session. Focus on what they understood well and where they struggled. Be direct and specific.\n\n${transcript}`,
        },
      ],
    })
    const summary =
      response.content[0].type === "text"
        ? response.content[0].text.trim()
        : "Summary unavailable."
    return NextResponse.json({ summary })
  } catch {
    return NextResponse.json({ summary: "Summary unavailable." })
  }
}
