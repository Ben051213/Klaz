import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Teacher's private notes on a student within a class.
// RLS on class_student_notes already restricts writes to the class's
// own teacher via is_teacher_of_class — we can use the regular client.

export async function PUT(
  request: Request,
  {
    params,
  }: { params: Promise<{ classId: string; studentId: string }> }
) {
  const { classId, studentId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as { note?: string }
  const note = (body.note ?? "").trim()

  if (note.length === 0) {
    // Empty note → delete the row so listing pages stay clean.
    const { error } = await supabase
      .from("class_student_notes")
      .delete()
      .eq("class_id", classId)
      .eq("student_id", studentId)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, note: "" })
  }

  const { error } = await supabase.from("class_student_notes").upsert(
    {
      class_id: classId,
      student_id: studentId,
      note,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "class_id,student_id" }
  )
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, note })
}
