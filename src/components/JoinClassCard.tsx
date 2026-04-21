"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export function JoinClassCard() {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
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
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="text-base text-brand-navy">
          Join a class
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-wrap gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Enter 6-character code"
            maxLength={6}
            className="flex-1 min-w-0 font-mono uppercase tracking-widest"
            required
          />
          <Button
            type="submit"
            disabled={loading || code.length < 4}
            className="bg-brand-teal hover:bg-brand-teal/90"
          >
            {loading ? "Joining…" : "Join"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
