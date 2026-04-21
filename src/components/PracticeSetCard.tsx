"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type PracticeItem = {
  id: string
  question: string
  answer: string
  hint: string | null
  difficulty: "easy" | "medium" | "hard" | null
}

export function PracticeSetCard({
  setId,
  studentName,
  topics,
  items,
  canApprove,
  revealEnabled,
}: {
  setId: string
  studentName?: string
  topics: string[]
  items: PracticeItem[]
  canApprove?: boolean
  revealEnabled?: boolean
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [approving, setApproving] = useState(false)

  async function approve() {
    setApproving(true)
    const res = await fetch(`/api/practice/${setId}/approve`, {
      method: "PATCH",
    })
    const data = await res.json()
    setApproving(false)
    if (!res.ok) {
      toast.error(data.error || "Could not approve")
      return
    }
    toast.success("Approved")
    router.refresh()
  }

  return (
    <Card className="bg-white">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            {studentName ? (
              <p className="text-xs uppercase tracking-wide text-slate-400">
                {studentName}
              </p>
            ) : null}
            <CardTitle className="text-base text-brand-navy">
              {items.length} practice question{items.length === 1 ? "" : "s"}
            </CardTitle>
            <div className="mt-2 flex flex-wrap gap-1">
              {topics.map((t) => (
                <Badge key={t} variant="secondary" className="text-[10px]">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Hide" : "Preview"}
            </Button>
            {canApprove ? (
              <Button
                type="button"
                size="sm"
                onClick={approve}
                disabled={approving}
                className="bg-brand-teal hover:bg-brand-teal/90"
              >
                {approving ? "Approving…" : "Approve"}
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      {expanded ? (
        <CardContent>
          <ol className="space-y-3">
            {items.map((it, idx) => (
              <li
                key={it.id}
                className="rounded-md border border-slate-100 p-3 text-sm"
              >
                <p className="font-medium text-slate-800">
                  {idx + 1}. {it.question}
                </p>
                {it.difficulty ? (
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                    {it.difficulty}
                  </p>
                ) : null}
                {revealEnabled ? (
                  revealed[it.id] ? (
                    <div className="mt-2 space-y-1 rounded-md bg-slate-50 p-2 text-slate-700">
                      <p>
                        <span className="font-medium">Answer:</span>{" "}
                        {it.answer}
                      </p>
                      {it.hint ? (
                        <p className="text-xs text-slate-500">
                          Hint: {it.hint}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-7 px-2 text-xs"
                      onClick={() =>
                        setRevealed((prev) => ({ ...prev, [it.id]: true }))
                      }
                    >
                      Reveal answer
                    </Button>
                  )
                ) : (
                  <div className="mt-2 space-y-1 text-slate-600">
                    <p>
                      <span className="font-medium">Answer:</span> {it.answer}
                    </p>
                    {it.hint ? (
                      <p className="text-xs text-slate-500">
                        Hint: {it.hint}
                      </p>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </CardContent>
      ) : null}
    </Card>
  )
}
