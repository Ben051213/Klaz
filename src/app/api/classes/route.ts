import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateJoinCode } from "@/lib/utils"

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { name, subject, grade } = body as {
    name?: string
    subject?: string
    grade?: string
  }
  if (!name || !subject) {
    return NextResponse.json(
      { error: "Name and subject are required" },
      { status: 400 }
    )
  }

  // Retry a few times in case of join_code collision (very rare)
  for (let attempt = 0; attempt < 5; attempt++) {
    const join_code = generateJoinCode()
    const { data, error } = await supabase
      .from("classes")
      .insert({
        teacher_id: user.id,
        name,
        subject,
        grade: grade ?? null,
        join_code,
      })
      .select()
      .single()
    if (!error && data) {
      return NextResponse.json({ class: data })
    }
    if (error && !error.message.toLowerCase().includes("duplicate")) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }
  return NextResponse.json(
    { error: "Could not generate a unique join code" },
    { status: 500 }
  )
}
