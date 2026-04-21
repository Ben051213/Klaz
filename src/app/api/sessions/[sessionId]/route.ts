import { NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

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

  // Fire-and-forget practice generation.
  const origin = new URL(request.url).origin
  const cookie = request.headers.get("cookie") ?? ""
  fetch(`${origin}/api/practice/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ session_id: sessionId }),
  }).catch(() => {})

  return NextResponse.json({ session })
}
