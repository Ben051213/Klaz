import { NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { processLessonPlan } from "@/lib/anthropic"

export const runtime = "nodejs"

// Tutor centres upload lesson plans as PDFs. Cap at 10MB so a single upload
// can't blow up the serverless function's memory. Claude supports PDF
// documents up to 32MB/100 pages, but 10MB is more than enough for a
// typical lesson plan and keeps us well inside Vercel limits.
const MAX_PDF_BYTES = 10 * 1024 * 1024

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Two supported content types:
  //   application/json       — { class_id, title, lesson_plan? }
  //   multipart/form-data    — class_id, title, lesson_plan?, lesson_plan_pdf?
  const contentType = request.headers.get("content-type") || ""
  let class_id: string | undefined
  let title: string | undefined
  let lesson_plan: string | undefined
  let pdfBase64: string | null = null
  let pdfFilename: string | null = null

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData()
    class_id = (form.get("class_id") as string | null) ?? undefined
    title = (form.get("title") as string | null) ?? undefined
    const lp = form.get("lesson_plan")
    lesson_plan = typeof lp === "string" && lp.trim() ? lp : undefined
    const file = form.get("lesson_plan_pdf")
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_PDF_BYTES) {
        return NextResponse.json(
          { error: "PDF is larger than 10MB — please upload a smaller file." },
          { status: 413 }
        )
      }
      if (file.type && file.type !== "application/pdf") {
        return NextResponse.json(
          { error: "Lesson plan upload must be a PDF." },
          { status: 400 }
        )
      }
      const bytes = Buffer.from(await file.arrayBuffer())
      pdfBase64 = bytes.toString("base64")
      pdfFilename = file.name || null
    }
  } else {
    const body = await request.json()
    const parsed = body as {
      class_id?: string
      title?: string
      lesson_plan?: string
    }
    class_id = parsed.class_id
    title = parsed.title
    lesson_plan = parsed.lesson_plan
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

  // PDF wins over pasted text if both are present — teachers upload the
  // authoritative file and the text field often ends up as scratch notes.
  let ai_context: string | null = null
  let storedPlan: string | null = lesson_plan?.trim() ? lesson_plan.trim() : null
  if (pdfBase64) {
    ai_context = await processLessonPlan({ kind: "pdf", base64: pdfBase64 })
    // Record that a PDF was uploaded so the dashboard can display it,
    // even though we're not persisting the binary itself.
    storedPlan = `[PDF uploaded${pdfFilename ? `: ${pdfFilename}` : ""}]${
      storedPlan ? `\n\n${storedPlan}` : ""
    }`
  } else if (storedPlan) {
    ai_context = await processLessonPlan({ kind: "text", text: storedPlan })
  }

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      class_id,
      teacher_id: user.id,
      title,
      lesson_plan: storedPlan,
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
