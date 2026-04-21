import { cn, scoreToColor } from "@/lib/utils"

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
      <div className="flex items-center justify-between text-xs">
        <span className="truncate font-medium text-slate-700">{topic}</span>
        <span className="tabular-nums text-slate-500">{clamped}</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            scoreToColor(clamped)
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
