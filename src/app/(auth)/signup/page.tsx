"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { KlazTitle } from "@/components/klaz/KlazTitle"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import type { Role } from "@/lib/types"

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<Role>("teacher")
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role } },
    })
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success("Account created")
    router.push("/")
    router.refresh()
  }

  return (
    <div>
      <div className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-klaz-faint">
        Start for free
      </div>
      <KlazTitle size="md" className="mt-2">
        Create your Klaz account
      </KlazTitle>
      <p className="mt-2 text-[13px] text-klaz-muted">
        Set up a class in under 3 minutes.
      </p>

      <form onSubmit={onSubmit} className="mt-7 space-y-4">
        <div>
          <div className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-klaz-muted">
            I&apos;m a…
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {(["teacher", "student"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-[13.5px] font-medium transition",
                  role === r
                    ? "border-klaz-ink bg-klaz-ink text-klaz-bg"
                    : "border-klaz-line bg-klaz-panel2 text-klaz-ink2 hover:border-klaz-faint"
                )}
              >
                {r === "teacher" ? "Teacher" : "Student"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor="name"
            className="block font-mono text-[11.5px] uppercase tracking-[0.06em] text-klaz-muted"
          >
            Name
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1.5 w-full rounded-lg border border-klaz-line bg-klaz-panel2 px-3 py-2.5 text-[13.5px] text-klaz-ink outline-none transition focus:border-klaz-accent focus:ring-2 focus:ring-klaz-accent/20"
          />
        </div>

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
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            className="mt-1.5 w-full rounded-lg border border-klaz-line bg-klaz-panel2 px-3 py-2.5 text-[13.5px] text-klaz-ink outline-none transition focus:border-klaz-accent focus:ring-2 focus:ring-klaz-accent/20"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-lg bg-klaz-accent px-4 py-3 text-[14px] font-medium text-white transition hover:bg-klaz-accent2 disabled:opacity-60"
        >
          {loading ? "Creating account…" : "Create account →"}
        </button>
      </form>

      <p className="mt-5 text-center text-[13px] text-klaz-muted">
        Already have an account?{" "}
        <Link
          href="/login"
          className="border-b border-klaz-ink font-medium text-klaz-ink"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
