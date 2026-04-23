"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { cn, formatRelative } from "@/lib/utils"

type PracticeItem = {
  id: string
  question: string
  answer: string
  hint: string | null
  difficulty: "easy" | "medium" | "hard" | null
  sort_order?: number | null
}

export type FlatPracticeSet = {
  id: string
  studentId: string
  studentName: string
  sessionId: string | null
  sessionTitle: string | null
  topics: string[]
  status: "pending" | "approved" | "sent"
  title: string | null
  assignedAt: string | null
  completedAt: string | null
  createdAt: string
  items: PracticeItem[]
}

type StatusFilter = "all" | "needs_review" | "ready" | "assigned" | "completed"

// Teacher-facing practice queue. Three things to do: review AI-generated
// sets, assign to students, or un-assign. Status mapping:
//   pending  → needs review (teacher hasn't looked at it yet)
//   approved → ready (reviewed, not yet assigned)
//   sent     → assigned (visible in the student's /learn/practice)
// completed_at split out visually so teachers can see "they finished it".
export function ClassPracticeQueue({ sets }: { sets: FlatPracticeSet[] }) {
  const router = useRouter()
  const [filter, setFilter] = useState<StatusFilter>("all")
  const [openId, setOpenId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const counts = useMemo(() => {
    const out = {
      all: sets.length,
      needs_review: 0,
      ready: 0,
      assigned: 0,
      completed: 0,
    }
    for (const s of sets) {
      if (s.completedAt) out.completed += 1
      else if (s.status === "sent") out.assigned += 1
      else if (s.status === "approved") out.ready += 1
      else out.needs_review += 1
    }
    return out
  }, [sets])

  const visible = useMemo(() => {
    return sets.filter((s) => {
      if (filter === "all") return true
      if (filter === "completed") return Boolean(s.completedAt)
      if (filter === "assigned") return s.status === "sent" && !s.completedAt
      if (filter === "ready") return s.status === "approved"
      return s.status === "pending"
    })
  }, [sets, filter])

  async function assign(id: string) {
    setPendingId(id)
    const res = await fetch(`/api/practice/${id}/assign`, { method: "PATCH" })
    setPendingId(null)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error || "Could not assign")
      return
    }
    toast.success("Assigned")
    router.refresh()
  }

  async function unassign(id: string) {
    setPendingId(id)
    const res = await fetch(`/api/practice/${id}/assign`, { method: "DELETE" })
    setPendingId(null)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error || "Could not unassign")
      return
    }
    toast.success("Unassigned")
    router.refresh()
  }

  async function approve(id: string) {
    setPendingId(id)
    const res = await fetch(`/api/practice/${id}/approve`, { method: "PATCH" })
    setPendingId(null)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error || "Could not approve")
      return
    }
    toast.success("Marked ready")
    router.refresh()
  }

  if (sets.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-klaz-line bg-klaz-panel p-10 text-center">
        <p className="font-serif text-[20px] leading-none tracking-[-0.01em] text-klaz-ink">
          No practice yet<span className="text-klaz-accent">.</span>
        </p>
        <p className="mt-2 text-[13px] text-klaz-muted">
          Ending a session auto-generates a practice set for each student
          using their weakest topics. Run a session to see it populate here.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* filter bar */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-klaz-line bg-klaz-panel p-1.5">
        <FilterTab
          label="All"
          count={counts.all}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        <FilterTab
          label="Needs review"
          count={counts.needs_review}
          active={filter === "needs_review"}
          onClick={() => setFilter("needs_review")}
        />
        <FilterTab
          label="Ready"
          count={counts.ready}
          active={filter === "ready"}
          onClick={() => setFilter("ready")}
        />
        <FilterTab
          label="Assigned"
          count={counts.assigned}
          active={filter === "assigned"}
          onClick={() => setFilter("assigned")}
        />
        <FilterTab
          label="Completed"
          count={counts.completed}
          active={filter === "completed"}
          onClick={() => setFilter("completed")}
        />
      </div>

      {visible.length === 0 ? (
        <p className="mt-6 text-[13px] text-klaz-muted">
          Nothing in this view.
        </p>
      ) : (
        <div className="mt-4 space-y-2.5">
          {visible.map((s) => {
            const isOpen = openId === s.id
            const state: "needs_review" | "ready" | "assigned" | "completed" =
              s.completedAt
                ? "completed"
                : s.status === "sent"
                  ? "assigned"
                  : s.status === "approved"
                    ? "ready"
                    : "needs_review"
            return (
              <div
                key={s.id}
                className="overflow-hidden rounded-lg border border-klaz-line bg-klaz-panel"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-serif text-[18px] leading-none tracking-[-0.01em] text-klaz-ink">
                        {s.studentName}
                      </span>
                      <StateChip state={state} />
                    </div>
                    <div className="mt-1 text-[12px] text-klaz-muted">
                      {s.items.length} question
                      {s.items.length === 1 ? "" : "s"}
                      {s.sessionTitle ? ` · from "${s.sessionTitle}"` : ""}
                      {" · "}
                      {formatRelative(s.createdAt)}
                    </div>
                    {s.topics.length ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {s.topics.map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-klaz-line2 px-2 py-0.5 text-[10.5px] text-klaz-ink2"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : s.id)}
                      className="h-8 rounded-md border border-klaz-line bg-klaz-panel2 px-3 text-[12px] font-medium text-klaz-ink2 transition hover:bg-klaz-line2"
                    >
                      {isOpen ? "Hide" : "Preview"}
                    </button>
                    {state === "needs_review" ? (
                      <button
                        type="button"
                        onClick={() => approve(s.id)}
                        disabled={pendingId === s.id}
                        className="h-8 rounded-md border border-klaz-line bg-klaz-panel2 px-3 text-[12px] font-medium text-klaz-ink2 transition hover:bg-klaz-line2 disabled:opacity-50"
                      >
                        {pendingId === s.id ? "…" : "Mark ready"}
                      </button>
                    ) : null}
                    {state === "ready" ? (
                      <button
                        type="button"
                        onClick={() => assign(s.id)}
                        disabled={pendingId === s.id}
                        className="h-8 rounded-md bg-klaz-accent px-3 text-[12px] font-medium text-white transition hover:bg-klaz-accent2 disabled:opacity-50"
                      >
                        {pendingId === s.id ? "…" : "Assign →"}
                      </button>
                    ) : null}
                    {state === "assigned" ? (
                      <button
                        type="button"
                        onClick={() => unassign(s.id)}
                        disabled={pendingId === s.id}
                        className="h-8 rounded-md border border-klaz-line bg-klaz-panel2 px-3 text-[12px] font-medium text-klaz-bad transition hover:bg-klaz-line2 disabled:opacity-50"
                      >
                        {pendingId === s.id ? "…" : "Unassign"}
                      </button>
                    ) : null}
                  </div>
                </div>
                {isOpen ? (
                  <ol className="space-y-2 border-t border-klaz-line2 bg-klaz-panel2/50 p-4">
                    {s.items.map((it, idx) => (
                      <li
                        key={it.id}
                        className="rounded-md border border-klaz-line2 bg-klaz-panel2 p-3 text-[13px]"
                      >
                        <p className="font-medium text-klaz-ink">
                          {idx + 1}. {it.question}
                        </p>
                        {it.difficulty ? (
                          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-klaz-faint">
                            {it.difficulty}
                          </p>
                        ) : null}
                        <div className="mt-2 space-y-1 text-klaz-ink2">
                          <p>
                            <span className="font-medium text-klaz-ink">
                              Answer:
                            </span>{" "}
                            {it.answer}
                          </p>
                          {it.hint ? (
                            <p className="text-[12px] text-klaz-muted">
                              Hint: {it.hint}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FilterTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition",
        active
          ? "bg-klaz-ink text-klaz-bg"
          : "text-klaz-ink2 hover:bg-klaz-line2"
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "rounded-sm px-1 font-mono text-[10px] tabular-nums",
          active ? "bg-white/20" : "bg-klaz-line2 text-klaz-faint"
        )}
      >
        {count}
      </span>
    </button>
  )
}

function StateChip({
  state,
}: {
  state: "needs_review" | "ready" | "assigned" | "completed"
}) {
  const cfg = {
    needs_review: {
      label: "needs review",
      cls: "bg-klaz-warn-bg text-klaz-warn border-[#ebcc91]",
    },
    ready: {
      label: "ready",
      cls: "bg-klaz-line2 text-klaz-ink2 border-klaz-line",
    },
    assigned: {
      label: "assigned",
      cls: "bg-klaz-accent-bg text-klaz-accent border-[#eac3b1]",
    },
    completed: {
      label: "completed",
      cls: "bg-klaz-ok-bg text-klaz-ok border-[#cfdcae]",
    },
  }[state]
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-[1px] font-mono text-[9.5px] font-medium uppercase tracking-[0.08em]",
        cfg.cls
      )}
    >
      {cfg.label}
    </span>
  )
}
