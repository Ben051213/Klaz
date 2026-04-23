"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { PulseConstellation } from "@/components/klaz/PulseConstellation"
import { StudentDetailPanel } from "@/components/StudentDetailPanel"
import { createClient } from "@/lib/supabase/client"
import { cn, formatDuration } from "@/lib/utils"
import type { TopicConfusion } from "@/lib/types"

// Full-bleed dark "Klaz pulse" surface — rendered when a teacher enters a
// session. Three columns on desktop:
//   LEFT   live student list, sorted by who's most stuck
//   CENTER Class Pulse constellation (topic bubbles by confusion × volume)
//   RIGHT  streaming question feed
//
// Collapses to a single scrolling column on narrow screens so it still
// works on a phone at the back of the room.

type RosterStudent = { id: string; name: string; email: string }

type SessionProps = {
  id: string
  title: string
  status: "active" | "ended"
  classId: string
  className: string
  subject: string
  joinCode: string
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

type StudentState = "stuck" | "slow" | "ok" | "lead" | "idle"

function stateForStudent(opts: {
  avg: number | null
  recentConfused: boolean
  recentCount: number
}): StudentState {
  if (opts.recentCount === 0) return "idle"
  if (opts.recentConfused) return "stuck"
  if (opts.avg !== null && opts.avg >= 85) return "lead"
  if (opts.avg !== null && opts.avg < 55) return "slow"
  return "ok"
}

const stateTone: Record<StudentState, string> = {
  stuck: "#b84a2b",
  slow: "#d9a24a",
  ok: "rgba(246,241,231,0.55)",
  lead: "#9fc07f",
  idle: "rgba(246,241,231,0.3)",
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 45_000) return "just now"
  const m = Math.floor(diff / 60_000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h`
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
  // Track per-student stuck transitions so we can surface a toast + pulse
  // only when someone newly becomes stuck — re-renders shouldn't re-fire.
  const prevStateRef = useRef<Map<string, StudentState>>(new Map())
  const hasSeededPrevRef = useRef(false)
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set())

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
    const byTopic = new Map<string, { confused: number; total: number }>()
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

  // The left-column "students live" list — sort by state severity then recency.
  type RosterRow = {
    student: RosterStudent
    state: StudentState
    topic: string | null
    last: string
    confusionPct: number
    avg: number | null
    msgCount: number
    lastTs: number
  }
  const rosterRows: RosterRow[] = useMemo(() => {
    return roster
      .map((st) => {
        const msgs = messagesByStudent.get(st.id) ?? []
        const last = msgs[msgs.length - 1]
        const confusedRecent = msgs
          .slice(-3)
          .some((m) => m.confidence_signal === "confused")
        const avg = overallScore(st.id)
        const confusedTotal = msgs.filter(
          (m) => m.confidence_signal === "confused"
        ).length
        const confusionPct =
          msgs.length > 0
            ? Math.round((confusedTotal / msgs.length) * 100)
            : 0
        return {
          student: st,
          state: stateForStudent({
            avg,
            recentConfused: confusedRecent,
            recentCount: msgs.length,
          }),
          topic: last?.topics?.[0] ?? null,
          last: last ? timeAgo(last.created_at) : "—",
          confusionPct,
          avg,
          msgCount: msgs.length,
          lastTs: last ? new Date(last.created_at).getTime() : 0,
        }
      })
      .sort((a, b) => {
        const order: StudentState[] = ["stuck", "slow", "ok", "lead", "idle"]
        const oa = order.indexOf(a.state)
        const ob = order.indexOf(b.state)
        if (oa !== ob) return oa - ob
        return b.lastTs - a.lastTs
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster, messagesByStudent, scoresByStudent])

  // Watch rosterRows for non-stuck → stuck transitions. Fire toast + flash
  // the row for 15s. The first pass seeds the map so existing stuck
  // students on page load don't spam toasts; only new transitions after
  // that trigger the alert.
  useEffect(() => {
    const prev = prevStateRef.current
    if (!hasSeededPrevRef.current) {
      for (const r of rosterRows) prev.set(r.student.id, r.state)
      hasSeededPrevRef.current = true
      return
    }
    const newlyStuck: RosterRow[] = []
    for (const r of rosterRows) {
      const before = prev.get(r.student.id)
      if (r.state === "stuck" && before !== "stuck") newlyStuck.push(r)
      prev.set(r.student.id, r.state)
    }
    if (newlyStuck.length === 0) return
    // Only alert live — once a session ends, backfilling confusions shouldn't
    // toast the teacher after the fact.
    if (sessionStatus !== "active") return
    setFlaggedIds((prevSet) => {
      const next = new Set(prevSet)
      for (const r of newlyStuck) next.add(r.student.id)
      return next
    })
    for (const r of newlyStuck) {
      const name = r.student.name.split(" ")[0] || "A student"
      const topicLabel = r.topic ? ` on ${r.topic}` : ""
      toast.error(`${name} is stuck${topicLabel}`, {
        description: "Tap the row to open their detail panel.",
        action: {
          label: "Open",
          onClick: () => setExpanded(r.student.id),
        },
      })
    }
    // Auto-clear each flag after 15s.
    const timers = newlyStuck.map((r) =>
      setTimeout(() => {
        setFlaggedIds((prevSet) => {
          if (!prevSet.has(r.student.id)) return prevSet
          const next = new Set(prevSet)
          next.delete(r.student.id)
          return next
        })
      }, 15_000)
    )
    return () => {
      for (const t of timers) clearTimeout(t)
    }
  }, [rosterRows, sessionStatus])

  const onlineCount = rosterRows.filter((r) => r.msgCount > 0).length
  const questionsLive = messages.length

  // Right column feed — reverse chronological, most recent first.
  type FeedRow = {
    id: string
    who: string
    q: string
    topic: string
    ago: string
    hot: boolean
  }
  const feed: FeedRow[] = useMemo(() => {
    const byStudent = new Map(roster.map((r) => [r.id, r.name] as const))
    return [...messages]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice(0, 40)
      .map((m) => ({
        id: m.id,
        who: (byStudent.get(m.student_id) ?? "Student").split(" ")[0],
        q: m.student_text,
        topic: m.topics?.[0] ?? "general",
        ago: timeAgo(m.created_at),
        hot: m.confidence_signal === "confused",
      }))
  }, [messages, roster])

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

  const isLive = sessionStatus === "active"

  return (
    <div
      className="flex w-full flex-col overflow-hidden text-klaz-bg min-h-[calc(100dvh-49px)] lg:min-h-screen"
      style={{ background: "#2a2520" }}
    >
      {/* Dark sub-topbar with LIVE dot, session title, join code, actions. */}
      <div
        className="flex flex-wrap items-center gap-3 border-b border-[rgba(246,241,231,0.08)] px-4 py-3 sm:px-6"
        style={{ background: "rgba(0,0,0,0.25)" }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              isLive ? "animate-pulse" : ""
            )}
            style={{
              background: isLive ? "#b84a2b" : "rgba(246,241,231,0.4)",
              boxShadow: isLive ? "0 0 0 4px rgba(184,74,43,0.25)" : undefined,
            }}
            aria-hidden
          />
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[rgba(246,241,231,0.6)]">
            {isLive ? `LIVE · ${elapsed}` : `ENDED · ${elapsed}`}
          </span>
        </div>
        <div className="font-serif text-[18px] leading-none tracking-[-0.01em] md:text-[20px]">
          {session.className}
          {" · "}
          <span className="italic text-[rgba(246,241,231,0.55)]">
            {session.title}
          </span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11.5px] text-[rgba(246,241,231,0.55)]">
            Join:{" "}
            <span className="ml-1 rounded-full bg-[rgba(246,241,231,0.08)] px-2 py-[2px] tracking-[0.06em] text-klaz-bg">
              {session.joinCode}
            </span>
          </span>
          {isLive ? (
            <button
              type="button"
              onClick={endSession}
              disabled={endingSession}
              className="rounded-md bg-klaz-accent px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-klaz-accent2 disabled:opacity-60"
            >
              {endingSession ? "Ending…" : "End session"}
            </button>
          ) : (
            <span className="rounded-md border border-[rgba(246,241,231,0.2)] px-3 py-1 text-[12px] text-[rgba(246,241,231,0.55)]">
              Read-only review
            </span>
          )}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_1.5fr_1fr]">
        {/* LEFT — students live */}
        <section className="flex min-h-0 flex-col border-b border-[rgba(246,241,231,0.08)] lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <div>
              <div className="font-serif text-[20px] leading-none">
                {onlineCount}{" "}
                <span className="text-[rgba(246,241,231,0.5)]">
                  of {roster.length}
                </span>
              </div>
              <div className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-[rgba(246,241,231,0.55)]">
                students online
              </div>
            </div>
            <div className="font-mono text-[10.5px] text-[rgba(246,241,231,0.4)]">
              sorted · confusion ↓
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            {rosterRows.length === 0 ? (
              <p className="px-3 text-[12px] text-[rgba(246,241,231,0.5)]">
                No students enrolled yet.
              </p>
            ) : (
              rosterRows.map((r) => {
                const tone = stateTone[r.state]
                const stuck = r.state === "stuck"
                const flagged = flaggedIds.has(r.student.id)
                const isOpen = expanded === r.student.id
                return (
                  <div key={r.student.id} className="mb-0.5">
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded(isOpen ? null : r.student.id)
                      }
                      className={cn(
                        "grid w-full grid-cols-[28px_1fr_60px] items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition",
                        stuck && "border",
                        flagged && "klaz-stuck-pulse"
                      )}
                      style={{
                        background: stuck
                          ? "rgba(184,74,43,0.12)"
                          : "transparent",
                        borderColor: stuck
                          ? "rgba(184,74,43,0.3)"
                          : "transparent",
                      }}
                    >
                      <div className="relative">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="bg-[rgba(246,241,231,0.08)] text-[11px] font-semibold text-klaz-bg">
                            {r.student.name.slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className="absolute -bottom-[1px] -right-[1px] h-2.5 w-2.5 rounded-full"
                          style={{
                            background: tone,
                            border: "2px solid #2a2520",
                          }}
                          aria-hidden
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[12.5px] font-medium text-klaz-bg">
                          {r.student.name}
                        </div>
                        <div className="truncate text-[10.5px] text-[rgba(246,241,231,0.55)]">
                          {r.topic ? (
                            <span
                              className="font-serif text-[12px] italic"
                              style={{ color: tone }}
                            >
                              {r.topic}
                            </span>
                          ) : (
                            <span className="font-mono text-[10.5px] text-[rgba(246,241,231,0.35)]">
                              no activity
                            </span>
                          )}
                          {r.last !== "—" ? (
                            <span className="text-[rgba(246,241,231,0.35)]">
                              {" · "}
                              {r.last}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div
                        className="text-right font-mono text-[11px]"
                        style={{ color: tone }}
                      >
                        {r.msgCount > 0 ? `${r.confusionPct}%` : "—"}
                      </div>
                    </button>
                    {isOpen ? (
                      <div className="mx-2 my-2 rounded-lg bg-[rgba(246,241,231,0.96)] p-0 text-klaz-ink">
                        <StudentDetailPanel
                          sessionId={session.id}
                          studentId={r.student.id}
                          studentName={r.student.name}
                          topicScores={
                            scoresByStudent.get(r.student.id) ?? []
                          }
                          messages={messagesByStudent.get(r.student.id) ?? []}
                        />
                      </div>
                    ) : null}
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* CENTER — Class Pulse constellation */}
        <section className="flex min-h-0 flex-col">
          <div className="flex items-end justify-between px-5 pb-1.5 pt-4 sm:px-6">
            <div>
              <div className="font-serif text-[22px] leading-none tracking-[-0.01em] md:text-[24px]">
                Class Pulse<span className="text-klaz-accent">.</span>
              </div>
              <div className="mt-0.5 text-[11.5px] text-[rgba(246,241,231,0.55)]">
                Topics plotted by{" "}
                <span className="text-klaz-bg">question volume</span> ×{" "}
                <span className="text-klaz-bg">confusion level</span>. Bigger =
                more students asking.
              </div>
            </div>
          </div>
          <div className="relative mx-4 mb-5 mt-2 flex-1 overflow-hidden sm:mx-6">
            <PulseConstellation data={topicConfusion} loading={loadingPulse} />
          </div>
        </section>

        {/* RIGHT — live question feed */}
        <section className="flex min-h-0 flex-col border-t border-[rgba(246,241,231,0.08)] lg:border-t-0 lg:border-l">
          <div className="flex items-center justify-between px-4 pb-1.5 pt-4">
            <div>
              <div className="font-serif text-[20px] leading-none">
                {questionsLive}
              </div>
              <div className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-[rgba(246,241,231,0.55)]">
                questions {isLive ? "live" : "asked"}
              </div>
            </div>
            {isLive ? (
              <div className="font-mono text-[11px] text-klaz-accent">
                ● streaming
              </div>
            ) : null}
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {feed.length === 0 ? (
              <p className="px-2 text-[12px] text-[rgba(246,241,231,0.5)]">
                No questions yet.
              </p>
            ) : (
              feed.map((q) => (
                <div
                  key={q.id}
                  className="mb-1.5 rounded-lg px-3 py-2.5"
                  style={{
                    background: q.hot
                      ? "rgba(184,74,43,0.08)"
                      : "rgba(246,241,231,0.03)",
                    border: `1px solid ${
                      q.hot
                        ? "rgba(184,74,43,0.2)"
                        : "rgba(246,241,231,0.06)"
                    }`,
                  }}
                >
                  <div className="flex items-center justify-between font-mono text-[10.5px] tracking-[0.04em] text-[rgba(246,241,231,0.55)]">
                    <span className="truncate">
                      {q.who}
                      {" · "}
                      <span className="font-serif text-[12px] italic">
                        {q.topic}
                      </span>
                    </span>
                    <span className="shrink-0">{q.ago}</span>
                  </div>
                  <div className="mt-1 text-[12.5px] leading-[1.45] text-klaz-bg">
                    {q.q}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
