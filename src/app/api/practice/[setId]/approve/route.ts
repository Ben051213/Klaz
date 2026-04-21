import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ setId: string }> }
) {
  const { setId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("practice_sets")
    .update({ status: "approved" })
    .eq("id", setId)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Could not approve" },
      { status: 500 }
    )
  }
  return NextResponse.json({ set: data })
}
