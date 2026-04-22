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
      className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
    >
      {pending ? "Removing…" : "Remove"}
    </Button>
  )
}
