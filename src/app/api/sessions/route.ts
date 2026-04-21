import { NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { processLessonPlan } from "@/lib/anthropic"

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { class_id, title, lesson_plan } = body as {
    class_id?: string
    title?: string
    lesson_plan?: string
  }
  if (!class_id || !title) {
    return NextResponse.json(
      { error: "class_id and title are required" },
      { status: 400 }
    )
  }

  const { data: klass } = await supabase
    .from("classes")
    .select("id, teacher_id")
    .eq("id", class_id)
    .single()
  if (!klass || klass.teacher_id !== user.id) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 })
  }

  let ai_context: string | null = null
  if (lesson_plan && lesson_plan.trim().length > 0) {
    ai_context = await processLessonPlan(lesson_plan.trim())
  }

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      class_id,
      teacher_id: user.id,
      title,
      lesson_plan: lesson_plan ?? null,
      ai_context,
      status: "active",
    })
    .select()
    .single()
  if (error || !session) {
    return NextResponse.json(
      { error: error?.message || "Could not start session" },
      { status: 500 }
    )
  }

  // Broadcast session_started over a service-role channel so
  // students subscribed to `class-{class_id}` see it instantly.
  try {
    const service = createServiceClient()
    const channel = service.channel(`class-${class_id}`)
    await channel.subscribe()
    await channel.send({
      type: "broadcast",
      event: "session_started",
      payload: { id: session.id, title: session.title, class_id },
    })
    await service.removeChannel(channel)
  } catch {
    // Non-fatal — the page will also pick up active session on next reload
  }

  return NextResponse.json({ session })
}
