import Link from "next/link"
import { CreateClassDialog } from "@/components/CreateClassDialog"
import { KlazTitle } from "@/components/klaz/KlazTitle"
import { Sparkline } from "@/components/klaz/Sparkline"
import { Chip } from "@/components/klaz/Chip"
import { flavorClasses } from "@/lib/flavor"
import { createClient } from "@/lib/supabase/server"
import { formatRelative, scoreHex } from "@/lib/utils"

// Teacher dashboard — the "warm editorial" classes index.
//   Serif title "Your classes." with a terracotta full-stop
//   Summary meta line with counts + a compact live-session CTA
//   A data-dense classes table (cream panel, mono join codes, avg + sparkline)
//
// The big LiveHero that used to sit here was moved out — the class-detail
// page renders the same hero contextually, so running it twice in a row
// (dashboard → class) was visual duplication. A thin "Session live →"
// link in the caption keeps the affordance without repeating the heatmap.
//
// We still fetch classes, enrollment counts, sessions, and topic scores
// in parallel for the table.

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // Archived classes drop off the main index (they're still listed
  // in /settings → Classes so the teacher can unarchive). Tolerate
  // null is_active for classes that predate the column.
  const { data: classes } = await supabase
    .from("classes")
    .select(
      "id, name, subject, grade, join_code, created_at, flavor, class_enrollments(count), sessions(id,title,status,started_at,ended_at)"
    )
    .eq("teacher_id", user.id)
    .or("is_active.is.null,is_active.eq.true")
    .order("created_at", { ascending: false })

  type Row = {
    id: string
    name: string
    subject: string
    grade: string | null
    join_code: string
    created_at: string
    flavor: string | null
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

  // 24h pulse — count messages per class in the last 24h so each row can
  // surface a "N questions today" chip. Makes the dashboard feel alive
  // without a full live data subscription. Single round-trip keyed by
  // session.class_id via a join on the messages view. If this starts to
  // cost, swap to an hourly rollup.
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const sessionIdsAll = rows.flatMap((r) => r.sessions.map((s) => s.id))
  const msgCountByClass = new Map<string, number>()
  if (sessionIdsAll.length > 0) {
    const { data: recentMsgs } = await supabase
      .from("messages")
      .select("session_id")
      .in("session_id", sessionIdsAll)
      .gte("created_at", since24h)
    const classBySession = new Map<string, string>()
    for (const r of rows) {
      for (const s of r.sessions) classBySession.set(s.id, r.id)
    }
    for (const m of (recentMsgs as { session_id: string }[] | null) ?? []) {
      const cid = classBySession.get(m.session_id)
      if (!cid) continue
      msgCountByClass.set(cid, (msgCountByClass.get(cid) ?? 0) + 1)
    }
  }

  // Find the first live session across all classes so the caption can
  // offer a one-tap "jump in" link. The heavy cross-session aggregation
  // that used to live here moved down to the class-detail LiveHero.
  const liveRow = rows.find((r) => r.sessions?.some((s) => s.status === "active"))
  const liveSession = liveRow?.sessions?.find((s) => s.status === "active")
  const activeCount = rows.filter((r) =>
    r.sessions?.some((s) => s.status === "active")
  ).length

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

      {liveSession && liveRow ? (
        <Link
          href={`/dashboard/session/${liveSession.id}`}
          className="mt-5 flex items-center gap-3 rounded-lg border border-klaz-accent/40 bg-klaz-mint-bg px-4 py-2.5 text-[13px] text-klaz-ink transition hover:border-klaz-accent hover:bg-klaz-mint-bg/60"
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-klaz-accent opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-klaz-accent" />
          </span>
          <span className="font-medium">{liveRow.name}</span>
          <span className="text-klaz-muted">·</span>
          <span className="text-klaz-ink2">
            {liveSession.title || "Live session"} running now
          </span>
          <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.08em] text-klaz-ink2">
            Jump in →
          </span>
        </Link>
      ) : null}

      {rows.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-klaz-line bg-klaz-panel p-12 text-center">
          <p className="font-serif text-[20px] text-klaz-ink">
            You haven&apos;t created a class yet
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
            const flavor = flavorClasses(c.flavor)
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
                      className={`grid h-[22px] w-[22px] place-items-center rounded-[5px] text-[11px] font-semibold ${flavor.chipBg} ${flavor.chipText}`}
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
                  <div className="mt-0.5 flex items-center gap-2 pl-[30px] text-[11.5px] text-klaz-muted">
                    <span>Updated {formatRelative(lastTouched)}</span>
                    {(() => {
                      const n = msgCountByClass.get(c.id) ?? 0
                      if (n === 0) return null
                      return (
                        <span className="inline-flex items-center gap-1 rounded-full bg-klaz-mint-bg px-1.5 py-[1px] font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-klaz-ok">
                          {n} today
                        </span>
                      )
                    })()}
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
