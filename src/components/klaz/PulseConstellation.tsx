"use client"

import type { TopicConfusion } from "@/lib/types"

// Teacher "Class Pulse" — topic bubbles plotted on a confusion × volume
// canvas. X = how many questions landed on the topic; Y = how confused
// students were (higher up = more confused). Bigger bubbles are hotter.
//
// Rendering is pure CSS on top of a subtle grid + radial gradient so it
// reads as a chart but feels editorial, not dashboardy.

export function PulseConstellation({
  data,
  loading,
}: {
  data: TopicConfusion[]
  loading?: boolean
}) {
  if (loading && data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[11px] font-mono uppercase tracking-[0.08em] text-[rgba(250,247,245,0.4)]">
        Loading pulse…
      </div>
    )
  }
  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-[13px] text-[rgba(250,247,245,0.55)]">
        No signals yet — topics appear here as students start asking questions.
      </div>
    )
  }

  // Normalize to 0..1 axes. We log-compress volume so a single dominant
  // topic doesn't shove everything else into the corner.
  const maxVolume = Math.max(...data.map((d) => d.totalMessages))
  const bubbles = data.slice(0, 10).map((d) => {
    const vNorm = Math.log(d.totalMessages + 1) / Math.log(maxVolume + 1)
    const cNorm = Math.min(1, d.percentage / 100)
    // Leave margins so bubbles never clip the canvas edges.
    const x = 15 + vNorm * 70
    const y = 15 + (1 - cNorm) * 70
    const r = 14 + vNorm * 32
    const hot = d.percentage >= 60
    const cool = d.percentage <= 15
    return { topic: d.topic, x, y, r, hot, cool, pct: d.percentage }
  })

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-[rgba(250,247,245,0.1)]"
      style={{
        background:
          "radial-gradient(circle at 80% 15%, rgba(184,74,43,0.18), transparent 55%), radial-gradient(circle at 20% 85%, rgba(250,247,245,0.04), transparent 55%)",
      }}
    >
      <div className="absolute left-3.5 top-3 font-mono text-[10px] uppercase tracking-[0.08em] text-[rgba(250,247,245,0.4)]">
        ↑ more confused
      </div>
      <div className="absolute bottom-2.5 right-3.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[rgba(250,247,245,0.4)]">
        more asked →
      </div>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(250,247,245,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(250,247,245,0.04) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      {bubbles.map((b) => (
        <div
          key={b.topic}
          className="absolute text-center"
          style={{
            left: `${b.x}%`,
            top: `${b.y}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div
            className="mx-auto rounded-full"
            style={{
              width: b.r * 2,
              height: b.r * 2,
              background: b.hot
                ? "rgba(232,157,163,0.32)"
                : b.cool
                  ? "rgba(194,210,138,0.24)"
                  : "rgba(250,247,245,0.12)",
              border: `1.5px solid ${
                b.hot
                  ? "#e89da3"
                  : b.cool
                    ? "#c2d28a"
                    : "rgba(250,247,245,0.35)"
              }`,
              boxShadow: b.hot ? "0 0 30px rgba(232,157,163,0.45)" : "none",
            }}
          />
          <div
            className="mt-1.5 font-serif text-[13px] tracking-[-0.005em]"
            style={{
              fontStyle: b.hot ? "italic" : "normal",
              color: b.hot
                ? "#e89da3"
                : b.cool
                  ? "#c2d28a"
                  : "rgba(250,247,245,0.8)",
            }}
          >
            {b.topic}
          </div>
        </div>
      ))}
    </div>
  )
}
