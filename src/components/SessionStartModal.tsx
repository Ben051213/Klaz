"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const MAX_PDF_BYTES = 10 * 1024 * 1024

export function SessionStartModal({ classId }: { classId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [lessonPlan, setLessonPlan] = useState("")
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  function onPdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    if (f && f.size > MAX_PDF_BYTES) {
      toast.error("PDF is larger than 10MB. Please upload a smaller file.")
      e.target.value = ""
      setPdfFile(null)
      return
    }
    if (f && f.type && f.type !== "application/pdf") {
      toast.error("Please upload a PDF file.")
      e.target.value = ""
      setPdfFile(null)
      return
    }
    setPdfFile(f)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    // If a PDF is attached we must use multipart; otherwise stick with JSON.
    let res: Response
    if (pdfFile) {
      const form = new FormData()
      form.set("class_id", classId)
      form.set("title", title)
      if (lessonPlan) form.set("lesson_plan", lessonPlan)
      form.set("lesson_plan_pdf", pdfFile)
      res = await fetch("/api/sessions", { method: "POST", body: form })
    } else {
      res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_id: classId,
          title,
          lesson_plan: lessonPlan || undefined,
        }),
      })
    }
    const data = await res.json().catch(() => ({} as { error?: string }))
    setLoading(false)
    if (!res.ok) {
      toast.error(data.error || "Could not start session")
      return
    }
    setOpen(false)
    router.push(`/dashboard/session/${data.session.id}`)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="rounded-md bg-klaz-accent px-4 py-2 text-[13.5px] font-medium text-white transition hover:bg-klaz-accent2" />
        }
      >
        ◉ Start session
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-[24px] font-normal tracking-[-0.01em] text-klaz-ink">
            Start a new session<span className="text-klaz-accent">.</span>
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="session-title"
              className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-klaz-muted"
            >
              Session title
            </Label>
            <Input
              id="session-title"
              placeholder="Cell division – mitosis vs meiosis"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="lesson-plan-pdf"
              className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-klaz-muted"
            >
              Lesson plan PDF (optional)
            </Label>
            <Input
              id="lesson-plan-pdf"
              type="file"
              accept="application/pdf"
              onChange={onPdfChange}
              className="cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-klaz-line2 file:px-3 file:py-1 file:text-xs file:font-medium hover:file:bg-klaz-line"
            />
            <p className="text-[11.5px] text-klaz-muted">
              Upload your tutor centre&apos;s lesson plan PDF (max 10MB). Klaz
              will extract the main topic, objectives, examples, and
              vocabulary so the AI tutor stays on-script.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="lesson-plan"
              className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-klaz-muted"
            >
              Or paste a lesson outline (optional)
            </Label>
            <textarea
              id="lesson-plan"
              placeholder="Paste today's lesson outline…"
              value={lessonPlan}
              onChange={(e) => setLessonPlan(e.target.value)}
              rows={5}
              className="flex w-full rounded-lg border border-klaz-line bg-klaz-panel2 px-3 py-2.5 text-[13.5px] text-klaz-ink outline-none transition placeholder:text-klaz-faint focus:border-klaz-accent focus:ring-2 focus:ring-klaz-accent/20"
            />
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={loading}
              className="rounded-md bg-klaz-accent px-4 py-2 text-[13.5px] font-medium text-white transition hover:bg-klaz-accent2 disabled:opacity-60"
            >
              {loading ? "Starting…" : "Start session →"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
