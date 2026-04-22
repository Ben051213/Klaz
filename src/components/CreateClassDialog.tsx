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

export function CreateClassDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [subject, setSubject] = useState("")
  const [grade, setGrade] = useState("")
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, subject, grade: grade || undefined }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      toast.error(data.error || "Could not create class")
      return
    }
    toast.success(`Class created · code ${data.class.join_code}`)
    setOpen(false)
    setName("")
    setSubject("")
    setGrade("")
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="rounded-md bg-klaz-accent px-4 py-2 text-[13.5px] font-medium text-white transition hover:bg-klaz-accent2" />
        }
      >
        + New class
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-[24px] font-normal tracking-[-0.01em] text-klaz-ink">
            Create a new class
            <span className="text-klaz-accent">.</span>
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="name"
              className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-klaz-muted"
            >
              Class name
            </Label>
            <Input
              id="name"
              placeholder="Period 3 Biology"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="subject"
              className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-klaz-muted"
            >
              Subject
            </Label>
            <Input
              id="subject"
              placeholder="Biology"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="grade"
              className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-klaz-muted"
            >
              Grade (optional)
            </Label>
            <Input
              id="grade"
              placeholder="Year 10"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={loading}
              className="rounded-md bg-klaz-accent px-4 py-2 text-[13.5px] font-medium text-white transition hover:bg-klaz-accent2 disabled:opacity-60"
            >
              {loading ? "Creating…" : "Create class →"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
