"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

export function RemoveStudentButton({
  classId,
  studentId,
  studentName,
}: {
  classId: string
  studentId: string
  studentName: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function handleRemove() {
    const confirmed = confirm(
      `Remove ${studentName} from this class? Their past messages stay for your records, but they'll lose access to future sessions.`
    )
    if (!confirmed) return
    setPending(true)
    try {
      const res = await fetch(
        `/api/classes/${classId}/enrollments/${studentId}`,
        { method: "DELETE" }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Remove failed" }))
        toast.error(err.error || "Remove failed")
        return
      }
      toast.success(`${studentName} removed`)
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={handleRemove}
      className="h-auto px-2 py-1 text-[11px] font-medium text-klaz-bad hover:bg-klaz-bad-bg hover:text-klaz-bad"
    >
      {pending ? "Removing…" : "Remove"}
    </Button>
  )
}
