"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn, scoreToColor } from "@/lib/utils"

type Student = { id: string; name: string; email: string }
type ScoreRow = { student_id: string; topic: string; score: number }
type MessageCountRow = { student_id: string; question_count: number }
type SessionRow = {
  id: string
  title: string
  status: "active" | "ended"
  started_at: string
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
        "rounded-full px-3 py-1 text-xs font-medium transition",
        active
          ? "bg-brand-navy text-white shadow-sm"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      )}
    >
      {label}
    </button>
  )
}

export function ClassAnalytics({
  roster,
  scores,
  messageCounts,
  activeSessionId,
}: {
  roster: Student[]
  scores: ScoreRow[]
  messageCounts: MessageCountRow[]
  activeSessionId?: string | null
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
      // Students with no data fall to the bottom so the teacher sees real signal first.
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

  // Class-wide topic heatmap: average score per topic across all students,
  // lowest first so the teacher sees what the class is struggling with.
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

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="bg-white">
          <CardContent className="py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Class average
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-brand-navy">
              {classAvg ?? "—"}
            </p>
            <p className="text-xs text-slate-500">
              across {studentsWithSignal} student
              {studentsWithSignal === 1 ? "" : "s"} with activity
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Topics tracked
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-brand-navy">
              {topicHeatmap.length}
            </p>
            <p className="text-xs text-slate-500">
              unique topics surfaced so far
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Questions asked
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-brand-navy">
              {stats.reduce((sum, s) => sum + s.questions, 0)}
            </p>
            <p className="text-xs text-slate-500">all students, all sessions</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base text-brand-navy">
              Student rankings
            </CardTitle>
            <p className="text-xs text-slate-500">
              {sort === "weakest"
                ? "Who needs the most help?"
                : sort === "strongest"
                ? "Who's mastering the material?"
                : "Who's engaging the most?"}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
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
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No students yet. Share the join code to get started.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {sorted.map((s, idx) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 py-3 text-sm"
                >
                  <span className="w-5 text-right text-xs tabular-nums text-slate-400">
                    {idx + 1}
                  </span>
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-brand-navy/10 text-xs font-semibold text-brand-navy">
                      {s.name.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-800">
                      {s.name}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                      <span>{s.questions} questions</span>
                      <span>
                        {s.topicCount} topic{s.topicCount === 1 ? "" : "s"}
                      </span>
                      {/* Only surface a "weakest" topic if it's actually
                           weak (< 70). If the lowest-scored topic is
                           already at 70+, the student is strong across
                           the board and calling out a "weakest" would be
                           misleading. Same logic in reverse for strongest:
                           below 50 means everything's weak, so there's no
                           real "strength" to celebrate. */}
                      {s.weakest && s.weakest.score < 70 ? (
                        <span>
                          weakest:{" "}
                          <span className="font-medium text-red-600">
                            {s.weakest.topic} ({s.weakest.score})
                          </span>
                        </span>
                      ) : null}
                      {s.strongest &&
                      s.strongest.score >= 50 &&
                      s.strongest.topic !== s.weakest?.topic ? (
                        <span>
                          strongest:{" "}
                          <span className="font-medium text-emerald-600">
                            {s.strongest.topic} ({s.strongest.score})
                          </span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {s.avg !== null ? (
                    <Badge
                      className={cn(
                        s.avg >= 70
                          ? "bg-emerald-500 hover:bg-emerald-500"
                          : s.avg >= 40
                          ? "bg-amber-500 hover:bg-amber-500"
                          : "bg-red-500 hover:bg-red-500"
                      )}
                    >
                      {s.avg}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">—</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-base text-brand-navy">
            Topic heatmap
          </CardTitle>
          <p className="text-xs text-slate-500">
            Class-average score per topic — lowest first, so you can see what
            to revisit.
          </p>
        </CardHeader>
        <CardContent>
          {topicHeatmap.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              No topic data yet. Scores appear after students start asking
              questions.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {topicHeatmap.map((t) => (
                <li key={t.topic}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate font-medium text-slate-700">
                      {t.topic}
                    </span>
                    <span className="tabular-nums text-slate-500">
                      {t.avg} · {t.count} student{t.count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        scoreToColor(t.avg)
                      )}
                      style={{ width: `${t.avg}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {activeSessionId ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm">
          A session is live right now —{" "}
          <Link
            href={`/dashboard/session/${activeSessionId}`}
            className="font-semibold text-emerald-700 underline underline-offset-2"
          >
            jump to class pulse
          </Link>{" "}
          for real-time signals.
        </div>
      ) : null}
    </div>
  )
}
