import { NextResponse } from "next/server"
import { generatePracticeForSession } from "@/lib/practice"
import { createClient, createServiceClient } from "@/lib/supabase/server"

// End-session can take 10-30s because we generate follow-up practice for
// every enrolled student via Claude Haiku. Bump past the 10s Hobby default.
export const maxDuration = 60

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: existing } = await supabase
    .from("sessions")
    .select("id, teacher_id, class_id, status")
    .eq("id", sessionId)
    .single()
  if (!existing || existing.teacher_id !== user.id) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }
  if (existing.status === "ended") {
    return NextResponse.json({ session: existing })
  }

  const { data: session, error } = await supabase
    .from("sessions")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .select()
    .single()
  if (error || !session) {
    return NextResponse.json(
      { error: error?.message || "Could not end session" },
      { status: 500 }
    )
  }

  try {
    const service = createServiceClient()
    const channel = service.channel(`class-${existing.class_id}`)
    await channel.subscribe()
    await channel.send({
      type: "broadcast",
      event: "session_ended",
      payload: { id: sessionId },
    })
    await service.removeChannel(channel)
  } catch {}

  // Await practice generation inline. Previously we fire-and-forget'd a
  // fetch to /api/practice/generate, but serverless functions terminate as
  // soon as the response is returned — the background fetch never finished,
  // so the Suggested follow-ups page stayed empty.
  try {
    await generatePracticeForSession(sessionId)
  } catch {
    // Don't block session-end on a generation error — the session is still
    // ended, and the teacher can always hit the generate endpoint manually.
  }

  return NextResponse.json({ session })
}
