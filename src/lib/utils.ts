import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("")
}

export function formatDateTime(date: string): string {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function formatDuration(startedAt: string, endedAt?: string): string {
  const start = new Date(startedAt).getTime()
  const end = endedAt ? new Date(endedAt).getTime() : Date.now()
  const mins = Math.floor((end - start) / 60000)
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

export function scoreToColor(score: number): string {
  if (score >= 70) return "bg-emerald-500"
  if (score >= 40) return "bg-amber-500"
  return "bg-red-500"
}

// "Updated 2h ago" style relative labels for the class table and recent
// sessions list. Keeps dates feeling live without a heavy i18n dep.
export function formatRelative(date: string | null | undefined): string {
  if (!date) return "—"
  const diff = Date.now() - new Date(date).getTime()
  if (diff < 60_000) return "just now"
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

// Map a 0–100 score onto the semantic traffic-light palette so the colour
// scale stays consistent across sparklines, heatmap bars, and KPI text.
export function scoreTone(score: number): "ok" | "warn" | "bad" {
  if (score >= 70) return "ok"
  if (score >= 50) return "warn"
  return "bad"
}

export function scoreHex(score: number): string {
  const t = scoreTone(score)
  return t === "ok" ? "#4a7c3a" : t === "warn" ? "#b86a12" : "#9c2b2b"
}
