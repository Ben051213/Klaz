import { redirect } from "next/navigation"
import { SideNav, type SideNavClass } from "@/components/SideNav"
import { createClient } from "@/lib/supabase/server"

// Student shell — mirrors the teacher side so a student always knows
// what class is live (pulsing dot next to the class name in the rail).
export default async function LearnLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, name")
    .eq("id", user.id)
    .single()

  if (!profile) redirect("/login")
  if (profile.role !== "student") redirect("/dashboard")

  const { data: enrollments } = await supabase
    .from("class_enrollments")
    .select("classes(id, name)")
    .eq("student_id", user.id)
    .order("joined_at", { ascending: false })

  type EnrollRow = {
    classes: { id: string; name: string } | { id: string; name: string }[] | null
  }
  const rows = (enrollments as EnrollRow[] | null) ?? []
  const klasses = rows
    .map((r) =>
      Array.isArray(r.classes) ? r.classes[0] ?? null : r.classes
    )
    .filter(Boolean) as { id: string; name: string }[]

  const classIds = klasses.map((c) => c.id)
  const { data: activeSessions } = classIds.length
    ? await supabase
        .from("sessions")
        .select("class_id")
        .in("class_id", classIds)
        .eq("status", "active")
    : { data: [] as { class_id: string }[] }
  const liveSet = new Set(
    (activeSessions ?? []).map((s) => s.class_id)
  )

  const navClasses: SideNavClass[] = klasses.map((c) => ({
    id: c.id,
    name: c.name,
    live: liveSet.has(c.id),
  }))

  return (
    <div className="flex min-h-screen flex-col bg-klaz-bg lg:flex-row">
      <SideNav
        role="student"
        name={profile.name}
        classes={navClasses}
        orgLabel="Student"
      />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  )
}
