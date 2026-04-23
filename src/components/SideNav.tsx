"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import type { Role } from "@/lib/types"

// Warm cream left rail — the shell from the Figma Make redesign.
// Replaces the old top-bar nav. Sections mirror the design:
//   · Logo header (K avatar + italic serif wordmark + ⌘K hint)
//   · Role section (Teach / Learn) with primary destinations
//   · Classes section (dynamic list, pulled from the server layout)
//   · Account section (Settings, stubbed for now)
//   · Footer with the signed-in user + sign-out
//
// On <lg viewports we collapse to a thin top bar; the full rail is for
// desktop where the density pays off.

export type SideNavClass = {
  id: string
  name: string
  live?: boolean
  studentCount?: number | null
}

export function SideNav({
  role,
  name,
  classes,
  orgLabel,
}: {
  role: Role
  name?: string
  classes: SideNavClass[]
  orgLabel?: string
}) {
  const pathname = usePathname() ?? ""
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const isTeacher = role === "teacher"
  const homeHref = isTeacher ? "/dashboard" : "/learn"
  const homeLabel = isTeacher ? "Classes" : "My classes"
  const liveCount = classes.filter((c) => c.live).length

  // Nav items kept intentionally narrow:
  //   · "Classes" — the real entry point; the live-session badge hangs off
  //     it so you can still see at a glance if something is running, but
  //     clicking always lands on classes (where the live tile lives).
  //   · "Practice" — the one workflow surface that lives outside of class
  //     context on the student side. Teachers get to practice per class.
  //
  // An earlier pass had a separate "Live sessions" entry that linked back
  // to home — confusing, since home didn't surface the sessions list. A
  // separate "Practice queue" for teachers duplicated the per-class
  // drill-down with no shortcut benefit. Both removed.
  const primaryItems: NavItem[] = isTeacher
    ? [
        {
          label: "Classes",
          icon: "▦",
          href: "/dashboard",
          count: classes.length || undefined,
          badge: liveCount > 0 ? String(liveCount) : undefined,
          active:
            pathname === "/dashboard" ||
            pathname.startsWith("/dashboard/classes"),
        },
      ]
    : [
        {
          label: homeLabel,
          icon: "▦",
          href: homeHref,
          count: classes.length || undefined,
          badge: liveCount > 0 ? String(liveCount) : undefined,
          active:
            pathname === "/learn" || pathname.startsWith("/learn/session"),
        },
        // Progress tab intentionally removed — surfacing students' weak
        // topics to themselves discourages asking questions (the whole
        // point of Klaz). Motivation lives in the "ask 5 questions"
        // streak on /learn instead, and the teacher keeps the full
        // analytics view privately.
        {
          label: "Practice",
          icon: "⊞",
          href: "/learn/practice",
          active: pathname.startsWith("/learn/practice"),
        },
      ]

  // Classes section: list out to 6. Each one deep-links (teacher) or is
  // decorative/static (student — no per-class student page today).
  const classItems: NavItem[] = classes.slice(0, 6).map((c) => {
    const href = isTeacher
      ? `/dashboard/classes/${c.id}`
      : "/learn"
    const active = pathname === `/dashboard/classes/${c.id}`
    // Trim "· Period 3" style suffix so short labels fit the rail.
    const short = c.name.split(" · ")[0] ?? c.name
    return {
      label: short,
      icon: c.live ? "●" : "·",
      href,
      active,
      dim: !c.live && !active,
      sub:
        typeof c.studentCount === "number" && c.studentCount > 0
          ? String(c.studentCount)
          : undefined,
    }
  })

  return (
    <>
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-screen w-[224px] shrink-0 flex-col border-r border-klaz-line bg-klaz-panel lg:flex">
        <div className="flex items-center gap-2 border-b border-klaz-line2 px-4 py-3.5">
          <Link href={homeHref} className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-klaz-ink font-mono text-[11px] font-bold text-klaz-bg">
              K
            </span>
            <span className="font-serif text-[20px] leading-none tracking-[-0.01em] text-klaz-ink">
              Klaz
            </span>
          </Link>
          <span className="ml-auto rounded-[4px] bg-klaz-line2 px-1.5 py-0.5 font-mono text-[10px] text-klaz-faint">
            ⌘K
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-3">
          <NavSection title={isTeacher ? "Teach" : "Learn"} items={primaryItems} />
          {classItems.length > 0 ? (
            <NavSection title="Classes" items={classItems} />
          ) : null}
          <NavSection
            title="Account"
            items={[
              {
                label: "Settings",
                icon: "⚙",
                href: "/settings",
                active: pathname.startsWith("/settings"),
              },
              { label: "Sign out", icon: "→", onClick: signOut },
            ]}
          />
        </div>

        <div className="flex items-center gap-2 border-t border-klaz-line2 px-3 py-2.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-klaz-ink font-mono text-[11px] font-bold text-klaz-bg">
            {initialOf(name)}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[12px] font-medium text-klaz-ink">
              {name ?? "You"}
            </div>
            <div className="truncate text-[10.5px] text-klaz-faint">
              {orgLabel ?? (isTeacher ? "Teacher" : "Student")}
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-klaz-line bg-klaz-panel/90 px-4 py-2.5 backdrop-blur lg:hidden">
        <Link href={homeHref} className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-klaz-ink font-mono text-[11px] font-bold text-klaz-bg">
            K
          </span>
          <span className="font-serif text-[19px] leading-none tracking-[-0.01em] text-klaz-ink">
            Klaz
          </span>
        </Link>
        <div className="flex items-center gap-2">
          {name ? (
            <span className="hidden text-[12.5px] text-klaz-muted sm:inline">
              {name}
            </span>
          ) : null}
          <button
            type="button"
            onClick={signOut}
            className="rounded-md px-2.5 py-1 text-[12.5px] font-medium text-klaz-ink2 transition hover:bg-klaz-line2"
          >
            Sign out
          </button>
        </div>
      </header>
    </>
  )
}

type NavItem = {
  label: string
  icon: string
  href?: string
  active?: boolean
  badge?: string
  count?: number
  sub?: string
  dim?: boolean
  disabled?: boolean
  onClick?: () => void
}

function NavSection({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <div className="mb-3">
      <div className="px-2.5 pb-1 pt-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-klaz-faint">
        {title}
      </div>
      <div className="flex flex-col">
        {items.map((item, i) => (
          <NavRow key={`${item.label}-${i}`} item={item} />
        ))}
      </div>
    </div>
  )
}

function NavRow({ item }: { item: NavItem }) {
  const classes = cn(
    "flex items-center gap-2 rounded-[6px] px-2.5 py-[5px] text-[13px] transition",
    item.active
      ? "bg-klaz-line2 font-medium text-klaz-ink"
      : item.dim
        ? "text-klaz-muted hover:bg-klaz-line2/60 hover:text-klaz-ink2"
        : "text-klaz-ink2 hover:bg-klaz-line2/60 hover:text-klaz-ink",
    item.disabled && "opacity-60"
  )
  const inner = (
    <>
      <span className="w-3.5 text-center font-mono text-[11px] text-klaz-faint">
        {item.icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.count != null ? (
        <span className="font-mono text-[11px] text-klaz-faint">
          {item.count}
        </span>
      ) : null}
      {item.badge ? (
        <span className="rounded-full bg-klaz-accent px-1.5 py-[1px] text-[10px] font-semibold text-white">
          {item.badge}
        </span>
      ) : null}
      {item.sub ? (
        <span className="font-mono text-[10px] text-klaz-faint">
          {item.sub}
        </span>
      ) : null}
    </>
  )

  if (item.href && !item.disabled) {
    return (
      <Link href={item.href} className={classes}>
        {inner}
      </Link>
    )
  }
  if (item.onClick && !item.disabled) {
    return (
      <button
        type="button"
        onClick={item.onClick}
        className={cn(classes, "text-left")}
      >
        {inner}
      </button>
    )
  }
  return <div className={classes}>{inner}</div>
}

function initialOf(name?: string): string {
  if (!name) return "·"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return "·"
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase()
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase()
}
