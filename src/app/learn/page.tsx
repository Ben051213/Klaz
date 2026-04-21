import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { JoinClassCard } from "@/components/JoinClassCard"
import { LiveSessions } from "@/components/LiveSessions"
import { createClient } from "@/lib/supabase/server"
import { formatDateTime } from "@/lib/utils"

export default async function LearnHome() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: enrollments } = await supabase
    .from("class_enrollments")
    .select(
      "id, joined_at, classes(id, name, subject, grade, teacher_id, profiles:profiles!classes_teacher_id_fkey(name))"
    )
    .eq("student_id", user.id)
    .order("joined_at", { ascending: false })

  type EnrollmentRow = {
    id: string
    joined_at: string
    classes: {
      id: string
      name: string
      subject: string
      grade: string | null
      teacher_id: string
      profiles: { name: string } | null
    } | null
  }
  const rows = (enrollments as EnrollmentRow[] | null) ?? []

  const classIds = rows.map((r) => r.classes?.id).filter(Boolean) as string[]

  const { data: activeSessions } = classIds.length
    ? await supabase
        .from("sessions")
        .select("id, title, class_id")
        .in("class_id", classIds)
        .eq("status", "active")
    : { data: [] as { id: string; title: string; class_id: string }[] }

  const { data: lastSessions } = classIds.length
    ? await supabase
        .from("sessions")
        .select("id, class_id, started_at")
        .in("class_id", classIds)
        .order("started_at", { ascending: false })
    : { data: [] as { id: string; class_id: string; started_at: string }[] }

  const latestByClass = new Map<string, string>()
  for (const s of lastSessions ?? []) {
    if (!latestByClass.has(s.class_id))
      latestByClass.set(s.class_id, s.started_at)
  }

  const initialSessions = (activeSessions ?? []).map((s) => {
    const row = rows.find((r) => r.classes?.id === s.class_id)
    return {
      id: s.id,
      title: s.title,
      class_id: s.class_id,
      class: {
        id: row?.classes?.id ?? s.class_id,
        name: row?.classes?.name ?? "Class",
        subject: row?.classes?.subject ?? "",
      },
      teacherName: row?.classes?.profiles?.name,
    }
  })

  const enrolledClasses = rows
    .filter((r) => r.classes)
    .map((r) => ({
      id: r.classes!.id,
      name: r.classes!.name,
      subject: r.classes!.subject,
      teacher_name: r.classes!.profiles?.name,
    }))

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">My classes</h1>
          <p className="mt-1 text-sm text-slate-500">
            When a teacher starts a session, it will appear here.
          </p>
        </div>
        <JoinClassCard />
        <LiveSessions
          initialSessions={initialSessions}
          enrolledClasses={enrolledClasses}
        />
      </div>

      {rows.length === 0 ? (
        <Card className="mt-6 border-dashed bg-white">
          <CardContent className="py-12 text-center">
            <p className="text-slate-500">
              You&apos;re not enrolled in any classes yet.
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Enter a join code above to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {rows.map((r) => {
            const klass = r.classes
            if (!klass) return null
            const last = latestByClass.get(klass.id)
            return (
              <Card key={r.id} className="bg-white">
                <CardHeader>
                  <CardTitle className="text-brand-navy">
                    {klass.name}
                  </CardTitle>
                  <p className="text-sm text-slate-500">
                    {klass.subject}
                    {klass.grade ? ` · ${klass.grade}` : ""}
                    {klass.profiles?.name ? ` · ${klass.profiles.name}` : ""}
                  </p>
                </CardHeader>
                <CardContent className="text-sm text-slate-500">
                  <p>
                    Last session:{" "}
                    <span className="text-slate-700">
                      {last ? formatDateTime(last) : "None yet"}
                    </span>
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
