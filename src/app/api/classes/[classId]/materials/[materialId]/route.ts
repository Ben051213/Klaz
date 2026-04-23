import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// PATCH /api/classes/:classId/materials/:materialId — update title/content/kind
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ classId: string; materialId: string }> }
) {
  const { classId, materialId } = await params
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
  const updates: Record<string, string> = { updated_at: new Date().toISOString() }
  if (typeof title === "string" && title.trim()) updates.title = title.trim()
  if (typeof content === "string" && content.trim())
    updates.content = content.trim()
  if (kind === "notes" || kind === "syllabus" || kind === "lesson")
    updates.kind = kind

  const { data, error } = await supabase
    .from("class_materials")
    .update(updates)
    .eq("id", materialId)
    .eq("class_id", classId)
    .select()
    .single()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ material: data })
}

// DELETE /api/classes/:classId/materials/:materialId — remove a material.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ classId: string; materialId: string }> }
) {
  const { classId, materialId } = await params
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

  const { error } = await supabase
    .from("class_materials")
    .delete()
    .eq("id", materialId)
    .eq("class_id", classId)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
