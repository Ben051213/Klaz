"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ClassPulseChart } from "@/components/ClassPulseChart"
import { StudentDetailPanel } from "@/components/StudentDetailPanel"
import { createClient } from "@/lib/supabase/client"
import { formatDuration } from "@/lib/utils"
import type { TopicConfusion } from "@/lib/types"

type RosterStudent = { id: string; name: string; email: string }

type SessionProps = {
  id: string
  title: string
  status: "active" | "ended"
  classId: string
  className: string
  subject: string
  startedAt: string
  endedAt?: string
}

type MessageRow = {
  id: string
  student_id: string
  student_text: string
  ai_response: string | null
  topics: string[] | null
  confidence_signal: "confused" | "partial" | "understood" | null
  created_at: string
}

type ScoreRow = {
  student_id: string
  topic: string
  score: number
}

export function TeacherSessionView({
  session,
  roster,
}: {
  session: SessionProps
  roster: RosterStudent[]
}) {
  const router = useRouter()
  const [elapsed, setElapsed] = useState(() =>
    formatDuration(session.startedAt, session.endedAt)
  )
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [scores, setScores] = useState<ScoreRow[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [endingSession, setEndingSession] = useState(false)
  const [sessionStatus, setSessionStatus] = useState(session.status)
  const [endedAt, setEndedAt] = useState(session.endedAt)
  const [loadingPulse, setLoadingPulse] = useState(true)

  const refetch = useCallback(async () => {
    const supabase = createClient()
    const [messagesRes, scoresRes] = await Promise.all([
      supabase
        .from("messages")
        .select(
          "id, student_id, student_text, ai_response, topics, confidence_signal, created_at"
        )
        .eq("session_id", session.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("student_topic_scores")
        .select("student_id, topic, score")
        .eq("class_id", session.classId),
    ])
    if (messagesRes.data) setMessages(messagesRes.data as MessageRow[])
    if (scoresRes.data) setScores(scoresRes.data as ScoreRow[])
    setLoadingPulse(false)
  }, [session.id, session.classId])

  useEffect(() => {
    refetch()
  }, [refetch])

  useEffect(() => {
    if (sessionStatus === "ended") return
    const t = setInterval(() => {
      setElapsed(formatDuration(session.startedAt, endedAt))
    }, 1000)
    return () => clearInterval(t)
  }, [session.startedAt, endedAt, sessionStatus])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`messages-session-${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `session_id=eq.${session.id}`,
        },
        () => refetch()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [session.id, refetch])

  const topicConfusion: TopicConfusion[] = useMemo(() => {
    const byTopic = new Map<
      string,
      { confused: number; total: number }
    >()
    for (const m of messages) {
      if (!m.topics || m.topics.length === 0) continue
      for (const t of m.topics) {
        const current = byTopic.get(t) ?? { confused: 0, total: 0 }
        current.total += 1
        if (m.confidence_signal === "confused") current.confused += 1
        byTopic.set(t, current)
      }
    }
    const out: TopicConfusion[] = Array.from(byTopic.entries()).map(
      ([topic, { confused, total }]) => ({
        topic,
        confusedCount: confused,
        totalMessages: total,
        percentage: total === 0 ? 0 : Math.round((confused / total) * 100),
      })
    )
    return out.sort((a, b) => b.percentage - a.percentage)
  }, [messages])

  const messagesByStudent = useMemo(() => {
    const map = new Map<string, MessageRow[]>()
    for (const m of messages) {
      const bucket = map.get(m.student_id) ?? []
      bucket.push(m)
      map.set(m.student_id, bucket)
    }
    return map
  }, [messages])

  const scoresByStudent = useMemo(() => {
    const map = new Map<string, { topic: string; score: number }[]>()
    for (const s of scores) {
      const bucket = map.get(s.student_id) ?? []
      bucket.push({ topic: s.topic, score: s.score })
      map.set(s.student_id, bucket)
    }
    return map
  }, [scores])

  function overallScore(studentId: string): number | null {
    const s = scoresByStudent.get(studentId)
    if (!s || s.length === 0) return null
    const avg = s.reduce((sum, x) => sum + x.score, 0) / s.length
    return Math.round(avg)
  }

  async function endSession() {
    setEndingSession(true)
    const res = await fetch(`/api/sessions/${session.id}`, { method: "PATCH" })
    const data = await res.json()
    setEndingSession(false)
    if (!res.ok) {
      toast.error(data.error || "Could not end session")
      return
    }
    toast.success("Session ended — generating practice sets")
    setSessionStatus("ended")
    setEndedAt(data.session?.ended_at)
    router.refresh()
  }

  return (
    <div className="mx-auto w-full max-w-7xl gap-4 px-4 py-6 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            {session.className} · {session.subject}
          </p>
          <h1 className="text-2xl font-bold text-brand-navy">
            {session.title}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm">
            <span
              className={
                sessionStatus === "active"
                  ? "relative flex h-2 w-2"
                  : "hidden"
              }
            >
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-medium text-slate-700">
              {sessionStatus === "active" ? "Live" : "Ended"}
            </span>
            <span className="tabular-nums text-slate-400">{elapsed}</span>
          </div>
          {sessionStatus === "active" ? (
            <Button
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50"
              onClick={endSession}
              disabled={endingSession}
            >
              {endingSession ? "Ending…" : "End session"}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[40fr_60fr]">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-base text-brand-navy">
              Class pulse
            </CardTitle>
            <p className="text-xs text-slate-500">
              Where students are struggling right now.
            </p>
          </CardHeader>
          <CardContent>
            <ClassPulseChart
              data={topicConfusion}
              loading={loadingPulse}
            />
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-base text-brand-navy">
              Students ({roster.length})
            </CardTitle>
            <p className="text-xs text-slate-500">
              Click a student to see their AI summary and scores.
            </p>
          </CardHeader>
          <CardContent>
            {roster.length === 0 ? (
              <p className="text-sm text-slate-500">
                No students enrolled yet.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {roster.map((student) => {
                  const msgs = messagesByStudent.get(student.id) ?? []
                  const avg = overallScore(student.id)
                  const isOpen = expanded === student.id
                  return (
                    <li key={student.id} className="py-2">
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded(isOpen ? null : student.id)
                        }
                        className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left transition hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-brand-navy/10 text-xs font-semibold text-brand-navy">
                              {student.name.slice(0, 1).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">
                              {student.name}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {msgs.length} message
                              {msgs.length === 1 ? "" : "s"}
                            </p>
                          </div>
                        </div>
                        {avg !== null ? (
                          <Badge
                            className={
                              avg >= 70
                                ? "bg-emerald-500 hover:bg-emerald-500"
                                : avg >= 40
                                ? "bg-amber-500 hover:bg-amber-500"
                                : "bg-red-500 hover:bg-red-500"
                            }
                          >
                            {avg}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">—</Badge>
                        )}
                      </button>
                      {isOpen ? (
                        <StudentDetailPanel
                          sessionId={session.id}
                          studentId={student.id}
                          studentName={student.name}
                          topicScores={scoresByStudent.get(student.id) ?? []}
                          messages={msgs}
                        />
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
