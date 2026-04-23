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
    <Card className="border-klaz-line bg-klaz-panel">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            {studentName ? (
              <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-klaz-faint">
                {studentName}
              </p>
            ) : null}
            <CardTitle className="font-serif text-[20px] font-normal tracking-[-0.01em] text-klaz-ink">
              {items.length} suggested question
              {items.length === 1 ? "" : "s"}
            </CardTitle>
            <div className="mt-2 flex flex-wrap gap-1">
              {topics.map((t) => (
                <Badge
                  key={t}
                  variant="secondary"
                  className="bg-klaz-line2 text-[10px] text-klaz-ink2"
                >
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
            className="rounded-md border-klaz-line bg-klaz-panel2 text-[12.5px] font-medium text-klaz-ink2 hover:bg-klaz-line2"
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
                className="rounded-lg border border-klaz-line2 bg-klaz-panel2 p-3 text-[13px]"
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
                    <span className="font-medium text-klaz-ink">Answer:</span>{" "}
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
        </CardContent>
      ) : null}
    </Card>
  )
}
