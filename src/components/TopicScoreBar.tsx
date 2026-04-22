import { scoreHex } from "@/lib/utils"

export function TopicScoreBar({
  topic,
  score,
}: {
  topic: string
  score: number
}) {
  const clamped = Math.max(0, Math.min(100, score))
  return (
    <div>
      <div className="flex items-center justify-between text-[12px]">
        <span className="truncate text-klaz-ink">{topic}</span>
        <span className="font-mono text-[11px] tabular-nums text-klaz-muted">
          {clamped}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-[3px] bg-klaz-line2">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${clamped}%`, background: scoreHex(clamped) }}
        />
      </div>
    </div>
  )
}
