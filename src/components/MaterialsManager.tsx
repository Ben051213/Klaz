"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { cn, formatRelative } from "@/lib/utils"

type Kind = "notes" | "syllabus" | "lesson"

type Material = {
  id: string
  title: string
  content: string
  kind: Kind
  updated_at: string
  created_at: string
}

// Client shell for the /dashboard/classes/:id/materials page.
// Two modes per row: collapsed preview or inline editor. A dedicated "new"
// row sits at the top. We refresh via router.refresh() after writes so the
// server component re-fetches and pushes fresh data back.

export function MaterialsManager({
  classId,
  initialMaterials,
}: {
  classId: string
  initialMaterials: Material[]
}) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function uploadPdf(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("PDF is larger than 10MB — upload a smaller file.")
      return
    }
    if (file.type && file.type !== "application/pdf") {
      toast.error("Only PDFs are supported for upload right now.")
      return
    }
    setUploading(true)
    const form = new FormData()
    form.append("file", file)
    form.append("kind", "lesson")
    const res = await fetch(`/api/classes/${classId}/materials`, {
      method: "POST",
      body: form,
    })
    setUploading(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error || "Could not upload PDF")
      return
    }
    toast.success("Lesson plan added from PDF")
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file) return
          await uploadPdf(file)
          // Reset so the same filename can be picked twice in a row.
          if (fileInputRef.current) fileInputRef.current.value = ""
        }}
      />

      {creating ? (
        <MaterialEditor
          mode="create"
          classId={classId}
          onDone={() => {
            setCreating(false)
            router.refresh()
          }}
          onCancel={() => setCreating(false)}
        />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex w-full items-center justify-between rounded-lg border border-dashed border-klaz-line bg-klaz-panel px-4 py-3 text-left transition hover:border-klaz-accent/50 hover:bg-klaz-accent-bg/30"
          >
            <div>
              <div className="font-serif text-[18px] leading-none tracking-[-0.01em] text-klaz-ink">
                Paste text<span className="text-klaz-accent">.</span>
              </div>
              <p className="mt-1 text-[12.5px] text-klaz-muted">
                Syllabus, a lesson plan, or a worked example the tutor should
                anchor to.
              </p>
            </div>
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-klaz-accent">
              + text
            </span>
          </button>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full items-center justify-between rounded-lg border border-dashed border-klaz-line bg-klaz-panel px-4 py-3 text-left transition hover:border-klaz-accent/50 hover:bg-klaz-accent-bg/30 disabled:cursor-wait disabled:opacity-70"
          >
            <div>
              <div className="font-serif text-[18px] leading-none tracking-[-0.01em] text-klaz-ink">
                {uploading ? "Reading PDF…" : "Upload PDF"}
                <span className="text-klaz-accent">.</span>
              </div>
              <p className="mt-1 text-[12.5px] text-klaz-muted">
                Drop in your lesson plan — we&apos;ll extract the main topic,
                objectives, and key examples for you.
              </p>
            </div>
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-klaz-accent">
              ⤓ pdf
            </span>
          </button>
        </div>
      )}

      {initialMaterials.length === 0 && !creating ? (
        <div className="rounded-lg border border-klaz-line bg-klaz-panel p-8 text-center">
          <p className="font-serif text-[20px] leading-none tracking-[-0.01em] text-klaz-ink">
            No materials yet<span className="text-klaz-accent">.</span>
          </p>
          <p className="mt-2 text-[13px] text-klaz-muted">
            Everything you add here is injected into the tutor&apos;s system
            prompt for this class.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {initialMaterials.map((m) =>
            editingId === m.id ? (
              <li key={m.id}>
                <MaterialEditor
                  mode="edit"
                  classId={classId}
                  material={m}
                  onDone={() => {
                    setEditingId(null)
                    router.refresh()
                  }}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li key={m.id}>
                <MaterialRow
                  material={m}
                  onEdit={() => setEditingId(m.id)}
                  onDelete={async () => {
                    if (
                      !confirm(`Delete "${m.title}"? This can't be undone.`)
                    ) {
                      return
                    }
                    const res = await fetch(
                      `/api/classes/${classId}/materials/${m.id}`,
                      { method: "DELETE" }
                    )
                    if (!res.ok) {
                      const body = await res.json().catch(() => ({}))
                      toast.error(body.error || "Could not delete")
                      return
                    }
                    toast.success("Material removed")
                    router.refresh()
                  }}
                />
              </li>
            )
          )}
        </ul>
      )}
    </div>
  )
}

function MaterialRow({
  material,
  onEdit,
  onDelete,
}: {
  material: Material
  onEdit: () => void
  onDelete: () => void
}) {
  const preview =
    material.content.length > 220
      ? `${material.content.slice(0, 220).trim()}…`
      : material.content
  return (
    <div className="overflow-hidden rounded-lg border border-klaz-line bg-klaz-panel">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-serif text-[18px] leading-none tracking-[-0.01em] text-klaz-ink">
              {material.title}
            </span>
            <KindChip kind={material.kind} />
          </div>
          <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-klaz-faint">
            updated {formatRelative(material.updated_at)} · {material.content.length.toLocaleString()} chars
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md border border-klaz-line bg-klaz-panel2 px-3 py-1 text-[12px] font-medium text-klaz-ink2 transition hover:bg-klaz-line2"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md border border-klaz-line bg-klaz-panel2 px-3 py-1 text-[12px] font-medium text-klaz-muted transition hover:border-[#d9a2a2] hover:text-klaz-bad"
          >
            Delete
          </button>
        </div>
      </div>
      <div className="border-t border-klaz-line2 bg-klaz-panel2 px-4 py-3 text-[12.5px] leading-[1.55] text-klaz-ink2 whitespace-pre-wrap">
        {preview}
      </div>
    </div>
  )
}

function MaterialEditor({
  mode,
  classId,
  material,
  onDone,
  onCancel,
}: {
  mode: "create" | "edit"
  classId: string
  material?: Material
  onDone: () => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(material?.title ?? "")
  const [content, setContent] = useState(material?.content ?? "")
  const [kind, setKind] = useState<Kind>(material?.kind ?? "notes")
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!title.trim() || !content.trim()) {
      toast.error("Title and content are required")
      return
    }
    setSaving(true)
    const url =
      mode === "create"
        ? `/api/classes/${classId}/materials`
        : `/api/classes/${classId}/materials/${material!.id}`
    const res = await fetch(url, {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, kind }),
    })
    setSaving(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error || "Could not save")
      return
    }
    toast.success(mode === "create" ? "Material added" : "Saved")
    onDone()
  }

  return (
    <div className="rounded-lg border border-klaz-accent/30 bg-klaz-panel2 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (e.g. 'Week 3 lesson plan')"
          className="flex-1 rounded-md border border-klaz-line bg-klaz-panel px-3 py-2 text-[14px] text-klaz-ink outline-none focus:border-klaz-accent"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as Kind)}
          className="rounded-md border border-klaz-line bg-klaz-panel px-2 py-2 text-[13px] text-klaz-ink2"
        >
          <option value="notes">Notes</option>
          <option value="syllabus">Syllabus</option>
          <option value="lesson">Lesson plan</option>
        </select>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={10}
        placeholder="Paste the full text here. The tutor will treat this as authoritative for the class."
        className="mt-2 block w-full resize-y rounded-md border border-klaz-line bg-klaz-panel px-3 py-2 font-mono text-[12.5px] leading-[1.55] text-klaz-ink outline-none focus:border-klaz-accent"
      />
      <div className="mt-2 flex items-center justify-between">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-klaz-faint">
          {content.length.toLocaleString()} chars
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-klaz-line bg-klaz-panel px-3 py-1.5 text-[13px] text-klaz-ink2 transition hover:bg-klaz-line2"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className={cn(
              "rounded-md bg-klaz-accent px-4 py-1.5 text-[13px] font-medium text-white transition hover:bg-klaz-accent2 disabled:opacity-50"
            )}
          >
            {saving
              ? "Saving…"
              : mode === "create"
              ? "Add material"
              : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  )
}

function KindChip({ kind }: { kind: Kind }) {
  const label =
    kind === "syllabus"
      ? "Syllabus"
      : kind === "lesson"
      ? "Lesson"
      : "Notes"
  const cls =
    kind === "syllabus"
      ? "bg-klaz-accent-bg text-klaz-accent border-[#eac3b1]"
      : kind === "lesson"
      ? "bg-klaz-ok-bg text-klaz-ok border-[#cfdcae]"
      : "bg-klaz-line2 text-klaz-muted border-klaz-line"
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-[1px] font-mono text-[9.5px] font-medium uppercase tracking-[0.08em]",
        cls
      )}
    >
      {label}
    </span>
  )
}
