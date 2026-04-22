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
      ? "bg-klaz-ok"
      : tone === "weak"
        ? "bg-klaz-bad"
        : "bg-klaz-faint"
  return (
    <div>
      <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-klaz-faint">
        {label}
      </p>
      <ul className="mt-1 space-y-1 text-[13px] text-klaz-ink2">
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
    <div className="space-y-4 rounded-lg border border-klaz-line2 bg-klaz-panel p-4 text-klaz-ink">
      <div>
        <h4 className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-klaz-faint">
          AI summary
        </h4>
        {loadingSummary || !summary ? (
          <div className="mt-2 space-y-2">
            <div className="h-3 w-2/3 animate-pulse rounded bg-klaz-line2" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-klaz-line2" />
          </div>
        ) : !hasAnySummary ? (
          <p className="mt-1 text-[13px] text-klaz-muted">
            Nothing to summarize yet.
          </p>
        ) : (
          <div className="mt-2 space-y-3">
            {summary.overall ? (
              <p className="text-[13px] leading-[1.55] text-klaz-ink">
                {summary.overall}
              </p>
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
                <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-klaz-faint">
                  Recommended focus
                </p>
                <p className="mt-1 text-[13px] text-klaz-ink2">
                  {summary.recommended_focus}
                </p>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {topicScores.length > 0 ? (
        <div>
          <h4 className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-klaz-faint">
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
        <h4 className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-klaz-faint">
          {studentName}&apos;s questions
        </h4>
        {messages.length === 0 ? (
          <p className="mt-1 text-[12px] text-klaz-muted">No questions yet.</p>
        ) : (
          <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1 text-[13px]">
            {messages.map((m) => (
              <li
                key={m.id}
                className="rounded-md border border-klaz-line2 bg-klaz-panel2 p-2"
              >
                <p className="text-klaz-ink">{m.student_text}</p>
                {m.confidence_signal ? (
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.06em] text-klaz-faint">
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
