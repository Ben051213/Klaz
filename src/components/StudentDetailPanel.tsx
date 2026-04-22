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

type StudentSummary = {
  strengths: string[]
  weaknesses: string[]
  topics_covered: string[]
  recommended_focus: string
  overall: string
}

const EMPTY_SUMMARY: StudentSummary = {
  strengths: [],
  weaknesses: [],
  topics_covered: [],
  recommended_focus: "",
  overall: "",
}

function SummarySection({
  label,
  items,
  tone = "neutral",
}: {
  label: string
  items: string[]
  tone?: "strong" | "weak" | "neutral"
}) {
  if (items.length === 0) return null
  const dot =
    tone === "strong"
      ? "bg-emerald-500"
      : tone === "weak"
      ? "bg-red-500"
      : "bg-slate-400"
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <ul className="mt-1 space-y-1 text-sm text-slate-700">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2">
            <span
              className={`mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${dot}`}
            />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  )
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
  const [summary, setSummary] = useState<StudentSummary | null>(null)
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
      .then((data: { summary?: Partial<StudentSummary> }) => {
        if (cancelled) return
        setSummary({ ...EMPTY_SUMMARY, ...(data.summary ?? {}) })
      })
      .catch(() =>
        setSummary({ ...EMPTY_SUMMARY, overall: "Summary unavailable." })
      )
      .finally(() => {
        if (!cancelled) setLoadingSummary(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionId, studentId])

  const hasAnySummary =
    summary &&
    (summary.overall ||
      summary.strengths.length ||
      summary.weaknesses.length ||
      summary.topics_covered.length ||
      summary.recommended_focus)

  return (
    <div className="mt-3 space-y-4 rounded-lg border border-slate-100 bg-slate-50/60 p-4">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          AI summary
        </h4>
        {loadingSummary || !summary ? (
          <div className="mt-2 space-y-2">
            <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
          </div>
        ) : !hasAnySummary ? (
          <p className="mt-1 text-sm text-slate-500">Nothing to summarize yet.</p>
        ) : (
          <div className="mt-2 space-y-3">
            {summary.overall ? (
              <p className="text-sm text-slate-800">{summary.overall}</p>
            ) : null}
            <SummarySection
              label="Strengths"
              items={summary.strengths}
              tone="strong"
            />
            <SummarySection
              label="Weaknesses"
              items={summary.weaknesses}
              tone="weak"
            />
            <SummarySection
              label="Topics covered"
              items={summary.topics_covered}
              tone="neutral"
            />
            {summary.recommended_focus ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Recommended focus
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {summary.recommended_focus}
                </p>
              </div>
            ) : null}
          </div>
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
                    {m.topics?.length ? ` · ${m.topics.join(", ")}` : ""}
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
