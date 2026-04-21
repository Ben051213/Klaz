import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const rawCode = body?.join_code
  if (typeof rawCode !== "string" || rawCode.trim().length < 3) {
    return NextResponse.json({ error: "Enter a valid code" }, { status: 400 })
  }
  const join_code = rawCode.trim().toUpperCase()

  const { data: klass, error: findError } = await supabase
    .from("classes")
    .select("id, teacher_id, name, subject, grade, join_code, is_active, created_at")
    .eq("join_code", join_code)
    .maybeSingle()

  if (findError) {
    return NextResponse.json({ error: findError.message }, { status: 500 })
  }
  if (!klass) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 })
  }

  const { data: existing } = await supabase
    .from("class_enrollments")
    .select("id")
    .eq("class_id", klass.id)
    .eq("student_id", user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: "Already enrolled" }, { status: 409 })
  }

  const { error: insertError } = await supabase
    .from("class_enrollments")
    .insert({ class_id: klass.id, student_id: user.id })
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ class: klass })
}
