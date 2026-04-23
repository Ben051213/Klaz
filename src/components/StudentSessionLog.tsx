"use client"

import Link from "next/link"
import { useState } from "react"
import { flavorClasses } from "@/lib/flavor"
import { cn, formatRelative } from "@/lib/utils"

// StudentSessionLog — the student's personal lesson notebook.
//
// Shows every past session where the student actually asked something
// (sessions they sat out are filtered upstream — an empty log is
// demotivating). Each row collapses by default; clicking opens the
// full ask/answer transcript so they can re-read what Klaz told them.
// The practice chip sits on the right of the session header so the
// assigned work is discoverable without another click.
//
// Only the student ever sees this surface. Teachers have their own
// roster view over in /dashboard — keeping these separate is the whole
// reason students trust Klaz.

type PracticeChip = {
  id: string
  status: "pending" | "approved" | "sent"
  completedAt: string | null
  assignedAt: string | null
  topicCount: number
  title: string | null
}

export type SessionLogEntry = {
  id: string
  title: string
  className: string
  subject: string
  flavor: string | null
  startedAt: string
  endedAt: string | null
  status: "active" | "ended"
  questions: {
    id: string
    text: string
    response: string | null
    askedAt: string
  }[]
  practice: PracticeChip | null
}

export function StudentSessionLog({
  entries,
  target,
}: {
  entries: SessionLogEntry[]
  target: number
}) {
  // Keep the first entry open by default — re-reading the most recent
  // lesson is the 80% case. Deeper history stays collapsed to keep the
  // list scannable.
  const [openId, setOpenId] = useState<string | null>(entries[0]?.id ?? null)

  if (entries.length === 0) return null

  return (
    <ul className="flex flex-col gap-2">
      {entries.map((e) => {
        const open = openId === e.id
        const flavor = flavorClasses(e.flavor)
        const hit = e.questions.length >= target
        return (
          <li
            key={e.id}
            className={cn(
              "overflow-hidden rounded-lg border bg-klaz-panel transition",
              open ? flavor.hoverBorder.replace("hover:", "") : flavor.border,
            )}
          >
            <button
              type="button"
              onClick={() => setOpenId(open ? null : e.id)}
              aria-expanded={open}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-klaz-panel2"
            >
              <span
                aria-hidden
                className={cn("h-2 w-2 shrink-0 rounded-full", flavor.dot)}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate font-serif text-[16px] leading-tight tracking-[-0.01em] text-klaz-ink">
                    {e.title}
                  </span>
                  <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-[0.08em] text-klaz-faint">
                    {formatRelative(e.startedAt)}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[11.5px] text-klaz-muted">
                  {e.className}
                  {e.subject ? ` · ${e.subject}` : ""}
                </div>
              </div>

              <QuestionBadge
                count={e.questions.length}
                target={target}
                hit={hit}
              />

              {e.practice ? (
                <PracticeChipView chip={e.practice} />
              ) : (
                <span className="hidden shrink-0 font-mono text-[10.5px] uppercase tracking-[0.08em] text-klaz-faint sm:inline">
                  No practice
                </span>
              )}

              <span
                aria-hidden
                className={cn(
                  "ml-1 shrink-0 font-mono text-[11px] text-klaz-faint transition",
                  open ? "rotate-90 text-klaz-ink2" : "",
                )}
              >
                ›
              </span>
            </button>

            {open ? (
              <div className="border-t border-klaz-line2 bg-klaz-panel2 px-4 py-4">
                {e.questions.length === 0 ? (
                  <p className="text-[12.5px] text-klaz-muted">
                    You didn&apos;t ask anything this session.
                  </p>
                ) : (
                  <ol className="flex flex-col gap-4">
                    {e.questions.map((q, i) => (
                      <li key={q.id} className="flex gap-3">
                        <span className="mt-[3px] w-5 shrink-0 font-mono text-[10.5px] text-klaz-faint">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] leading-[1.5] text-klaz-ink">
                            {q.text}
                          </p>
                          {q.response ? (
                            <div className="mt-1.5 rounded-md border border-klaz-line2 bg-klaz-panel px-3 py-2">
                              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-klaz-faint">
                                Klaz
                              </div>
                              <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-[1.55] text-klaz-ink2">
                                {q.response}
                              </p>
                            </div>
                          ) : (
                            <p className="mt-1 text-[11.5px] italic text-klaz-faint">
                              (no reply recorded)
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function QuestionBadge({
  count,
  target,
  hit,
}: {
  count: number
  target: number
  hit: boolean
}) {
  return (
    <span
      title={
        hit
          ? `You hit the ${target}-question target.`
          : `You asked ${count}/${target} — aim for ${target} next time.`
      }
      className={cn(
        "hidden shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] sm:inline-flex",
        hit
          ? "bg-klaz-ok-bg text-klaz-ok"
          : "bg-klaz-line2 text-klaz-muted",
      )}
    >
      {count}/{target}
    </span>
  )
}

function PracticeChipView({ chip }: { chip: PracticeChip }) {
  const done = Boolean(chip.completedAt)
  const href = `/learn/practice/${chip.id}`
  if (done) {
    return (
      <Link
        href={href}
        onClick={(e) => e.stopPropagation()}
        className="hidden shrink-0 items-center gap-1 rounded-full bg-klaz-ok-bg px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-klaz-ok transition hover:bg-klaz-ok-bg/80 sm:inline-flex"
      >
        <span aria-hidden>✓</span>
        Practice done
      </Link>
    )
  }
  if (chip.status === "pending") {
    return (
      <span className="hidden shrink-0 items-center gap-1 rounded-full bg-klaz-line2 px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-klaz-faint sm:inline-flex">
        Practice pending
      </span>
    )
  }
  const topics = chip.topicCount
  return (
    <Link
      href={href}
      onClick={(e) => e.stopPropagation()}
      className="hidden shrink-0 items-center gap-1 rounded-full bg-klaz-accent-bg px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-klaz-accent2 transition hover:bg-klaz-accent/20 sm:inline-flex"
    >
      <span aria-hidden>▸</span>
      Practice · {topics} topic{topics === 1 ? "" : "s"}
    </Link>
  )
}
