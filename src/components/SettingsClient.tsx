"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"

type Profile = {
  id: string
  name: string
  email: string
  role: "teacher" | "student"
}

// Single settings surface — warm editorial, role-aware. Three sections:
//   · Profile: name (email is read-only for now; changing it affects auth)
//   · Password: Supabase auth.updateUser
//   · Classes: teachers archive/unarchive; students leave
// Kept intentionally plain (no shadcn forms) so the visual matches the
// rest of the Klaz surfaces.

export function SettingsClient({
  profile,
  ownedClasses,
  enrolledClasses,
}: {
  profile: Profile
  ownedClasses: { id: string; name: string; is_active: boolean }[]
  enrolledClasses: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [name, setName] = useState(profile.name)
  const [pending, startTransition] = useTransition()
  const [password, setPassword] = useState("")
  const [passwordPending, setPasswordPending] = useState(false)

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("Name can't be empty")
      return
    }
    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase
        .from("profiles")
        .update({ name: name.trim() })
        .eq("id", profile.id)
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success("Name updated")
      router.refresh()
    })
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      toast.error("Use at least 8 characters")
      return
    }
    setPasswordPending(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setPasswordPending(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success("Password updated")
    setPassword("")
  }

  async function toggleArchive(classId: string, nextActive: boolean) {
    const supabase = createClient()
    const { error } = await supabase
      .from("classes")
      .update({ is_active: nextActive })
      .eq("id", classId)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(nextActive ? "Unarchived" : "Archived")
    router.refresh()
  }

  async function leaveClass(classId: string, className: string) {
    const ok = window.confirm(`Leave ${className}?`)
    if (!ok) return
    const supabase = createClient()
    const { error } = await supabase
      .from("class_enrollments")
      .delete()
      .eq("student_id", profile.id)
      .eq("class_id", classId)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(`Left ${className}`)
    router.refresh()
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-[34px] font-normal leading-none tracking-[-0.02em] text-klaz-ink sm:text-[40px]">
          Settings<span className="text-klaz-accent">.</span>
        </h1>
        <p className="mt-2 text-[13px] text-klaz-muted">
          Account, password, and class membership.
        </p>
      </div>

      {/* ── Profile ── */}
      <section className="rounded-lg border border-klaz-line bg-klaz-panel p-5">
        <SectionHeader
          label="Profile"
          title="Your details"
          sub="Shown on your classes and in messages to your teacher."
        />
        <form onSubmit={saveProfile} className="mt-4 space-y-4">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 w-full rounded-md border border-klaz-line bg-klaz-panel2 px-3 text-[13.5px] text-klaz-ink focus:border-klaz-accent focus:outline-none focus:ring-2 focus:ring-klaz-accent/20"
            />
          </Field>
          <Field label="Email">
            <input
              value={profile.email}
              disabled
              className="h-10 w-full rounded-md border border-klaz-line bg-klaz-line2/50 px-3 text-[13.5px] text-klaz-muted"
            />
            <p className="mt-1 text-[11.5px] text-klaz-faint">
              Email changes are handled through support for now.
            </p>
          </Field>
          <Field label="Role">
            <div className="inline-flex items-center rounded-full bg-klaz-line2 px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.08em] text-klaz-ink2">
              {profile.role}
            </div>
          </Field>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pending || name.trim() === profile.name.trim()}
              className="h-9 rounded-md bg-klaz-ink px-4 text-[13px] font-medium text-klaz-bg transition hover:bg-klaz-deep disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </section>

      {/* ── Password ── */}
      <section className="rounded-lg border border-klaz-line bg-klaz-panel p-5">
        <SectionHeader
          label="Security"
          title="Change password"
          sub="At least 8 characters."
        />
        <form onSubmit={changePassword} className="mt-4 space-y-4">
          <Field label="New password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="••••••••"
              className="h-10 w-full rounded-md border border-klaz-line bg-klaz-panel2 px-3 text-[13.5px] text-klaz-ink focus:border-klaz-accent focus:outline-none focus:ring-2 focus:ring-klaz-accent/20"
            />
          </Field>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={passwordPending || password.length < 8}
              className="h-9 rounded-md bg-klaz-ink px-4 text-[13px] font-medium text-klaz-bg transition hover:bg-klaz-deep disabled:opacity-50"
            >
              {passwordPending ? "Updating…" : "Update password"}
            </button>
          </div>
        </form>
      </section>

      {/* ── Classes ── */}
      <section className="rounded-lg border border-klaz-line bg-klaz-panel p-5">
        <SectionHeader
          label="Classes"
          title={profile.role === "teacher" ? "Your classes" : "Enrolled"}
          sub={
            profile.role === "teacher"
              ? "Archive a class to hide it from the dashboard without deleting its history."
              : "Leave a class you no longer need."
          }
        />
        {profile.role === "teacher" ? (
          ownedClasses.length === 0 ? (
            <p className="mt-4 text-[12.5px] text-klaz-muted">
              You haven&apos;t created any classes yet.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-klaz-line2">
              {ownedClasses.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-medium text-klaz-ink">
                      {c.name}
                    </div>
                    <div className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-klaz-faint">
                      {c.is_active ? "Active" : "Archived"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleArchive(c.id, !c.is_active)}
                    className="h-8 shrink-0 rounded-md border border-klaz-line bg-klaz-panel2 px-3 text-[12px] font-medium text-klaz-ink2 transition hover:bg-klaz-line2"
                  >
                    {c.is_active ? "Archive" : "Unarchive"}
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : enrolledClasses.length === 0 ? (
          <p className="mt-4 text-[12.5px] text-klaz-muted">
            You aren&apos;t enrolled in any classes yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-klaz-line2">
            {enrolledClasses.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="truncate text-[13.5px] font-medium text-klaz-ink">
                  {c.name}
                </div>
                <button
                  type="button"
                  onClick={() => leaveClass(c.id, c.name)}
                  className="h-8 shrink-0 rounded-md border border-klaz-line bg-klaz-panel2 px-3 text-[12px] font-medium text-klaz-bad transition hover:bg-klaz-line2"
                >
                  Leave
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function SectionHeader({
  label,
  title,
  sub,
}: {
  label: string
  title: string
  sub: string
}) {
  return (
    <div>
      <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-klaz-faint">
        {label}
      </div>
      <div className="mt-1 font-serif text-[20px] leading-none tracking-[-0.01em] text-klaz-ink">
        {title}
      </div>
      <p className="mt-1.5 text-[12.5px] text-klaz-muted">{sub}</p>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-klaz-faint">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  )
}
