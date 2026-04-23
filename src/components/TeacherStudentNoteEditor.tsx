"use client"

import { useState, useTransition } from "react"

// TeacherStudentNoteEditor — private free-text notes the teacher keeps
// on a single student within a class. Never exposed to the student.
// Useful for things like "met with parent 3/4", "struggles with word
// problems when anxious", "doing better after switching seats". Lives
// in its own table (class_student_notes) with RLS locked to the class
// teacher.

export function TeacherStudentNoteEditor({
  classId,
  studentId,
  initialNote,
}: {
  classId: string
  studentId: string
  initialNote: string
}) {
  const [note, setNote] = useState(initialNote)
  const [savedNote, setSavedNote] = useState(initialNote)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const dirty = note !== savedNote

  function save() {
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/classes/${classId}/students/${studentId}/note`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ note }),
          }
        )
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string
          }
          throw new Error(data.error ?? `HTTP ${res.status}`)
        }
        setSavedNote(note)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save")
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        rows={4}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Private — just for you. Keep track of what you've discussed, what's working, what isn't."
        className="w-full resize-y rounded-md border border-klaz-line bg-klaz-panel2 px-3 py-2 text-[13px] text-klaz-ink placeholder:text-klaz-faint focus:border-klaz-accent focus:outline-none focus:ring-1 focus:ring-klaz-accent/30"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11.5px] text-klaz-faint">
          {dirty ? "Unsaved changes." : "Saved — only you can see this."}
        </p>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || pending}
          className="inline-flex items-center gap-1 rounded-md bg-klaz-ink px-3 py-1.5 text-[12.5px] font-medium text-klaz-bg transition hover:bg-klaz-deep disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save note"}
        </button>
      </div>
      {error ? (
        <p className="text-[11.5px] text-klaz-bad">{error}</p>
      ) : null}
    </div>
  )
}
