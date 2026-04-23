import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// POST /api/classes/:classId/materials — teacher creates a new material row.
// RLS guarantees only the class teacher can insert, but we also hard-check
// ownership here so we can return a clean 403 instead of a cryptic RLS error.
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

  const body = await request.json().catch(() => null)
  const { title, content, kind } = (body ?? {}) as {
    title?: string
    content?: string
    kind?: string
  }
  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json(
      { error: "title and content are required" },
      { status: 400 }
    )
  }
  const resolvedKind =
    kind === "syllabus" || kind === "lesson" ? kind : "notes"

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
