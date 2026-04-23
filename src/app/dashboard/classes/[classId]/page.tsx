import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ClassAnalytics } from "@/components/ClassAnalytics"
import { JoinCodeDisplay } from "@/components/JoinCodeDisplay"
import { KlazTitle } from "@/components/klaz/KlazTitle"
import { LiveHero } from "@/components/klaz/LiveHero"
import { SessionStartModal } from "@/components/SessionStartModal"
import { createClient } from "@/lib/supabase/server"
import { formatDuration } from "@/lib/utils"

// Class detail — warm editorial layout matching the Klaz hybrid direction:
//   Crumb + serif title + meta line with subject, grade, mono join code pill
//   LiveHero if a session is currently running
//   ClassAnalytics renders 4 KPI cards + student ranking + topic heatmap
//   JoinCodeDisplay (QR) surfaces at the bottom for sharing

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

  // Roster, sessions, and topic scores fan out in parallel.
  const [enrollmentsRes, sessionsRes, scoresRes] = await Promise.all([
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
  ])

  type ProfileShape = { id: string; name: string; email: string }
  type EnrollRowRaw = {
    id: string
    joined_at: string
    profiles: ProfileShape | ProfileShape[] | null
  }
  type EnrollRow = {
    id: string
    joined_at: string
    profiles: ProfileShape | null
  }
  const rawRoster = (enrollmentsRes.data as EnrollRowRaw[] | null) ?? []
  const roster: EnrollRow[] = rawRoster.map((r) => ({
    id: r.id,
    joined_at: r.joined_at,
    profiles: Array.isArray(r.profiles) ? r.profiles[0] ?? null : r.profiles,
  }))

  type SessionRow = {
    id: string
    title: string
    status: "active" | "ended"
    started_at: string
    ended_at: string | null
  }
  const sessionRows = (sessionsRes.data as SessionRow[] | null) ?? []
  const activeSession = sessionRows.find((s) => s.status === "active")

  const scoresFromTable =
    (scoresRes.data as
      | { student_id: string; topic: string; score: number }[]
      | null) ?? []

  // Backfill: if a message has topics but no score row yet (write-path hiccup),
  // still surface that (student, topic) pair on the heatmap at baseline 50.
  const sessionIds = sessionRows.map((s) => s.id)
  const counts = new Map<string, number>()
  const topicsFromMessages = new Map<string, Set<string>>()
  if (sessionIds.length > 0) {
    const { data: msgRows } = await supabase
      .from("messages")
      .select("student_id, topics")
      .in("session_id", sessionIds)
    for (const row of (msgRows as
      | { student_id: string; topics: string[] | null }[]
      | null) ?? []) {
      counts.set(row.student_id, (counts.get(row.student_id) ?? 0) + 1)
      if (Array.isArray(row.topics) && row.topics.length > 0) {
        const bucket = topicsFromMessages.get(row.student_id) ?? new Set()
        for (const t of row.topics) bucket.add(t)
        topicsFromMessages.set(row.student_id, bucket)
      }
    }
  }
  const messageCounts = Array.from(counts.entries()).map(
    ([student_id, question_count]) => ({ student_id, question_count })
  )

  const seen = new Set(
    scoresFromTable.map((s) => `${s.student_id}::${s.topic}`)
  )
  const scores: { student_id: string; topic: string; score: number }[] = [
    ...scoresFromTable,
  ]
  for (const [studentId, topics] of topicsFromMessages.entries()) {
    for (const topic of topics) {
      const key = `${studentId}::${topic}`
      if (!seen.has(key)) {
        scores.push({ student_id: studentId, topic, score: 50 })
        seen.add(key)
      }
    }
  }

  const rosterStudents = roster
    .filter(
      (r): r is EnrollRow & { profiles: NonNullable<EnrollRow["profiles"]> } =>
        r.profiles !== null
    )
    .map((r) => ({
      id: r.profiles.id,
      name: r.profiles.name,
      email: r.profiles.email,
    }))

  // LiveHero needs hottest topic + at-risk summary when the session is active.
  let liveHero: React.ReactNode = null
  if (activeSession) {
    const { data: msgs } = await supabase
      .from("messages")
      .select("student_id, topics")
      .eq("session_id", activeSession.id)
    type Msg = { student_id: string; topics: string[] | null }
    const mList = (msgs as Msg[] | null) ?? []
    const active = new Set(mList.map((m) => m.student_id))
    const topicCount = new Map<string, number>()
    for (const m of mList) {
      if (!m.topics) continue
      for (const t of m.topics) topicCount.set(t, (topicCount.get(t) ?? 0) + 1)
    }
    const hottest = [...topicCount.entries()].sort((a, b) => b[1] - a[1])[0]

    // Aggregate per-student avg from the same scores we already fetched.
    const perStudent = new Map<string, { total: number; n: number; name: string }>()
    const nameById = new Map(rosterStudents.map((s) => [s.id, s.name]))
    for (const s of scoresFromTable) {
      const entry = perStudent.get(s.student_id) ?? {
        total: 0,
        n: 0,
        name: nameById.get(s.student_id) ?? "Student",
      }
      entry.total += s.score
      entry.n += 1
      perStudent.set(s.student_id, entry)
    }
    const atRisk = [...perStudent.entries()]
      .map(([id, v]) => ({ id, name: v.name, avg: v.total / Math.max(1, v.n) }))
      .filter((s) => s.avg < 65)
      .sort((a, b) => a.avg - b.avg)

    liveHero = (
      <div className="mt-4">
        <LiveHero
          compact
          classLabel={klass.name}
          topic={activeSession.title}
          elapsed={formatDuration(activeSession.started_at)}
          onlineCount={active.size}
          totalCount={rosterStudents.length}
          questionCount={mList.length}
          hottestTopic={hottest?.[0] ?? null}
          hottestPercent={
            hottest
              ? Math.round((hottest[1] / Math.max(1, mList.length)) * 100)
              : null
          }
          atRisk={atRisk.map((s) => ({ id: s.id, name: s.name }))}
          atRiskCount={atRisk.length}
          sessionId={activeSession.id}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <Link
        href="/dashboard"
        className="font-mono text-[11px] uppercase tracking-[0.08em] text-klaz-faint transition hover:text-klaz-ink2"
      >
        ← Classes
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <KlazTitle size="md">{klass.name}</KlazTitle>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-klaz-muted">
            <span>{klass.subject}</span>
            {klass.grade ? <span>· {klass.grade}</span> : null}
            <span>·</span>
            <span className="inline-flex items-center rounded-full bg-klaz-line2 px-2 py-[1px] font-mono tracking-[0.06em] text-klaz-ink2">
              {klass.join_code}
            </span>
            <span>·</span>
            <span>
              {rosterStudents.length} enrolled
              {sessionRows.length > 0
                ? ` · ${sessionRows.length} session${
                    sessionRows.length === 1 ? "" : "s"
                  }`
                : ""}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/classes/${klass.id}/materials`}
            className="inline-flex h-9 items-center rounded-md border border-klaz-line bg-klaz-panel2 px-3 text-[13px] font-medium text-klaz-ink2 transition hover:bg-klaz-line2"
          >
            Materials →
          </Link>
          <Link
            href={`/dashboard/classes/${klass.id}/practice`}
            className="inline-flex h-9 items-center rounded-md border border-klaz-line bg-klaz-panel2 px-3 text-[13px] font-medium text-klaz-ink2 transition hover:bg-klaz-line2"
          >
            Practice queue →
          </Link>
          {activeSession ? (
            <Link
              href={`/dashboard/session/${activeSession.id}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-klaz-accent px-4 py-2 text-[13.5px] font-medium text-white transition hover:bg-klaz-accent2"
            >
              Enter pulse →
            </Link>
          ) : (
            <SessionStartModal classId={klass.id} />
          )}
        </div>
      </div>

      {liveHero}

      <div className="mt-6">
        <ClassAnalytics
          classId={klass.id}
          roster={rosterStudents}
          scores={scores}
          messageCounts={messageCounts}
          activeSessionId={activeSession?.id ?? null}
          sessions={sessionRows}
        />
      </div>

      <div className="mt-6 grid gap-3.5 lg:grid-cols-[1fr_1.4fr]">
        <div className="rounded-xl border border-klaz-line bg-klaz-panel p-4">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-klaz-faint">
            Share with students
          </div>
          <div className="mt-1 font-serif text-[20px] text-klaz-ink">
            Join this class<span className="text-klaz-accent">.</span>
          </div>
          <p className="mt-1 text-[12.5px] text-klaz-muted">
            Students scan the QR or type the code at{" "}
            <span className="font-medium text-klaz-ink">klaz.app/join</span>.
          </p>
          <div className="mt-3">
            <JoinCodeDisplay code={klass.join_code} classId={klass.id} />
          </div>
        </div>
        <div className="rounded-xl border border-klaz-line bg-klaz-panel p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-klaz-faint">
                Roster
              </div>
              <div className="text-[13px] font-semibold text-klaz-ink">
                {rosterStudents.length} enrolled
              </div>
            </div>
          </div>
          {roster.length === 0 ? (
            <p className="mt-4 text-[12.5px] text-klaz-muted">
              No students yet. Share the join code to get started.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-klaz-line2">
              {roster.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 py-2 text-[12.5px]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-klaz-ink">
                      {r.profiles?.name ?? "Student"}
                    </p>
                    <p className="truncate text-[11.5px] text-klaz-muted">
                      {r.profiles?.email}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
