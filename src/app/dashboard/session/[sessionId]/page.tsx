import { notFound, redirect } from "next/navigation"
import { TeacherSessionView } from "@/components/TeacherSessionView"
import { createClient } from "@/lib/supabase/server"

export default async function TeacherSessionPage({
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
      "id, title, status, class_id, started_at, ended_at, classes(id, name, subject, teacher_id)"
    )
    .eq("id", sessionId)
    .single()
  type S = {
    id: string
    title: string
    status: "active" | "ended"
    class_id: string
    started_at: string
    ended_at: string | null
    classes: {
      id: string
      name: string
      subject: string
      teacher_id: string
    } | null
  }
  const s = session as S | null
  if (!s) notFound()
  if (s.classes?.teacher_id !== user.id) redirect("/dashboard")

  const { data: roster } = await supabase
    .from("class_enrollments")
    .select("student_id, profiles(id, name, email)")
    .eq("class_id", s.class_id)

  type RosterRow = {
    student_id: string
    profiles: { id: string; name: string; email: string } | null
  }

  return (
    <TeacherSessionView
      session={{
        id: s.id,
        title: s.title,
        status: s.status,
        classId: s.class_id,
        className: s.classes?.name ?? "",
        subject: s.classes?.subject ?? "",
        startedAt: s.started_at,
        endedAt: s.ended_at ?? undefined,
      }}
      roster={
        ((roster as RosterRow[] | null) ?? [])
          .filter((r) => r.profiles)
          .map((r) => ({
            id: r.profiles!.id,
            name: r.profiles!.name,
            email: r.profiles!.email,
          }))
      }
    />
  )
}
