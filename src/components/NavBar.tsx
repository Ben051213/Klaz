"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { Role } from "@/lib/types"

// Warm cream topbar with the Klaz wordmark and role-based links.
// The logo is an ink dot with an italic serif "K" — recurring motif
// across sidebar, auth panel, and favicon-style placements.

export function NavBar({ role, name }: { role: Role; name?: string }) {
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const links =
    role === "teacher"
      ? [{ href: "/dashboard", label: "Classes" }]
      : [{ href: "/learn", label: "My classes" }]

  return (
    <header className="sticky top-0 z-40 border-b border-klaz-line bg-klaz-panel/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-klaz-ink font-serif text-[15px] italic text-klaz-bg">
            K
          </span>
          <span className="font-serif text-[20px] leading-none tracking-tight text-klaz-ink">
            Klaz
          </span>
        </Link>
        <nav className="hidden items-center gap-1 sm:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-1.5 text-[13px] font-medium text-klaz-ink2 transition hover:bg-klaz-line2 hover:text-klaz-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {name ? (
            <span className="hidden text-[13px] text-klaz-muted sm:inline">
              {name}
            </span>
          ) : null}
          <button
            type="button"
            onClick={signOut}
            className="rounded-md px-3 py-1.5 text-[13px] font-medium text-klaz-ink2 transition hover:bg-klaz-line2"
          >
            Sign out
          </button>
        </div>
      </div>
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-klaz-line2 px-4 py-2 sm:hidden">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium text-klaz-ink2 hover:bg-klaz-line2"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
