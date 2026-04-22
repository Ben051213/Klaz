"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

// Inline "enter a join code" card for the student home. Warm editorial
// styling: cream panel, mono uppercase input with wide tracking, accent
// terracotta submit button — matches the HyStudentJoin flow in the Figma
// Make bundle without forcing the student through the full mobile screen.
export function JoinClassCard() {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    const res = await fetch("/api/classes/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ join_code: code }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      toast.error(data.error || "Could not join class")
      return
    }
    toast.success(`Joined ${data.class.name}`)
    setCode("")
    router.refresh()
  }

  return (
    <div className="rounded-lg border border-klaz-line bg-klaz-panel p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-serif text-[20px] leading-none tracking-[-0.01em] text-klaz-ink">
            Got a join code<span className="text-klaz-accent">?</span>
          </h2>
          <p className="mt-1.5 text-[12.5px] text-klaz-muted">
            Enter the 6-character code from your teacher. Looks like{" "}
            <span className="rounded-sm bg-klaz-line2 px-1.5 py-0.5 font-mono text-[11.5px] tracking-[0.06em] text-klaz-ink2">
              A7K-92Q
            </span>
            .
          </p>
        </div>
        <form
          onSubmit={onSubmit}
          className="flex w-full items-stretch gap-2 sm:w-auto sm:shrink-0"
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
            required
            className="h-10 w-full min-w-0 rounded-md border border-klaz-line bg-klaz-panel2 px-3 font-mono text-[14px] uppercase tracking-[0.2em] text-klaz-ink placeholder:text-klaz-faint focus:border-klaz-accent focus:outline-none focus:ring-2 focus:ring-klaz-accent/20 sm:w-[180px]"
          />
          <button
            type="submit"
            disabled={loading || code.length < 4}
            className="h-10 shrink-0 rounded-md bg-klaz-accent px-4 text-[13px] font-medium text-white transition hover:bg-klaz-accent2 disabled:opacity-50"
          >
            {loading ? "Joining…" : "Join →"}
          </button>
        </form>
      </div>
    </div>
  )
}
