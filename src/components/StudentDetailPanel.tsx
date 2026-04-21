"use client"

import { useEffect, useState } from "react"
import { TopicScoreBar } from "@/components/TopicScoreBar"

type Message = {
  id: string
  student_text: string
  ai_response: string | null
  confidence_signal: string | null
  topics: string[] | null
}

export function StudentDetailPanel({
  sessionId,
  studentId,
  studentName,
  topicScores,
  messages,
}: {
  sessionId: string
  studentId: string
  studentName: string
  topicScores: { topic: string; score: number }[]
  messages: Message[]
}) {
  const [summary, setSummary] = useState<string | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoadingSummary(true)
    fetch(`/api/sessions/${sessionId}/summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setSummary(data.summary || "Summary unavailable.")
      })
      .catch(() => setSummary("Summary unavailable."))
      .finally(() => {
        if (!cancelled) setLoadingSummary(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionId, studentId])

  return (
    <div className="mt-3 space-y-4 rounded-lg border border-slate-100 bg-slate-50/60 p-4">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          AI summary
        </h4>
        {loadingSummary ? (
          <div className="mt-1 h-12 animate-pulse rounded bg-slate-100" />
        ) : (
          <p className="mt-1 text-sm text-slate-700">{summary}</p>
        )}
      </div>

      {topicScores.length > 0 ? (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Topic scores
          </h4>
          <div className="mt-2 space-y-2">
            {topicScores.map((t) => (
              <TopicScoreBar key={t.topic} topic={t.topic} score={t.score} />
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {studentName}&apos;s questions
        </h4>
        {messages.length === 0 ? (
          <p className="mt-1 text-xs text-slate-500">No questions yet.</p>
        ) : (
          <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1 text-sm">
            {messages.map((m) => (
              <li
                key={m.id}
                className="rounded-md border border-slate-100 bg-white p-2"
              >
                <p className="text-slate-800">{m.student_text}</p>
                {m.confidence_signal ? (
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
                    {m.confidence_signal}
                    {m.topics?.length
                      ? ` · ${m.topics.join(", ")}`
                      : ""}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
