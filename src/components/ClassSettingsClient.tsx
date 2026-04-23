"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { flavorClasses, FLAVORS, type Flavor } from "@/lib/flavor"

// Class-level settings the teacher tweaks from the materials page:
//   · Tutor tone — free text injected into the system prompt
//   · Flavor — pastel tint identity used across the dashboards
//
// Lives next to the materials list because both shape what the tutor
// feels like in this class. A dedicated /settings page would be overkill
// for two fields.

const MAX_TONE = 400

export function ClassSettingsClient({
  classId,
  initialTone,
  initialFlavor,
}: {
  classId: string
  initialTone: string
  initialFlavor: string | null
}) {
  const [tone, setTone] = useState(initialTone)
  const [savedTone, setSavedTone] = useState(initialTone)
  const [flavor, setFlavor] = useState<Flavor>(
    (FLAVORS.find((f) => f === initialFlavor) as Flavor | undefined) ?? "mint"
  )
  const [savedFlavor, setSavedFlavor] = useState<Flavor>(flavor)
  const [pending, startTransition] = useTransition()

  const toneDirty = tone.trim() !== savedTone.trim()
  const flavorDirty = flavor !== savedFlavor

  function save(
    patch: { tutor_tone?: string; flavor?: Flavor },
    onSuccess: () => void,
    successMsg: string
  ) {
    startTransition(async () => {
      const res = await fetch(`/api/classes/${classId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string
        }
        toast.error(body.error ?? "Could not save")
        return
      }
      onSuccess()
      toast.success(successMsg)
    })
  }

  return (
    <div className="grid gap-4 rounded-xl border border-klaz-line bg-klaz-panel p-5 md:grid-cols-[1.4fr_1fr]">
      {/* Tutor tone */}
      <div>
        <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-klaz-faint">
          Tutor tone
        </div>
        <h3 className="mt-0.5 font-serif text-[20px] leading-none tracking-[-0.01em] text-klaz-ink">
          How Klaz should sound<span className="text-klaz-accent">.</span>
        </h3>
        <p className="mt-1 text-[12.5px] text-klaz-muted">
          Short, specific. Think of it as a note to a substitute teacher:{" "}
          <span className="italic">
            &ldquo;Use UK spelling. Match the playful voice I use in class.
            Assume Year 8 baseline.&rdquo;
          </span>
        </p>
        <textarea
          rows={3}
          maxLength={MAX_TONE}
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          placeholder="Tone, conventions, assumptions — anything you'd tell a new tutor taking over your class."
          className="mt-2 block w-full resize-y rounded-md border border-klaz-line bg-klaz-panel2 px-3 py-2 text-[13px] text-klaz-ink placeholder:text-klaz-faint focus:border-klaz-accent focus:outline-none focus:ring-1 focus:ring-klaz-accent/30"
        />
        <div className="mt-2 flex items-center justify-between">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-klaz-faint">
            {tone.length}/{MAX_TONE} chars
          </p>
          <button
            type="button"
            disabled={!toneDirty || pending}
            onClick={() =>
              save(
                { tutor_tone: tone.trim() },
                () => setSavedTone(tone.trim()),
                "Tone updated"
              )
            }
            className="inline-flex items-center gap-1 rounded-md bg-klaz-ink px-3 py-1.5 text-[12.5px] font-medium text-klaz-bg transition hover:bg-klaz-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save tone"}
          </button>
        </div>
      </div>

      {/* Flavor picker */}
      <div>
        <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-klaz-faint">
          Class flavor
        </div>
        <h3 className="mt-0.5 font-serif text-[20px] leading-none tracking-[-0.01em] text-klaz-ink">
          A pastel for quick recognition<span className="text-klaz-accent">.</span>
        </h3>
        <p className="mt-1 text-[12.5px] text-klaz-muted">
          Tints the card and avatar on the dashboard. Nothing else changes.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {FLAVORS.map((f) => {
            const fc = flavorClasses(f)
            const selected = flavor === f
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFlavor(f)}
                aria-pressed={selected}
                className={`group flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11.5px] font-medium capitalize transition ${
                  selected
                    ? "border-klaz-ink bg-klaz-panel2 text-klaz-ink"
                    : "border-klaz-line bg-klaz-panel text-klaz-ink2 hover:border-klaz-ink/40"
                }`}
              >
                <span
                  aria-hidden
                  className={`h-3 w-3 rounded-full ${fc.dot}`}
                />
                {f}
              </button>
            )
          })}
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={!flavorDirty || pending}
            onClick={() =>
              save(
                { flavor },
                () => setSavedFlavor(flavor),
                "Flavor updated"
              )
            }
            className="inline-flex items-center gap-1 rounded-md bg-klaz-ink px-3 py-1.5 text-[12.5px] font-medium text-klaz-bg transition hover:bg-klaz-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save flavor"}
          </button>
        </div>
      </div>
    </div>
  )
}
