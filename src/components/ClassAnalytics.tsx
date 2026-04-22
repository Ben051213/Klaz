"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Chip } from "@/components/klaz/Chip"
import { Sparkline } from "@/components/klaz/Sparkline"
import { RemoveStudentButton } from "@/components/RemoveStudentButton"
import { cn, formatDateTime, formatDuration, scoreHex } from "@/lib/utils"

// The analytics body for a class detail page — 4 KPI cards on top,
// then a two-column grid: student ranking on the left, topic heatmap
// + recent sessions stack on the right. Matches the "warm editorial"
// hybrid direction.

type Student = { id: string; name: string; email: string }
type ScoreRow = { student_id: string; topic: string; score: number }
type MessageCountRow = { student_id: string; question_count: number }
type SessionRow = {
  id: string
  title: string
  status: "active" | "ended"
  started_at: string
  ended_at: string | null
}

type SortMode = "weakest" | "strongest" | "most_active"

type StudentStat = {
  id: string
  name: string
  email: string
  avg: number | null
  weakest: { topic: string; score: number } | null
  strongest: { topic: string; score: number } | null
  topicCount: number
  questions: number
}

function Pill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1 text-[11.5px] font-medium transition",
        active
          ? "bg-klaz-ink text-klaz-bg"
          : "bg-transparent text-klaz-muted hover:bg-klaz-line2"
      )}
    >
      {label}
    </button>
  )
}

export function ClassAnalytics({
  classId,
  roster,
  scores,
  messageCounts,
  activeSessionId,
  sessions,
}: {
  classId: string
  roster: Student[]
  scores: ScoreRow[]
  messageCounts: MessageCountRow[]
  activeSessionId?: string | null
  sessions: SessionRow[]
}) {
  const [sort, setSort] = useState<SortMode>("weakest")

  const stats: StudentStat[] = useMemo(() => {
    const msgMap = new Map<string, number>()
    for (const m of messageCounts) msgMap.set(m.student_id, m.question_count)
    const scoresByStudent = new Map<string, { topic: string; score: number }[]>()
    for (const s of scores) {
      const bucket = scoresByStudent.get(s.student_id) ?? []
      bucket.push({ topic: s.topic, score: s.score })
      scoresByStudent.set(s.student_id, bucket)
    }
    return roster.map((st) => {
      const sList = scoresByStudent.get(st.id) ?? []
      if (sList.length === 0) {
        return {
          id: st.id,
          name: st.name,
          email: st.email,
          avg: null,
          weakest: null,
          strongest: null,
          topicCount: 0,
          questions: msgMap.get(st.id) ?? 0,
        }
      }
      const avg = Math.round(
        sList.reduce((sum, x) => sum + x.score, 0) / sList.length
      )
      const sortedAsc = [...sList].sort((a, b) => a.score - b.score)
      return {
        id: st.id,
        name: st.name,
        email: st.email,
        avg,
        weakest: sortedAsc[0],
        strongest: sortedAsc[sortedAsc.length - 1],
        topicCount: sList.length,
        questions: msgMap.get(st.id) ?? 0,
      }
    })
  }, [roster, scores, messageCounts])

  const sorted = useMemo(() => {
    const copy = [...stats]
    if (sort === "weakest") {
      copy.sort((a, b) => {
        if (a.avg === null && b.avg === null) return 0
        if (a.avg === null) return 1
        if (b.avg === null) return -1
        return a.avg - b.avg
      })
    } else if (sort === "strongest") {
      copy.sort((a, b) => {
        if (a.avg === null && b.avg === null) return 0
        if (a.avg === null) return 1
        if (b.avg === null) return -1
        return b.avg - a.avg
      })
    } else {
      copy.sort((a, b) => b.questions - a.questions)
    }
    return copy
  }, [stats, sort])

  // Class-wide topic heatmap — lowest first so what's struggling floats up.
  const topicHeatmap = useMemo(() => {
    const byTopic = new Map<string, number[]>()
    for (const s of scores) {
      const bucket = byTopic.get(s.topic) ?? []
      bucket.push(s.score)
      byTopic.set(s.topic, bucket)
    }
    return Array.from(byTopic.entries())
      .map(([topic, values]) => ({
        topic,
        avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
        count: values.length,
      }))
      .sort((a, b) => a.avg - b.avg)
  }, [scores])

  const studentsWithSignal = stats.filter((s) => s.avg !== null).length
  const classAvg =
    studentsWithSignal === 0
      ? null
      : Math.round(
          stats
            .filter((s): s is StudentStat & { avg: number } => s.avg !== null)
            .reduce((sum, s) => sum + s.avg, 0) / studentsWithSignal
        )
  const totalQuestions = stats.reduce((sum, s) => sum + s.questions, 0)
  const atRiskCount = stats.filter((s) => s.avg !== null && s.avg < 50).length
  const atRiskNames = stats
    .filter((s) => s.avg !== null && s.avg < 50)
    .map((s) => s.name.split(" ")[0])
    .slice(0, 4)

  // A naive trend series for the KPI sparklines — samples scores evenly
  // across the class so the line has movement without faking history.
  const scoreTrend = useMemo(() => {
    if (scores.length === 0) return [50, 50]
    const values = scores.map((s) => s.score)
    const bucketCount = Math.min(12, values.length)
    const step = values.length / bucketCount
    const out: number[] = []
    for (let i = 0; i < bucketCount; i++) {
      const start = Math.floor(i * step)
      const end = Math.floor((i + 1) * step)
      const slice = values.slice(start, end)
      const avg = slice.reduce((a, b) => a + b, 0) / Math.max(1, slice.length)
      out.push(Math.round(avg))
    }
    return out
  }, [scores])

  const recentSessions = sessions.slice(0, 3)

  const kpis = [
    {
      label: "Class average",
      value: classAvg ?? "—",
      suffix: classAvg !== null ? "/100" : "",
      sub:
        studentsWithSignal === 0
          ? "no signal yet"
          : `across ${studentsWithSignal} student${
              studentsWithSignal === 1 ? "" : "s"
            }`,
      color: classAvg !== null ? scoreHex(classAvg) : "var(--color-klaz-ink)",
    },
    {
      label: "Questions asked",
      value: totalQuestions,
      suffix: "",
      sub: activeSessionId ? "live now" : "all sessions",
      color: "var(--color-klaz-ok)",
    },
    {
      label: "Topics tracked",
      value: topicHeatmap.length,
      suffix: "",
      sub: "unique topics surfaced",
      color: "var(--color-klaz-ink)",
    },
    {
      label: "Students at risk",
      value: atRiskCount,
      suffix: roster.length > 0 ? `/${roster.length}` : "",
      sub: atRiskNames.length > 0 ? atRiskNames.join(", ") : "none flagged",
      color: atRiskCount > 0 ? "var(--color-klaz-bad)" : "var(--color-klaz-ink)",
    },
  ]

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-klaz-line bg-klaz-panel p-3.5"
          >
            <div className="flex items-center justify-between">
              <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-klaz-faint">
                {k.label}
              </div>
              <span style={{ color: k.color }}>
                <Sparkline values={scoreTrend} stroke="currentColor" />
              </span>
            </div>
            <div
              className="mt-1.5 flex items-baseline gap-1 font-serif leading-none tracking-[-0.02em]"
              style={{ color: k.color }}
            >
              <span className="text-[34px]">{k.value}</span>
              {k.suffix ? (
                <span className="text-[14px] font-sans text-klaz-faint">
                  {k.suffix}
                </span>
              ) : null}
            </div>
            <div className="mt-1 text-[11.5px] text-klaz-muted">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3.5 lg:grid-cols-[1.45fr_1fr]">
        {/* Student ranking */}
        <div className="rounded-xl border border-klaz-line bg-klaz-panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-klaz-line2 px-4 py-3">
            <div>
              <div className="text-[13px] font-semibold text-klaz-ink">
                Students
              </div>
              <div className="text-[11.5px] text-klaz-muted">
                {sort === "weakest"
                  ? "Sorted by who needs the most help"
                  : sort === "strongest"
                    ? "Sorted by who's mastering material"
                    : "Sorted by who's engaging the most"}
              </div>
            </div>
            <div className="flex gap-1">
              <Pill
                label="Weakest"
                active={sort === "weakest"}
                onClick={() => setSort("weakest")}
              />
              <Pill
                label="Strongest"
                active={sort === "strongest"}
                onClick={() => setSort("strongest")}
              />
              <Pill
                label="Most active"
                active={sort === "most_active"}
                onClick={() => setSort("most_active")}
              />
            </div>
          </div>
          {sorted.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-klaz-muted">
              No students yet. Share the join code to get started.
            </p>
          ) : (
            <ul>
              {sorted.map((s, idx) => {
                const atRisk = s.avg !== null && s.avg < 50
                return (
                  <li
                    key={s.id}
                    className={cn(
                      "grid grid-cols-[20px_28px_1fr_80px_56px_auto] items-center gap-2.5 px-4 py-2.5",
                      idx < sorted.length - 1 && "border-b border-klaz-line2",
                      atRisk && "bg-[#fbefe9]"
                    )}
                  >
                    <span className="text-right font-mono text-[11px] text-klaz-faint">
                      {idx + 1}
                    </span>
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-klaz-line2 text-[11px] font-semibold text-klaz-ink">
                        {s.name.slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-klaz-ink">
                        {s.name}
                      </div>
                      <div className="mt-[1px] flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] text-klaz-muted">
                        <span>
                          {s.questions}q · {s.topicCount} topic
                          {s.topicCount === 1 ? "" : "s"}
                        </span>
                        {s.weakest && s.weakest.score < 70 ? (
                          <span>
                            weak:{" "}
                            <span className="font-serif text-[13px] italic text-klaz-bad">
                              {s.weakest.topic}
                            </span>
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div>
                      {s.avg !== null ? (
                        <div className="h-1 w-20 overflow-hidden rounded-full bg-klaz-line2">
                          <div
                            className="h-full"
                            style={{
                              width: `${s.avg}%`,
                              background: scoreHex(s.avg),
                            }}
                          />
                        </div>
                      ) : (
                        <span className="text-[11px] text-klaz-faint">—</span>
                      )}
                    </div>
                    <div className="text-right">
                      {s.avg !== null ? (
                        <span
                          className="font-serif text-[22px] leading-none"
                          style={{ color: scoreHex(s.avg) }}
                        >
                          {s.avg}
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] text-klaz-faint">
                          new
                        </span>
                      )}
                    </div>
                    <RemoveStudentButton
                      classId={classId}
                      studentId={s.id}
                      studentName={s.name}
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Right column: heatmap + recent sessions */}
        <div className="flex flex-col gap-3.5">
          <div className="rounded-xl border border-klaz-line bg-klaz-panel">
            <div className="border-b border-klaz-line2 px-4 py-3">
              <div className="text-[13px] font-semibold text-klaz-ink">
                Topic heatmap
              </div>
              <div className="text-[11.5px] text-klaz-muted">
                Class-average per topic · weakest first
              </div>
            </div>
            <div className="px-4 pb-3.5 pt-2">
              {topicHeatmap.length === 0 ? (
                <p className="py-6 text-center text-[12.5px] text-klaz-muted">
                  No topic data yet. Scores appear after students start asking
                  questions.
                </p>
              ) : (
                <ul>
                  {topicHeatmap.map((t, i) => (
                    <li
                      key={t.topic}
                      className={cn(
                        "py-2",
                        i < topicHeatmap.length - 1 &&
                          "border-b border-klaz-line2"
                      )}
                    >
                      <div className="flex items-center justify-between text-[12.5px]">
                        <span className="truncate text-klaz-ink">
                          {t.topic}
                        </span>
                        <span className="font-mono text-[11px] text-klaz-muted">
                          {t.avg} · {t.count}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-[3px] bg-klaz-line2">
                        <div
                          className="h-full"
                          style={{
                            width: `${t.avg}%`,
                            background: scoreHex(t.avg),
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-klaz-line bg-klaz-panel">
            <div className="flex items-center justify-between border-b border-klaz-line2 px-4 py-3">
              <div className="text-[13px] font-semibold text-klaz-ink">
                Recent sessions
              </div>
              {activeSessionId ? (
                <Link
                  href={`/dashboard/session/${activeSessionId}`}
                  className="text-[11px] font-medium text-klaz-accent hover:underline"
                >
                  See live →
                </Link>
              ) : null}
            </div>
            {recentSessions.length === 0 ? (
              <p className="py-6 text-center text-[12.5px] text-klaz-muted">
                No sessions yet.
              </p>
            ) : (
              <ul>
                {recentSessions.map((s, i) => (
                  <li
                    key={s.id}
                    className={cn(
                      i < recentSessions.length - 1 &&
                        "border-b border-klaz-line2"
                    )}
                  >
                    <Link
                      href={`/dashboard/session/${s.id}`}
                      className="flex items-center gap-2.5 px-4 py-2.5 transition hover:bg-klaz-line2/40"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] font-medium text-klaz-ink">
                          {s.title}
                        </div>
                        <div className="mt-[1px] text-[11px] text-klaz-muted">
                          {formatDateTime(s.started_at)} ·{" "}
                          {formatDuration(
                            s.started_at,
                            s.ended_at ?? undefined
                          )}
                        </div>
                      </div>
                      {s.status === "active" ? (
                        <Chip tone="live" mono>
                          ● LIVE
                        </Chip>
                      ) : (
                        <span
                          className="text-[11px] text-klaz-faint"
                          aria-hidden
                        >
                          ↗
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
