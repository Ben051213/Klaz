"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { KlazTitle } from "@/components/klaz/KlazTitle"
import { createClient } from "@/lib/supabase/client"

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    router.push("/")
    router.refresh()
  }

  return (
    <div>
      <div className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-klaz-faint">
        Welcome back
      </div>
      <KlazTitle size="md" className="mt-2">
        Sign in to Klaz
      </KlazTitle>
      <p className="mt-2 text-[13px] text-klaz-muted">
        Teachers and students, same door.
      </p>

      <form onSubmit={onSubmit} className="mt-7 space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block font-mono text-[11.5px] uppercase tracking-[0.06em] text-klaz-muted"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            className="mt-1.5 w-full rounded-lg border border-klaz-line bg-klaz-panel2 px-3 py-2.5 text-[13.5px] text-klaz-ink outline-none transition focus:border-klaz-accent focus:ring-2 focus:ring-klaz-accent/20"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="block font-mono text-[11.5px] uppercase tracking-[0.06em] text-klaz-muted"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="mt-1.5 w-full rounded-lg border border-klaz-line bg-klaz-panel2 px-3 py-2.5 text-[13.5px] text-klaz-ink outline-none transition focus:border-klaz-accent focus:ring-2 focus:ring-klaz-accent/20"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-lg bg-klaz-accent px-4 py-3 text-[14px] font-medium text-white transition hover:bg-klaz-accent2 disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in →"}
        </button>
      </form>

      <p className="mt-5 text-center text-[13px] text-klaz-muted">
        New to Klaz?{" "}
        <Link
          href="/signup"
          className="border-b border-klaz-ink font-medium text-klaz-ink"
        >
          Create an account
        </Link>
      </p>
    </div>
  )
}
