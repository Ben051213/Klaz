import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { FLAVORS, type Flavor } from "@/lib/flavor"

// Teacher-editable per-class settings. Today: tutor_tone (free-text
// appended to the system prompt) and flavor (pastel tint). Both edit
// paths come through here so the class detail/materials pages can
// stay single-purpose.
//
// RLS already locks `classes` updates to the owning teacher — we
// duplicate the check here for a clean 403.

const MAX_TONE_LENGTH = 400

export async function PATCH(
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

  const body = (await request.json().catch(() => ({}))) as {
    tutor_tone?: string | null
    flavor?: string | null
  }

  const update: Record<string, string | null> = {}

  if ("tutor_tone" in body) {
    const tone =
      typeof body.tutor_tone === "string"
        ? body.tutor_tone.trim().slice(0, MAX_TONE_LENGTH)
        : ""
    update.tutor_tone = tone.length > 0 ? tone : null
  }

  if ("flavor" in body) {
    if (
      body.flavor !== null &&
      !FLAVORS.includes(body.flavor as Flavor)
    ) {
      return NextResponse.json(
        { error: "Invalid flavor" },
        { status: 400 }
      )
    }
    update.flavor = body.flavor ?? null
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "Nothing to update" },
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from("classes")
    .update(update)
    .eq("id", classId)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ...update })
}
