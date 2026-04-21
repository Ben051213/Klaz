"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import type { Role } from "@/lib/types"

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
      ? [
          { href: "/dashboard", label: "Classes" },
          { href: "/dashboard/practice", label: "Practice Review" },
        ]
      : [
          { href: "/learn", label: "My Classes" },
          { href: "/learn/practice", label: "My Practice" },
        ]

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="text-lg font-bold text-brand-navy tracking-tight"
        >
          Klaz
        </Link>
        <nav className="hidden items-center gap-1 sm:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {name ? (
            <span className="hidden text-sm text-slate-500 sm:inline">
              {name}
            </span>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="text-slate-600"
          >
            Sign out
          </Button>
        </div>
      </div>
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 sm:hidden">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
