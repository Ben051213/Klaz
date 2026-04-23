"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

// Small tab shell used by the class /setup page. Keeps Materials and
// Settings as a single destination instead of two half-empty pages that
// each justify a breadcrumb. The tab trigger style matches our other
// horizontal pickers: thin accent underline on active, muted otherwise.

type Tab = {
  id: string
  label: string
  content: React.ReactNode
  hint?: string
}

export function SetupTabs({
  tabs,
  initialId,
}: {
  tabs: Tab[]
  initialId?: string
}) {
  const [active, setActive] = useState(initialId ?? tabs[0]?.id)
  const current = tabs.find((t) => t.id === active) ?? tabs[0]
  return (
    <div>
      <div
        role="tablist"
        className="flex flex-wrap gap-1 border-b border-klaz-line"
      >
        {tabs.map((t) => {
          const on = t.id === active
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(t.id)}
              className={cn(
                "-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-[13px] font-medium transition",
                on
                  ? "border-klaz-accent text-klaz-ink"
                  : "border-transparent text-klaz-muted hover:text-klaz-ink2"
              )}
            >
              {t.label}
              {t.hint ? (
                <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-klaz-faint">
                  {t.hint}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      <div className="mt-5" role="tabpanel">
        {current?.content}
      </div>
    </div>
  )
}
