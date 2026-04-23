"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { cn, formatRelative } from "@/lib/utils"

// StudentTopicResolver — lets the teacher manually resolve or nudge a
// topic score for a single student. Primary use case: teacher pulls
// the kid aside after class, talks them through a confusing bit, and
// marks the topic "resolved" so it stops flagging as weak. We stamp
// `teacher_override_at` so the AI tagger won't flip it back within 14
// days (see upsertTopicScore).
//
// The component is deliberately loud about which action you clicked —
// we want teachers to feel confident that "resolve" means "this is
// fixed, stop nagging me". Pending state keeps the row disabled while
// the request flies.

type TopicRow = {
  topic: string
  score: number
  teacher_override_at: string | null
  teacher_note: string | null
  last_updated: string | null
}

type Action = "resolve" | "improve" | "reset"

export function StudentTopicResolver({
  classId,
  studentId,
  topics,
}: {
  classId: string
  studentId: string
  topics: TopicRow[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busyTopic, setBusyTopic] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function runAction(topic: string, action: Action) {
    setError(null)
    setBusyTopic(topic)
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/classes/${classId}/students/${studentId}/topics`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topic, action }),
          }
        )
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string
          }
          throw new Error(data.error ?? `HTTP ${res.status}`)
        }
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed")
      } finally {
        setBusyTopic(null)
      }
    })
  }

  if (topics.length === 0) {
    return (
      <p className="text-[12.5px] text-klaz-muted">
        No topic scores yet. As the student asks questions, Klaz will tag
        them and populate this list automatically.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <div className="rounded-md border border-klaz-bad/40 bg-klaz-bad-bg px-3 py-2 text-[12.5px] text-klaz-bad">
          {error}
        </div>
      ) : null}
      {topics.map((t) => {
        const tone = scoreTone(t.score)
        const locked = Boolean(t.teacher_override_at)
        const isBusy = pending && busyTopic === t.topic
        return (
          <div
            key={t.topic}
            className="rounded-lg border border-klaz-line bg-klaz-panel p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cn(
                      "inline-block h-2 w-2 shrink-0 rounded-full",
                      tone === "ok" && "bg-klaz-ok",
                      tone === "warn" && "bg-klaz-warn",
                      tone === "bad" && "bg-klaz-bad"
                    )}
                  />
                  <span className="truncate text-[14px] font-medium text-klaz-ink">
                    {t.topic}
                  </span>
                  {locked ? (
                    <span
                      title={`Locked by you on ${formatRelative(
                        t.teacher_override_at
                      )} — AI won't override for 14 days.`}
                      className="inline-flex items-center gap-1 rounded-full bg-klaz-accent-bg px-1.5 py-[1px] font-mono text-[9.5px] uppercase tracking-[0.08em] text-klaz-accent2"
                    >
                      ◎ Locked
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-klaz-line2">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      tone === "ok" && "bg-klaz-ok",
                      tone === "warn" && "bg-klaz-warn",
                      tone === "bad" && "bg-klaz-bad"
                    )}
                    style={{ width: `${Math.max(4, t.score)}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-klaz-faint">
                  <span>{t.score}/100</span>
                  {t.last_updated ? (
                    <>
                      <span>·</span>
                      <span>updated {formatRelative(t.last_updated)}</span>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => runAction(t.topic, "resolve")}
                  className="inline-flex items-center gap-1 rounded-md bg-klaz-ok-bg px-2.5 py-1 text-[11.5px] font-medium text-klaz-ok transition hover:bg-klaz-ok/20 disabled:cursor-wait disabled:opacity-60"
                >
                  ✓ Resolve
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => runAction(t.topic, "improve")}
                  className="inline-flex items-center gap-1 rounded-md bg-klaz-warn-bg px-2.5 py-1 text-[11.5px] font-medium text-klaz-warn transition hover:bg-klaz-warn/20 disabled:cursor-wait disabled:opacity-60"
                >
                  ↑ Improving
                </button>
                <button
                  type="button"
                  disabled={isBusy || !locked}
                  onClick={() => runAction(t.topic, "reset")}
                  title={
                    locked
                      ? "Release the lock and let the AI score this topic again."
                      : "No override to release."
                  }
                  className="inline-flex items-center gap-1 rounded-md border border-klaz-line bg-klaz-panel2 px-2.5 py-1 text-[11.5px] font-medium text-klaz-ink2 transition hover:bg-klaz-line2 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function scoreTone(score: number): "ok" | "warn" | "bad" {
  if (score >= 70) return "ok"
  if (score >= 50) return "warn"
  return "bad"
}
