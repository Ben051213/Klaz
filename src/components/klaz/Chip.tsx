import * as React from "react"
import { cn } from "@/lib/utils"

// A small pill used throughout Klaz: topic tags, status, LIVE indicators,
// question-level badges. Tones map to the semantic palette.

type ChipTone =
  | "default"
  | "ok"
  | "warn"
  | "bad"
  | "accent"
  | "live"
  | "info"

const toneClasses: Record<ChipTone, string> = {
  default:
    "bg-klaz-line2 text-klaz-ink2 border-klaz-line",
  ok: "bg-klaz-ok-bg text-klaz-ok border-[#cfdcae]",
  warn: "bg-klaz-warn-bg text-klaz-warn border-[#ebcc91]",
  bad: "bg-klaz-bad-bg text-klaz-bad border-[#e5b7ae]",
  accent:
    "bg-klaz-accent-bg text-klaz-accent border-[#eac3b1]",
  live: "bg-klaz-ink text-klaz-bg border-klaz-ink",
  info: "bg-klaz-panel2 text-klaz-ink2 border-klaz-line",
}

export function Chip({
  tone = "default",
  mono = false,
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: ChipTone
  mono?: boolean
}) {
  return (
    <span
      {...rest}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10.5px] font-medium tracking-[0.01em]",
        mono && "font-mono",
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  )
}
