import { NextResponse } from "next/server"
import { generatePracticeForSession } from "@/lib/practice"
import { createClient } from "@/lib/supabase/server"

// Haiku calls for a full class take longer than the 10s Hobby default.
export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { session_id } = body as { session_id?: string }
  if (!session_id) {
    return NextResponse.json({ error: "session_id required" }, { status: 400 })
  }

  // Auth check: only the class's teacher can trigger generation.
  const { data: session } = await supabase
    .from("sessions")
    .select("id, classes(teacher_id)")
    .eq("id", session_id)
    .single()
  type S = {
    id: string
    classes:
      | { teacher_id: string }
      | { teacher_id: string }[]
      | null
  }
  const s = session as S | null
  const classesRel = Array.isArray(s?.classes) ? s?.classes[0] : s?.classes
  if (!s || classesRel?.teacher_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const result = await generatePracticeForSession(session_id)
  return NextResponse.json(result)
}
