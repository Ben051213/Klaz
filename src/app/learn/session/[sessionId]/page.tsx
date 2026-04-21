import { notFound, redirect } from "next/navigation"
import { StudentChat } from "@/components/StudentChat"
import { createClient } from "@/lib/supabase/server"

export default async function StudentSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: session } = await supabase
    .from("sessions")
    .select(
      "id, title, status, class_id, classes(id, name, subject)"
    )
    .eq("id", sessionId)
    .single()
  if (!session) notFound()

  const { data: enrollment } = await supabase
    .from("class_enrollments")
    .select("id")
    .eq("class_id", session.class_id)
    .eq("student_id", user.id)
    .maybeSingle()
  if (!enrollment) redirect("/learn")

  const { data: messages } = await supabase
    .from("messages")
    .select("id, student_text, ai_response, created_at")
    .eq("session_id", sessionId)
    .eq("student_id", user.id)
    .order("created_at", { ascending: true })

  const { data: topicScores } = await supabase
    .from("student_topic_scores")
    .select("topic, score")
    .eq("class_id", session.class_id)
    .eq("student_id", user.id)

  type SessionClass = {
    id: string
    title: string
    status: "active" | "ended"
    class_id: string
    classes:
      | { id: string; name: string; subject: string }
      | { id: string; name: string; subject: string }[]
      | null
  }
  const raw = session as SessionClass
  const classes = Array.isArray(raw.classes) ? raw.classes[0] : raw.classes
  const s = { ...raw, classes: classes ?? null }

  return (
    <StudentChat
      session={{
        id: s.id,
        title: s.title,
        status: s.status,
        classId: s.class_id,
        className: s.classes?.name ?? "Class",
        subject: s.classes?.subject ?? "",
      }}
      initialMessages={
        (messages as {
          id: string
          student_text: string
          ai_response: string | null
          created_at: string
        }[]) ?? []
      }
      initialScores={
        (topicScores as { topic: string; score: number }[]) ?? []
      }
    />
  )
}
