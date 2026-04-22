import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ClassAnalytics } from "@/components/ClassAnalytics"
import { JoinCodeDisplay } from "@/components/JoinCodeDisplay"
import { SessionStartModal } from "@/components/SessionStartModal"
import { createClient } from "@/lib/supabase/server"
import { formatDateTime, formatDuration } from "@/lib/utils"

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>
}) {
  const { classId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: klass } = await supabase
    .from("classes")
    .select("id, teacher_id, name, subject, grade, join_code, created_at")
    .eq("id", classId)
    .single()
  if (!klass) notFound()
  if (klass.teacher_id !== user.id) redirect("/dashboard")

  // Roster, sessions and topic scores are fetched in parallel so the page
  // doesn't waterfall four round-trips.
  const [enrollmentsRes, sessionsRes, scoresRes, messagesRes] =
    await Promise.all([
      supabase
        .from("class_enrollments")
        .select("id, joined_at, profiles(id, name, email)")
        .eq("class_id", classId)
        .order("joined_at", { ascending: true }),
      supabase
        .from("sessions")
        .select("id, title, status, started_at, ended_at")
        .eq("class_id", classId)
        .order("started_at", { ascending: false }),
      supabase
        .from("student_topic_scores")
        .select("student_id, topic, score")
        .eq("class_id", classId),
      supabase
        .from("messages")
        .select("student_id, sessions!inner(class_id)")
        .eq("sessions.class_id", classId),
    ])

  type EnrollRow = {
    id: string
    joined_at: string
    profiles: { id: string; name: string; email: string } | null
  }
  const roster = (enrollmentsRes.data as EnrollRow[] | null) ?? []

  type SessionRow = {
    id: string
    title: string
    status: "active" | "ended"
    started_at: string
    ended_at: string | null
  }
  const sessionRows = (sessionsRes.data as SessionRow[] | null) ?? []
  const activeSession = sessionRows.find((s) => s.status === "active")
  const pastSessions = sessionRows.filter((s) => s.status === "ended")

  const scores =
    (scoresRes.data as
      | { student_id: string; topic: string; score: number }[]
      | null) ?? []

  // Roll up per-student message counts client-side since Postgres/Supabase
  // doesn't expose SQL GROUP BY through PostgREST without a view.
  const counts = new Map<string, number>()
  for (const row of (messagesRes.data as
    | { student_id: string }[]
    | null) ?? []) {
    counts.set(row.student_id, (counts.get(row.student_id) ?? 0) + 1)
  }
  const messageCounts = Array.from(counts.entries()).map(
    ([student_id, question_count]) => ({ student_id, question_count })
  )

  const rosterStudents = roster
    .filter((r): r is EnrollRow & { profiles: NonNullable<EnrollRow["profiles"]> } =>
      r.profiles !== null
    )
    .map((r) => ({
      id: r.profiles.id,
      name: r.profiles.name,
      email: r.profiles.email,
    }))

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard"
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            ← Back to classes
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-brand-navy">
            {klass.name}
          </h1>
          <p className="text-sm text-slate-500">
            {klass.subject}
            {klass.grade ? ` · ${klass.grade}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeSession ? (
            <Link
              href={`/dashboard/session/${activeSession.id}`}
              className="inline-flex items-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
            >
              Go to live session →
            </Link>
          ) : (
            <SessionStartModal classId={klass.id} />
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <JoinCodeDisplay code={klass.join_code} classId={klass.id} />
        </div>
        <Card className="lg:col-span-2 bg-white">
          <CardHeader>
            <CardTitle className="text-base text-brand-navy">
              Student roster ({roster.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {roster.length === 0 ? (
              <p className="text-sm text-slate-500">
                No students yet. Share the join code to get started.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {roster.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium text-slate-800">
                        {r.profiles?.name ?? "Student"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {r.profiles?.email}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400">
                      Joined {formatDateTime(r.joined_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-brand-navy">
          Class analytics
        </h2>
        <ClassAnalytics
          roster={rosterStudents}
          scores={scores}
          messageCounts={messageCounts}
          activeSessionId={activeSession?.id ?? null}
        />
      </div>

      <Card className="mt-6 bg-white">
        <CardHeader>
          <CardTitle className="text-base text-brand-navy">
            Past sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pastSessions.length === 0 ? (
            <p className="text-sm text-slate-500">No past sessions yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pastSessions.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-800">{s.title}</p>
                    <p className="text-xs text-slate-500">
                      {formatDateTime(s.started_at)} ·{" "}
                      {formatDuration(s.started_at, s.ended_at ?? undefined)}
                    </p>
                  </div>
                  <Badge variant="secondary">Ended</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
