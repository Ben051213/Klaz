import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Chip } from "./Chip"

// The "live session" hero strip. Dark ink panel with a radial terracotta
// glow, live timer, headline topic, and at-risk students — used on the
// teacher dashboard and at the top of the class detail page whenever a
// session is currently running.

type AtRisk = { id: string; name: string }

export function LiveHero({
  classLabel,
  topic,
  elapsed,
  onlineCount,
  totalCount,
  questionCount,
  hottestTopic,
  hottestPercent,
  hottestLabel,
  atRisk,
  sessionId,
  atRiskCount,
  compact = false,
}: {
  classLabel: string
  topic: string | null
  elapsed: string
  onlineCount: number
  totalCount: number
  questionCount: number
  hottestTopic: string | null
  hottestPercent: number | null
  hottestLabel?: string
  atRisk: AtRisk[]
  sessionId: string
  atRiskCount: number
  compact?: boolean
}) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-klaz-line text-klaz-bg"
      style={{
        background:
          "radial-gradient(circle at 100% 0%, rgba(142,203,178,0.55), transparent 55%), #2b2a38",
      }}
    >
      <div
        className={`grid items-center gap-7 ${
          compact ? "p-5" : "p-6"
        } grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr]`}
      >
        <div>
          <div className="flex items-center gap-2.5">
            <Chip
              tone="accent"
              className="border-none !bg-white !text-klaz-accent"
            >
              ● LIVE
            </Chip>
            <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[rgba(250,247,245,0.6)]">
              SESSION {elapsed}
            </span>
          </div>
          <div className="mt-2.5 font-serif text-[28px] leading-[1.05] tracking-tight">
            {classLabel}{" "}
            {topic ? (
              <span className="italic text-klaz-accent">— {topic}</span>
            ) : null}
          </div>
          <div className="mt-1.5 text-[12.5px] text-[rgba(250,247,245,0.7)]">
            {onlineCount} of {totalCount} students online · {questionCount}{" "}
            question{questionCount === 1 ? "" : "s"} so far
          </div>
          <div className="mt-3.5 flex gap-2">
            <Link
              href={`/dashboard/session/${sessionId}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-klaz-accent px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-klaz-accent2"
            >
              Enter pulse →
            </Link>
          </div>
        </div>

        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[rgba(250,247,245,0.6)]">
            Hottest topic
          </div>
          <div className="mt-2 font-serif text-[46px] leading-none text-white">
            {hottestPercent ?? "—"}
            {hottestPercent !== null ? (
              <span className="font-sans text-[20px] text-[rgba(250,247,245,0.5)]">
                %
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 font-serif text-[18px] italic text-klaz-accent">
            {hottestTopic ?? "No hot topic yet"}
          </div>
          {hottestLabel ? (
            <div className="mt-0.5 text-[11px] text-[rgba(250,247,245,0.55)]">
              {hottestLabel}
            </div>
          ) : null}
        </div>

        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[rgba(250,247,245,0.6)]">
            At-risk
          </div>
          <div className="mt-2.5 flex">
            {atRisk.length === 0 ? (
              <div className="text-[12px] text-[rgba(250,247,245,0.55)]">
                Nobody flagged yet.
              </div>
            ) : (
              atRisk.slice(0, 4).map((s, i) => (
                <Avatar
                  key={s.id}
                  className="h-8 w-8"
                  style={{
                    marginLeft: i === 0 ? 0 : -8,
                    border: "2px solid #2b2a38",
                  }}
                >
                  <AvatarFallback className="bg-klaz-deep text-[11px] font-semibold text-klaz-bg">
                    {s.name.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))
            )}
          </div>
          {atRisk.length > 0 ? (
            <div className="mt-2.5 text-[12px] text-[rgba(250,247,245,0.75)]">
              {atRiskCount} students below 65.{" "}
              <Link
                href={`/dashboard/session/${sessionId}`}
                className="font-medium text-klaz-accent"
              >
                See who →
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
