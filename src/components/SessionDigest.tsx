"use client"

import { useState } from "react"
import { toast } from "sonner"
import { cn, formatDateTime } from "@/lib/utils"

type SessionMeta = {
  id: string
  title: string
  status: "active" | "ended"
  startedAt: string
  endedAt: string | null
  durationMinutes: number | null
  className: string
  subject: string
  grade: string | null
}

type TopicStat = {
  topic: string
  total: number
  confused: number
  students: number
  confusionPct: number
}

type StudentStat = {
  id: string
  name: string
  avg: number | null
  msgCount: number
  confusedCount: number
}

type QuestionEntry = {
  id: string
  text: string
  who: string
  topic: string | null
  confused: boolean
  at: string
}

type PracticeEntry = {
  id: string
  studentId: string
  status: "pending" | "approved" | "sent"
  assignedAt: string | null
  completedAt: string | null
  topics: string[]
  studentName: string
  itemCount: number
}

// Printable post-session digest. Layout is tuned for both screen and A4:
// @media print hides the toolbar, softens the background, and keeps the
// left margin so notes can be scribbled in. The copy button serializes a
// plain-text version friendly to WhatsApp / email — not markdown, not HTML,
// just the kind of recap a teacher would actually paste into a group chat.

export function SessionDigest({
  session,
  topics,
  atRisk,
  topStudents,
  questions,
  practice,
  messageCount,
  activeStudents,
  rosterSize,
}: {
  session: SessionMeta
  topics: TopicStat[]
  atRisk: StudentStat[]
  topStudents: StudentStat[]
  questions: QuestionEntry[]
  practice: PracticeEntry[]
  messageCount: number
  activeStudents: number
  rosterSize: number
}) {
  const [copied, setCopied] = useState(false)

  const dateLine = `${formatDateTime(session.startedAt)}${
    session.durationMinutes ? ` · ${session.durationMinutes} min` : ""
  }`

  async function copyDigest() {
    const lines: string[] = []
    lines.push(`${session.className} — ${session.title}`)
    lines.push(dateLine)
    lines.push("")
    lines.push(
      `• ${activeStudents} of ${rosterSize} students engaged · ${messageCount} questions asked`
    )
    if (topics.length > 0) {
      lines.push("")
      lines.push("Topics that came up:")
      for (const t of topics.slice(0, 5)) {
        lines.push(
          `  • ${t.topic} — ${t.total} question${t.total === 1 ? "" : "s"}${
            t.confusionPct > 0 ? `, ${t.confusionPct}% confused` : ""
          }`
        )
      }
    }
    if (atRisk.length > 0) {
      lines.push("")
      lines.push("Needs a check-in:")
      for (const s of atRisk) {
        lines.push(
          `  • ${s.name} — ${s.avg}% avg${
            s.confusedCount > 0
              ? ` · ${s.confusedCount} confused moment${
                  s.confusedCount === 1 ? "" : "s"
                }`
              : ""
          }`
        )
      }
    }
    if (topStudents.length > 0) {
      lines.push("")
      lines.push("Leading the class:")
      for (const s of topStudents) {
        lines.push(`  • ${s.name} — ${s.avg}% avg`)
      }
    }
    if (practice.length > 0) {
      const assigned = practice.filter((p) => p.status === "sent").length
      const completed = practice.filter((p) => p.completedAt).length
      lines.push("")
      lines.push(
        `Practice: ${practice.length} set${
          practice.length === 1 ? "" : "s"
        } generated · ${assigned} assigned · ${completed} completed`
      )
    }
    lines.push("")
    lines.push("— Klaz")
    const text = lines.join("\n")
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success("Digest copied — paste anywhere")
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error("Could not copy — try print instead")
    }
  }

  return (
    <article className="mt-3">
      {/* Toolbar — hidden on print. */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-klaz-faint">
            {session.status === "ended" ? "Session digest" : "Live digest"}
          </div>
          <h1 className="mt-1 font-serif text-[34px] font-normal leading-none tracking-[-0.02em] text-klaz-ink sm:text-[40px]">
            {session.title}
            <span className="text-klaz-accent">.</span>
          </h1>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={copyDigest}
            className={cn(
              "rounded-md border px-3 py-1.5 text-[13px] font-medium transition",
              copied
                ? "border-klaz-ok/40 bg-klaz-ok-bg text-klaz-ok"
                : "border-klaz-line bg-klaz-panel2 text-klaz-ink2 hover:bg-klaz-line2"
            )}
          >
            {copied ? "Copied ✓" : "Copy text"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md bg-klaz-ink px-3 py-1.5 text-[13px] font-medium text-klaz-bg transition hover:bg-klaz-ink2"
          >
            Print / PDF
          </button>
        </div>
      </div>

      {/* Print-only header: bigger title, no toolbar. */}
      <header className="hidden border-b border-klaz-line pb-3 print:block">
        <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-klaz-faint">
          Session digest
        </div>
        <h1 className="mt-1 font-serif text-[28px] leading-none tracking-[-0.02em] text-klaz-ink">
          {session.title}
        </h1>
      </header>

      <div className="rounded-lg border border-klaz-line bg-klaz-panel p-5 sm:p-6 print:border-0 print:bg-transparent print:p-0 print:pt-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px]">
          <span className="font-serif text-[20px] leading-none tracking-[-0.01em] text-klaz-ink">
            {session.className}
          </span>
          <span className="text-klaz-muted">·</span>
          <span className="text-klaz-muted">
            {session.subject}
            {session.grade ? ` · ${session.grade}` : ""}
          </span>
          <span className="text-klaz-muted">·</span>
          <span className="font-mono text-[11.5px] text-klaz-faint">
            {dateLine}
          </span>
        </div>

        {/* Headline KPI strip */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label="Engaged"
            value={`${activeStudents}/${rosterSize}`}
            hint="students asked"
          />
          <Stat label="Questions" value={String(messageCount)} hint="asked" />
          <Stat
            label="Topics"
            value={String(topics.length)}
            hint="surfaced"
          />
          <Stat
            label="Practice"
            value={String(practice.length)}
            hint={`sets · ${
              practice.filter((p) => p.status === "sent").length
            } assigned`}
          />
        </div>

        {/* Topics that came up */}
        <Section title="Topics that came up">
          {topics.length === 0 ? (
            <EmptyLine>No topics tagged.</EmptyLine>
          ) : (
            <ul className="divide-y divide-klaz-line2">
              {topics.slice(0, 8).map((t) => (
                <li
                  key={t.topic}
                  className="flex flex-wrap items-center justify-between gap-2 py-1.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="font-serif text-[16px] italic text-klaz-ink">
                      {t.topic}
                    </span>
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-klaz-faint">
                      {t.total} question{t.total === 1 ? "" : "s"} ·{" "}
                      {t.students} student{t.students === 1 ? "" : "s"}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-[1px] font-mono text-[10px] font-medium",
                      t.confusionPct >= 40
                        ? "border-[#ebcc91] bg-klaz-warn-bg text-klaz-warn"
                        : t.confusionPct > 0
                        ? "border-klaz-line bg-klaz-line2 text-klaz-ink2"
                        : "border-[#cfdcae] bg-klaz-ok-bg text-klaz-ok"
                    )}
                  >
                    {t.confusionPct}% confused
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Needs a check-in + Leading the class */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Section title="Needs a check-in" compact>
            {atRisk.length === 0 ? (
              <EmptyLine>Nobody under 65% avg — nice.</EmptyLine>
            ) : (
              <ul className="space-y-1.5">
                {atRisk.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between text-[13px]"
                  >
                    <span className="font-medium text-klaz-ink">{s.name}</span>
                    <span className="font-mono text-[11.5px] text-klaz-accent">
                      {s.avg}% · {s.confusedCount} confused
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Leading the class" compact>
            {topStudents.length === 0 ? (
              <EmptyLine>Not enough scores yet.</EmptyLine>
            ) : (
              <ul className="space-y-1.5">
                {topStudents.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between text-[13px]"
                  >
                    <span className="font-medium text-klaz-ink">{s.name}</span>
                    <span className="font-mono text-[11.5px] text-klaz-ok">
                      {s.avg}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        {/* Questions highlight */}
        <Section title="Questions worth revisiting">
          {questions.length === 0 ? (
            <EmptyLine>No questions logged in this session.</EmptyLine>
          ) : (
            <ol className="space-y-2">
              {questions.map((q, idx) => (
                <li
                  key={q.id}
                  className={cn(
                    "rounded-md border px-3 py-2 text-[13px]",
                    q.confused
                      ? "border-klaz-accent/25 bg-klaz-accent-bg/40"
                      : "border-klaz-line2 bg-klaz-panel2"
                  )}
                >
                  <div className="mb-0.5 flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.08em] text-klaz-faint">
                    <span>
                      {idx + 1}. {q.who}
                      {q.topic ? (
                        <>
                          {" · "}
                          <span className="font-serif normal-case tracking-normal italic">
                            {q.topic}
                          </span>
                        </>
                      ) : null}
                    </span>
                    {q.confused ? (
                      <span className="rounded-full bg-klaz-accent px-1.5 py-[1px] text-[9.5px] font-semibold uppercase tracking-[0.06em] text-white">
                        confused
                      </span>
                    ) : null}
                  </div>
                  <p className="text-klaz-ink">{q.text}</p>
                </li>
              ))}
            </ol>
          )}
        </Section>

        {/* Practice roll-up */}
        <Section title="Follow-up practice">
          {practice.length === 0 ? (
            <EmptyLine>
              No practice sets generated yet — this runs once the session ends.
            </EmptyLine>
          ) : (
            <ul className="divide-y divide-klaz-line2">
              {practice.map((p) => {
                const state = p.completedAt
                  ? "completed"
                  : p.status === "sent"
                  ? "assigned"
                  : p.status === "approved"
                  ? "ready"
                  : "needs review"
                const tone =
                  state === "completed"
                    ? "bg-klaz-ok-bg text-klaz-ok border-[#cfdcae]"
                    : state === "assigned"
                    ? "bg-klaz-line2 text-klaz-ink2 border-klaz-line"
                    : state === "ready"
                    ? "bg-klaz-accent-bg text-klaz-accent border-[#eac3b1]"
                    : "bg-klaz-warn-bg text-klaz-warn border-[#ebcc91]"
                return (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-[13px]"
                  >
                    <div className="min-w-0">
                      <span className="font-medium text-klaz-ink">
                        {p.studentName}
                      </span>
                      <span className="ml-1 text-klaz-muted">
                        · {p.itemCount} question{p.itemCount === 1 ? "" : "s"}
                        {p.topics.length > 0
                          ? ` · ${p.topics.join(", ")}`
                          : ""}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-[1px] font-mono text-[9.5px] font-medium uppercase tracking-[0.08em]",
                        tone
                      )}
                    >
                      {state}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </Section>

        <div className="mt-6 border-t border-klaz-line pt-3 font-mono text-[10.5px] uppercase tracking-[0.08em] text-klaz-faint">
          Generated by Klaz · {formatDateTime(new Date().toISOString())}
        </div>
      </div>
    </article>
  )
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-md border border-klaz-line bg-klaz-panel2 px-3 py-2 print:border-klaz-line">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-klaz-faint">
        {label}
      </div>
      <div className="mt-0.5 font-serif text-[24px] leading-none tracking-[-0.01em] text-klaz-ink">
        {value}
      </div>
      {hint ? (
        <div className="mt-0.5 text-[11px] text-klaz-muted">{hint}</div>
      ) : null}
    </div>
  )
}

function Section({
  title,
  compact,
  children,
}: {
  title: string
  compact?: boolean
  children: React.ReactNode
}) {
  return (
    <section className={compact ? "mt-0" : "mt-5"}>
      <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-klaz-faint">
        {title}
      </div>
      {children}
    </section>
  )
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="text-[12.5px] text-klaz-muted">{children}</p>
}
