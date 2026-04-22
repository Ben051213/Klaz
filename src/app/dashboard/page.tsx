import Link from "next/link"
import { CreateClassDialog } from "@/components/CreateClassDialog"
import { KlazTitle } from "@/components/klaz/KlazTitle"
import { LiveHero } from "@/components/klaz/LiveHero"
import { Sparkline } from "@/components/klaz/Sparkline"
import { Chip } from "@/components/klaz/Chip"
import { createClient } from "@/lib/supabase/server"
import { formatDuration, formatRelative, scoreHex } from "@/lib/utils"

// Teacher dashboard — the "warm editorial" classes index.
//   Serif title "Your classes." with a terracotta full-stop
//   Summary meta line with counts
//   LiveHero strip if any session is currently running
//   A data-dense classes table (cream panel, mono join codes, avg + sparkline)
//
// We fetch everything needed in parallel: classes, enrollment counts, active
// sessions + message count for the live hero, topic scores for per-class
// averages, and the latest session.started_at per class for the "Updated"
// sub-meta on each row.

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: classes } = await supabase
    .from("classes")
    .select(
      "id, name, subject, grade, join_code, created_at, class_enrollments(count), sessions(id,title,status,started_at,ended_at)"
    )
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false })

  type Row = {
    id: string
    name: string
    subject: string
    grade: string | null
    join_code: string
    created_at: string
    class_enrollments: { count: number }[]
    sessions: {
      id: string
      title: string
      status: "active" | "ended"
      started_at: string
      ended_at: string | null
    }[]
  }
  const rows = (classes as Row[] | null) ?? []
  const classIds = rows.map((r) => r.id)

  // Pull all student_topic_scores for all classes in one round-trip so we can
  // compute (a) per-class average for the "Avg" column and (b) a rolling
  // trend sparkline from the last few score updates.
  const { data: scoreRows } =
    classIds.length > 0
      ? await supabase
          .from("student_topic_scores")
          .select("class_id, score, last_updated")
          .in("class_id", classIds)
          .order("last_updated", { ascending: true })
      : { data: [] as { class_id: string; score: number; last_updated: string }[] }

  const scoresByClass = new Map<
    string,
    { score: number; last_updated: string }[]
  >()
  for (const r of (scoreRows as
    | { class_id: string; score: number; last_updated: string }[]
    | null) ?? []) {
    const bucket = scoresByClass.get(r.class_id) ?? []
    bucket.push({ score: r.score, last_updated: r.last_updated })
    scoresByClass.set(r.class_id, bucket)
  }

  // For the LiveHero: find the first active session across all classes.
  const liveRow = rows.find((r) => r.sessions?.some((s) => s.status === "active"))
  const liveSession = liveRow?.sessions?.find((s) => s.status === "active")
  const activeCount = rows.filter((r) =>
    r.sessions?.some((s) => s.status === "active")
  ).length

  // Pull hero data for the currently live session only (topic heat + online
  // count + question count). We skip this if nothing is live to avoid an
  // empty round-trip.
  let heroData: {
    questionCount: number
    onlineCount: number
    totalCount: number
    elapsed: string
    hottestTopic: string | null
    hottestPercent: number | null
    atRisk: { id: string; name: string }[]
    atRiskCount: number
  } | null = null

  if (liveRow && liveSession) {
    const [msgRes, enrollRes, scoreRes] = await Promise.all([
      supabase
        .from("messages")
        .select("student_id, topics, created_at")
        .eq("session_id", liveSession.id),
      supabase
        .from("class_enrollments")
        .select("student_id, profiles(id, name)")
        .eq("class_id", liveRow.id),
      supabase
        .from("student_topic_scores")
        .select("student_id, topic, score, profiles(name)")
        .eq("class_id", liveRow.id),
    ])
    type Msg = { student_id: string; topics: string[] | null; created_at: string }
    const msgs = (msgRes.data as Msg[] | null) ?? []
    const active = new Set(msgs.map((m) => m.student_id))
    const topicCount = new Map<string, number>()
    for (const m of msgs) {
      if (!m.topics) continue
      for (const t of m.topics) topicCount.set(t, (topicCount.get(t) ?? 0) + 1)
    }
    const hottest = [...topicCount.entries()].sort((a, b) => b[1] - a[1])[0]
    const totalCount = (enrollRes.data as { student_id: string }[] | null)?.length ?? 0
    type Score = {
      student_id: string
      topic: string
      score: number
      profiles: { name: string } | { name: string }[] | null
    }
    const scores = (scoreRes.data as Score[] | null) ?? []
    // Aggregate per student: an average across topics gives a single number
    // to threshold against, matching how the class detail page ranks kids.
    const perStudent = new Map<string, { total: number; n: number; name: string }>()
    for (const s of scores) {
      const profile = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles
      const name = profile?.name ?? "Student"
      const entry = perStudent.get(s.student_id) ?? { total: 0, n: 0, name }
      entry.total += s.score
      entry.n += 1
      entry.name = name
      perStudent.set(s.student_id, entry)
    }
    const atRisk = [...perStudent.entries()]
      .map(([id, v]) => ({ id, name: v.name, avg: v.total / Math.max(1, v.n) }))
      .filter((s) => s.avg < 65)
      .sort((a, b) => a.avg - b.avg)

    heroData = {
      questionCount: msgs.length,
      onlineCount: active.size,
      totalCount,
      elapsed: formatDuration(liveSession.started_at),
      hottestTopic: hottest?.[0] ?? null,
      hottestPercent: hottest
        ? Math.round((hottest[1] / Math.max(1, msgs.length)) * 100)
        : null,
      atRisk: atRisk.map((s) => ({ id: s.id, name: s.name })),
      atRiskCount: atRisk.length,
    }
  }

  const totalStudents = rows.reduce(
    (sum, r) => sum + (r.class_enrollments?.[0]?.count ?? 0),
    0
  )

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <KlazTitle size="md">Your classes</KlazTitle>
          <p className="mt-1 text-[12.5px] text-klaz-muted">
            {rows.length} {rows.length === 1 ? "class" : "classes"} ·{" "}
            {totalStudents} enrolled ·{" "}
            {activeCount === 0
              ? "no sessions live right now"
              : `${activeCount} session${
                  activeCount === 1 ? "" : "s"
                } live right now`}
          </p>
        </div>
        <CreateClassDialog />
      </div>

      {liveSession && liveRow && heroData ? (
        <div className="mt-6">
          <LiveHero
            classLabel={liveRow.name}
            topic={liveSession.title || null}
            elapsed={heroData.elapsed}
            onlineCount={heroData.onlineCount}
            totalCount={heroData.totalCount}
            questionCount={heroData.questionCount}
            hottestTopic={heroData.hottestTopic}
            hottestPercent={heroData.hottestPercent}
            atRisk={heroData.atRisk}
            sessionId={liveSession.id}
            atRiskCount={heroData.atRiskCount}
          />
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-klaz-line bg-klaz-panel p-12 text-center">
          <p className="font-serif text-[20px] text-klaz-ink">
            You haven&apos;t created a class yet
            <span className="text-klaz-accent">.</span>
          </p>
          <p className="mt-2 text-[13.5px] text-klaz-muted">
            Click <span className="font-medium text-klaz-ink">+ New class</span>{" "}
            above to get your first join code.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-klaz-line bg-klaz-panel">
          <div className="hidden grid-cols-[2fr_1.1fr_0.7fr_1fr_0.9fr_40px] items-center gap-3 border-b border-klaz-line2 bg-klaz-bg px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-klaz-muted md:grid">
            <span>Class</span>
            <span>Subject</span>
            <span>Students</span>
            <span>Join code</span>
            <span>Avg · trend</span>
            <span />
          </div>
          {rows.map((c, i) => {
            const studentCount = c.class_enrollments?.[0]?.count ?? 0
            const live = c.sessions?.find((s) => s.status === "active")
            const lastSession = c.sessions
              ?.slice()
              .sort(
                (a, b) =>
                  new Date(b.started_at).getTime() -
                  new Date(a.started_at).getTime()
              )[0]
            const lastTouched = lastSession?.started_at ?? c.created_at
            const classScores = scoresByClass.get(c.id) ?? []
            const avg =
              classScores.length > 0
                ? Math.round(
                    classScores.reduce((s, r) => s + r.score, 0) /
                      classScores.length
                  )
                : null
            // Take the last 12 score events and bucket them into a short
            // rolling series by simple tail-slicing — gives the sparkline
            // texture without faking synthetic data.
            const tail = classScores.slice(-12).map((r) => r.score)
            const trend =
              tail.length >= 2
                ? tail
                : avg !== null
                  ? [avg, avg]
                  : [50, 50]
            return (
              <Link
                key={c.id}
                href={`/dashboard/classes/${c.id}`}
                className={`grid grid-cols-1 items-center gap-3 px-4 py-3 transition hover:bg-klaz-line2/40 md:grid-cols-[2fr_1.1fr_0.7fr_1fr_0.9fr_40px] ${
                  i < rows.length - 1 ? "border-b border-klaz-line2" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="grid h-[22px] w-[22px] place-items-center rounded-[5px] text-[11px] font-semibold"
                      style={{
                        background: `oklch(0.92 0.05 ${(i * 52) % 360})`,
                        color: `oklch(0.4 0.11 ${(i * 52) % 360})`,
                      }}
                      aria-hidden
                    >
                      {c.subject[0]?.toUpperCase()}
                    </span>
                    <span className="truncate text-[13.5px] font-medium text-klaz-ink">
                      {c.name}
                    </span>
                    {live ? (
                      <Chip tone="live" mono className="text-[9.5px]">
                        ● LIVE
                      </Chip>
                    ) : null}
                  </div>
                  <div className="mt-0.5 pl-[30px] text-[11.5px] text-klaz-muted">
                    Updated {formatRelative(lastTouched)}
                  </div>
                </div>
                <span className="text-[13px] text-klaz-ink2">
                  {c.subject}
                  {c.grade ? ` · ${c.grade}` : ""}
                </span>
                <span className="font-mono text-[12.5px] text-klaz-ink2">
                  {studentCount}
                </span>
                <span className="inline-flex w-fit items-center rounded-full bg-klaz-line2 px-2 py-[2px] font-mono text-[11.5px] tracking-[0.06em] text-klaz-ink2">
                  {c.join_code}
                </span>
                <div className="flex items-center gap-2">
                  {avg !== null ? (
                    <>
                      <span
                        className="font-serif text-[20px] leading-none"
                        style={{ color: scoreHex(avg) }}
                      >
                        {avg}
                      </span>
                      <Sparkline
                        values={trend}
                        stroke="var(--color-klaz-accent)"
                      />
                    </>
                  ) : (
                    <span className="font-mono text-[10px] text-klaz-faint">
                      no data yet
                    </span>
                  )}
                </div>
                <div
                  className="text-right text-[13px] text-klaz-faint"
                  aria-hidden
                >
                  →
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
