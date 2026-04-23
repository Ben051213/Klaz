import { NextResponse } from "next/server"
import { processLessonPlan } from "@/lib/anthropic"
import { createClient } from "@/lib/supabase/server"

// POST /api/classes/:classId/materials — teacher creates a new material row.
//
// Two content types supported:
//   application/json       — { title, content, kind }
//   multipart/form-data    — title, kind, plus a `file` field (PDF)
//
// The PDF path funnels through processLessonPlan() to produce a
// structured text extract that lives in `content`; we don't persist
// the binary itself (keeps Supabase storage out of scope).
//
// RLS already restricts inserts to the class teacher, but we check
// ownership here to return a clean 403 rather than a cryptic RLS
// error. We also explicitly bump runtime to node so PDF base64 work
// doesn't choke on Edge.

export const runtime = "nodejs"

// Lesson plans are rarely huge — 10MB fits every sane PDF and keeps us
// well inside the serverless function budget.
const MAX_PDF_BYTES = 10 * 1024 * 1024

type Kind = "notes" | "syllabus" | "lesson"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  const { classId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: klass } = await supabase
    .from("classes")
    .select("teacher_id")
    .eq("id", classId)
    .single()
  if (!klass || klass.teacher_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const contentType = request.headers.get("content-type") || ""

  let title: string | undefined
  let content: string | undefined
  let kind: string | undefined

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData()
    title = (form.get("title") as string | null) ?? undefined
    kind = (form.get("kind") as string | null) ?? undefined

    const file = form.get("file")
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "Attach a PDF under the `file` field." },
        { status: 400 }
      )
    }
    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json(
        { error: "PDF is larger than 10MB — upload a smaller file." },
        { status: 413 }
      )
    }
    if (file.type && file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF uploads are supported." },
        { status: 400 }
      )
    }
    const bytes = Buffer.from(await file.arrayBuffer())
    const base64 = bytes.toString("base64")

    // Fall back to the filename if the teacher didn't set a title.
    if (!title?.trim()) {
      title = file.name?.replace(/\.pdf$/i, "") ?? "Uploaded PDF"
    }

    const extract = await processLessonPlan({ kind: "pdf", base64 })
    content = `[Uploaded PDF: ${file.name ?? "lesson.pdf"}]\n\n${extract}`
    // Default kind for PDFs to "lesson" — teachers upload lesson plans
    // far more often than loose notes.
    if (!kind) kind = "lesson"
  } else {
    const body = await request.json().catch(() => null)
    const parsed = (body ?? {}) as {
      title?: string
      content?: string
      kind?: string
    }
    title = parsed.title
    content = parsed.content
    kind = parsed.kind
  }

  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json(
      { error: "title and content are required" },
      { status: 400 }
    )
  }
  const resolvedKind: Kind =
    kind === "syllabus" || kind === "lesson" ? (kind as Kind) : "notes"

  const { data, error } = await supabase
    .from("class_materials")
    .insert({
      class_id: classId,
      title: title.trim(),
      content: content.trim(),
      kind: resolvedKind,
    })
    .select()
    .single()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ material: data })
}
