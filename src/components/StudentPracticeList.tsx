"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { cn, formatRelative } from "@/lib/utils"

type Item = {
  id: string
  question: string
  hint: string | null
  difficulty: "easy" | "medium" | "hard" | null
  answer: string
}

type StudentSet = {
  id: string
  className: string
  subject: string
  sessionTitle: string | null
  topics: string[]
  title: string | null
  assignedAt: string | null
  completedAt: string | null
  createdAt: string
  items: Item[]
}

// Student-side practice list. Each set expands inline to show questions
// one-by-one. Hints are visible upfront but answers only reveal on demand
// — the whole point of practice is to attempt it first, and if we show
// the answer next to the question the loop collapses.

export function StudentPracticeList({ sets }: { sets: StudentSet[] }) {
  const router = useRouter()
  const [openId, setOpenId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  async function markComplete(id: string, done: boolean) {
    setPendingId(id)
    const res = await fetch(`/api/practice/${id}/complete`, {
      method: done ? "POST" : "DELETE",
    })
    setPendingId(null)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error || "Could not update")
      return
    }
    toast.success(done ? "Nice — logged." : "Reopened")
    router.refresh()
  }

  if (sets.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-klaz-line bg-klaz-panel p-10 text-center">
        <p className="font-serif text-[20px] leading-none tracking-[-0.01em] text-klaz-ink">
          Nothing assigned
        </p>
        <p className="mt-2 text-[13px] text-klaz-muted">
          When your teacher assigns practice after class, it&apos;ll appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {sets.map((s) => (
        <SetRow
          key={s.id}
          set={s}
          open={openId === s.id}
          pending={pendingId === s.id}
          onToggle={() => setOpenId(openId === s.id ? null : s.id)}
          onComplete={() => markComplete(s.id, !s.completedAt)}
        />
      ))}
    </div>
  )
}

function SetRow({
  set: s,
  open,
  pending,
  onToggle,
  onComplete,
}: {
  set: StudentSet
  open: boolean
  pending: boolean
  onToggle: () => void
  onComplete: () => void
}) {
  const done = Boolean(s.completedAt)
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-klaz-panel transition",
        done ? "border-klaz-ok/30 bg-klaz-ok-bg/40" : "border-klaz-line"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-wrap items-start justify-between gap-3 p-4 text-left"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-serif text-[18px] leading-none tracking-[-0.01em] text-klaz-ink">
              {s.title ||
                (s.sessionTitle
                  ? `Practice · ${s.sessionTitle}`
                  : `${s.className} practice`)}
            </span>
            {done ? (
              <span className="inline-flex items-center rounded-full border border-[#cfdcae] bg-klaz-ok-bg px-2 py-[1px] font-mono text-[9.5px] font-medium uppercase tracking-[0.08em] text-klaz-ok">
                ✓ complete
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-[12px] text-klaz-muted">
            {s.className}
            {s.subject ? ` · ${s.subject}` : ""}
            {s.topics.length ? ` · ${s.topics.join(", ")}` : ""}
            {s.assignedAt ? ` · assigned ${formatRelative(s.assignedAt)}` : ""}
          </div>
        </div>
        <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-klaz-faint">
          {s.items.length} question{s.items.length === 1 ? "" : "s"} ·{" "}
          {open ? "hide" : "open"}
        </div>
      </button>
      {open ? (
        <div className="border-t border-klaz-line2 bg-klaz-panel2/50 p-4">
          <ol className="space-y-3">
            {s.items.map((it, idx) => (
              <PracticeQuestion key={it.id} idx={idx} item={it} />
            ))}
          </ol>
          <div className="mt-4 flex items-center justify-end">
            <button
              type="button"
              onClick={onComplete}
              disabled={pending}
              className={cn(
                "h-9 rounded-md px-4 text-[13px] font-medium transition disabled:opacity-50",
                done
                  ? "border border-klaz-line bg-klaz-panel2 text-klaz-ink2 hover:bg-klaz-line2"
                  : "bg-klaz-accent text-white hover:bg-klaz-accent2"
              )}
            >
              {pending ? "…" : done ? "Reopen" : "Mark complete ✓"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function PracticeQuestion({ idx, item }: { idx: number; item: Item }) {
  const [showAnswer, setShowAnswer] = useState(false)
  return (
    <li className="rounded-md border border-klaz-line2 bg-klaz-panel2 p-3 text-[13px]">
      <p className="font-medium text-klaz-ink">
        {idx + 1}. {item.question}
      </p>
      {item.difficulty ? (
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-klaz-faint">
          {item.difficulty}
        </p>
      ) : null}
      {item.hint ? (
        <p className="mt-2 text-[12.5px] text-klaz-muted">Hint: {item.hint}</p>
      ) : null}
      <div className="mt-2.5">
        {showAnswer ? (
          <div className="rounded-md border border-klaz-line bg-klaz-panel p-2.5 text-[12.5px] text-klaz-ink2">
            <span className="font-medium text-klaz-ink">Answer:</span>{" "}
            {item.answer}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAnswer(true)}
            className="font-mono text-[11px] uppercase tracking-[0.06em] text-klaz-accent transition hover:text-klaz-accent2"
          >
            Reveal answer →
          </button>
        )}
      </div>
    </li>
  )
}
