"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// This card is now teacher-only. It displays AI-generated follow-up questions
// as reference material — answers and hints are always visible so the teacher
// can use them to prep the next class. There's no approve/send flow anymore;
// suggestions never reach the student.

type PracticeItem = {
  id: string
  question: string
  answer: string
  hint: string | null
  difficulty: "easy" | "medium" | "hard" | null
}

export function PracticeSetCard({
  studentName,
  topics,
  items,
}: {
  studentName?: string
  topics: string[]
  items: PracticeItem[]
}) {
  const [expanded, setExpanded] = useState(false)

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
              {items.length} suggested question{items.length === 1 ? "" : "s"}
            </CardTitle>
            <div className="mt-2 flex flex-wrap gap-1">
              {topics.map((t) => (
                <Badge key={t} variant="secondary" className="text-[10px]">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Hide" : "Preview"}
          </Button>
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
                <div className="mt-2 space-y-1 text-slate-600">
                  <p>
                    <span className="font-medium">Answer:</span> {it.answer}
                  </p>
                  {it.hint ? (
                    <p className="text-xs text-slate-500">Hint: {it.hint}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      ) : null}
    </Card>
  )
}
