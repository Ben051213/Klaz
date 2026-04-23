import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Student-side "I did the practice". Stamps completed_at. RLS allows
// students to update their own practice set rows (policy added in the
// feature-batch-1 migration).
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ setId: string }> }
) {
  const { setId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("practice_sets")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", setId)
    .eq("student_id", user.id)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Could not update" },
      { status: 500 }
    )
  }
  return NextResponse.json({ set: data })
}

// Undo completion.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ setId: string }> }
) {
  const { setId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("practice_sets")
    .update({ completed_at: null })
    .eq("id", setId)
    .eq("student_id", user.id)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Could not update" },
      { status: 500 }
    )
  }
  return NextResponse.json({ set: data })
}
