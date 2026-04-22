import { NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

// Teacher removes a student from a class. Cascades are handled by the
// database (class_enrollments has no incoming FKs from messages/scores —
// those stay behind as historical record, which is what the teacher wants
// for past-session review).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ classId: string; studentId: string }> }
) {
  const { classId, studentId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Authorization: only the class's own teacher can remove a student.
  const { data: klass } = await supabase
    .from("classes")
    .select("teacher_id")
    .eq("id", classId)
    .single()
  if (!klass || klass.teacher_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // class_enrollments RLS only lets the STUDENT manage their own row
  // (via "student manages own enrollment"); the teacher has SELECT but
  // not DELETE. We've already verified teacher ownership of the class
  // above, so using the service client is safe here.
  const service = createServiceClient()
  const { error } = await service
    .from("class_enrollments")
    .delete()
    .eq("class_id", classId)
    .eq("student_id", studentId)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
