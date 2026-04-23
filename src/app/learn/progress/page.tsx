import Link from "next/link"
import { redirect } from "next/navigation"
import { TopicScoreBar } from "@/components/TopicScoreBar"
import { createClient } from "@/lib/supabase/server"
import { scoreHex, scoreTone, formatRelative } from "@/lib/utils"

// Student progress — one screen that pulls together what the student
// has been working on across every class they're enrolled in. The data
// already exists (student_topic_scores + sessions); this just surfaces
// it in a warm editorial layout.

export default async function StudentProgressPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Classes the student is enrolled in.
  const { data: enrollments } = await supabase
    .from("class_enrollments")
    .select(
      "classes(id, name, subject, grade, profiles:profiles!classes_teacher_id_fkey(name))"
    )
    .eq("student_id", user.id)

  type Row = {
    classes:
      | {
          id: string
          name: string
          subject: string
          grade: string | null
          profiles: { name: string } | { name: string }[] | null
        }
      | {
          id: string
          name: string
          subject: string
          grade: string | null
          profiles: { name: string } | { name: string }[] | null
        }[]
      | null
  }
  const rows = (enrollments as Row[] | null) ?? []
  const klasses = rows
    .map((r) => (Array.isArray(r.classes) ? r.classes[0] ?? null : r.classes))
    .filter(Boolean)
    .map((c) => ({
      id: c!.id,
      name: c!.name,
      subject: c!.subject,
      grade: c!.grade,
      teacherName: Array.isArray(c!.profiles)
        ? c!.profiles[0]?.name
        : c!.profiles?.name,
    }))

  const classIds = klasses.map((c) => c.id)

  // All scores + recent sessions (to show "last session was X, covered Y").
  const [scoresRes, sessionsRes, messageRes] = await Promise.all([
    classIds.length
      ? supabase
          .from("student_topic_scores")
          .select("class_id, topic, score, last_updated")
          .eq("student_id", user.id)
          .in("class_id", classIds)
      : Promise.resolve({
          data: [] as {
            class_id: string
            topic: string
            score: number
            last_updated: string
          }[],
        }),
    classIds.length
      ? supabase
          .from("sessions")
          .select("id, class_id, title, status, started_at")
          .in("class_id", classIds)
          .order("started_at", { ascending: false })
      : Promise.resolve({
          data: [] as {
            id: string
            class_id: string
            title: string
            status: string
            started_at: string
          }[],
        }),
    classIds.length
      ? supabase
          .from("messages")
          .select("session_id, confidence_signal")
          .eq("student_id", user.id)
      : Promise.resolve({
          data: [] as {
            session_id: string
            confidence_signal: string | null
          }[],
        }),
  ])

  const allScores =
    (scoresRes.data as
      | { class_id: string; topic: string; score: number; last_updated: string }[]
      | null) ?? []
  const allSessions =
    (sessionsRes.data as
      | {
          id: string
          class_id: string
          title: string
          status: string
          started_at: string
        }[]
      | null) ?? []
  const allMessages =
    (messageRes.data as
      | { session_id: string; confidence_signal: string | null }[]
      | null) ?? []

  // Aggregate KPIs at the top.
  const allClassScores = allScores
  const overallAvg =
    allClassScores.length === 0
      ? null
      : Math.round(
          allClassScores.reduce((a, s) => a + s.score, 0) /
            allClassScores.length
        )
  const totalQuestions = allMessages.length
  const topicsTracked = new Set(
    allClassScores.map((s) => `${s.class_id}::${s.topic}`)
  ).size
  const mastered = allClassScores.filter((s) => s.score >= 75).length
  const struggling = allClassScores.filter((s) => s.score < 50).length

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
      <div>
        <h1 className="font-serif text-[34px] font-normal leading-none tracking-[-0.02em] text-klaz-ink sm:text-[40px]">
          Your progress<span className="text-klaz-accent">.</span>
        </h1>
        <p className="mt-2 text-[13px] text-klaz-muted">
          Topics you&apos;ve asked about, across{" "}
          {klasses.length} class{klasses.length === 1 ? "" : "es"}.
        </p>
      </div>

      {/* KPI row */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Overall average"
          value={overallAvg != null ? `${overallAvg}` : "—"}
          sub="across all topics"
          tone={
            overallAvg == null
              ? "neutral"
              : overallAvg >= 70
                ? "ok"
                : overallAvg >= 50
                  ? "warn"
                  : "bad"
          }
        />
        <Kpi
          label="Topics tracked"
          value={topicsTracked.toString()}
          sub={`${mastered} mastered · ${struggling} struggling`}
        />
        <Kpi
          label="Questions asked"
          value={totalQuestions.toString()}
          sub="since you joined"
        />
        <Kpi
          label="Sessions attended"
          value={allSessions.length.toString()}
          sub={
            allSessions[0]
              ? `last ${formatRelative(allSessions[0].started_at)}`
              : "none yet"
          }
        />
      </div>

      {/* Per-class breakdown */}
      <div className="mt-8 space-y-6">
        {klasses.length === 0 ? (
          <div className="rounded-lg border border-dashed border-klaz-line bg-klaz-panel p-10 text-center">
            <p className="font-serif text-[20px] leading-none tracking-[-0.01em] text-klaz-ink">
              Nothing to show yet<span className="text-klaz-accent">.</span>
            </p>
            <p className="mt-2 text-[13px] text-klaz-muted">
              Join a class and ask a few questions — your topics will show up
              here.
            </p>
            <Link
              href="/learn"
              className="mt-4 inline-flex h-9 items-center rounded-md bg-klaz-ink px-4 text-[13px] font-medium text-klaz-bg transition hover:bg-klaz-deep"
            >
              Back to classes →
            </Link>
          </div>
        ) : (
          klasses.map((c) => {
            const classScores = allClassScores
              .filter((s) => s.class_id === c.id)
              .sort((a, b) => b.score - a.score)
            const classAvg =
              classScores.length === 0
                ? null
                : Math.round(
                    classScores.reduce((a, s) => a + s.score, 0) /
                      classScores.length
                  )
            const classSessions = allSessions.filter((s) => s.class_id === c.id)
            const lastActive = classSessions[0]
            return (
              <section
                key={c.id}
                className="rounded-lg border border-klaz-line bg-klaz-panel p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-klaz-faint">
                      Class
                    </div>
                    <div className="mt-1 font-serif text-[22px] leading-none tracking-[-0.01em] text-klaz-ink">
                      {c.name}
                    </div>
                    <div className="mt-1 text-[12.5px] text-klaz-muted">
                      {c.subject}
                      {c.grade ? ` · ${c.grade}` : ""}
                      {c.teacherName ? ` · ${c.teacherName}` : ""}
                    </div>
                  </div>
                  {classAvg != null ? (
                    <div className="text-right">
                      <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-klaz-faint">
                        Your average
                      </div>
                      <div
                        className="mt-1 font-serif text-[26px] leading-none tabular-nums"
                        style={{ color: scoreHex(classAvg) }}
                      >
                        {classAvg}
                      </div>
                      <div className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-klaz-faint">
                        {scoreTone(classAvg) === "ok"
                          ? "on track"
                          : scoreTone(classAvg) === "warn"
                            ? "needs work"
                            : "struggling"}
                      </div>
                    </div>
                  ) : null}
                </div>

                {classScores.length === 0 ? (
                  <p className="mt-4 text-[12.5px] text-klaz-muted">
                    No topics yet — ask a question in the next session and
                    they&apos;ll appear here.
                  </p>
                ) : (
                  <div className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                    {classScores.map((s) => (
                      <TopicScoreBar
                        key={s.topic}
                        topic={s.topic}
                        score={s.score}
                      />
                    ))}
                  </div>
                )}

                {lastActive ? (
                  <div className="mt-5 border-t border-klaz-line2 pt-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-klaz-faint">
                          {lastActive.status === "active"
                            ? "Happening now"
                            : "Last session"}
                        </div>
                        <div className="mt-1 text-[13px] font-medium text-klaz-ink">
                          {lastActive.title}
                        </div>
                        <div className="text-[11.5px] text-klaz-muted">
                          {formatRelative(lastActive.started_at)}
                        </div>
                      </div>
                      {lastActive.status === "active" ? (
                        <Link
                          href={`/learn/session/${lastActive.id}`}
                          className="inline-flex h-8 items-center rounded-md bg-klaz-accent px-3 text-[12.5px] font-medium text-white transition hover:bg-klaz-accent2"
                        >
                          Join →
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </section>
            )
          })
        )}
      </div>
    </div>
  )
}

function Kpi({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string
  value: string
  sub: string
  tone?: "ok" | "warn" | "bad" | "neutral"
}) {
  const color =
    tone === "ok"
      ? "#4a7c3a"
      : tone === "warn"
        ? "#b86a12"
        : tone === "bad"
          ? "#9c2b2b"
          : undefined
  return (
    <div className="rounded-lg border border-klaz-line bg-klaz-panel p-4">
      <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-klaz-faint">
        {label}
      </div>
      <div
        className="mt-1.5 font-serif text-[28px] leading-none tabular-nums text-klaz-ink"
        style={color ? { color } : undefined}
      >
        {value}
      </div>
      <div className="mt-1 text-[11.5px] text-klaz-muted">{sub}</div>
    </div>
  )
}
