import { redirect } from "next/navigation"
import { SideNav, type SideNavClass } from "@/components/SideNav"
import { createClient } from "@/lib/supabase/server"

// Teacher shell — cream left rail with the Klaz wordmark, role nav, and
// a dynamic list of the teacher's own classes (showing a live dot when a
// session is active so they can jump straight in).
export default async function DashboardLayout({
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
  if (profile.role !== "teacher") redirect("/learn")

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false })

  const classIds = (classes ?? []).map((c) => c.id)

  const [enrollmentCounts, activeSessions] = await Promise.all([
    classIds.length
      ? supabase
          .from("class_enrollments")
          .select("class_id")
          .in("class_id", classIds)
      : Promise.resolve({ data: [] as { class_id: string }[] }),
    classIds.length
      ? supabase
          .from("sessions")
          .select("class_id")
          .in("class_id", classIds)
          .eq("status", "active")
      : Promise.resolve({ data: [] as { class_id: string }[] }),
  ])

  const countByClass = new Map<string, number>()
  for (const e of enrollmentCounts.data ?? []) {
    countByClass.set(e.class_id, (countByClass.get(e.class_id) ?? 0) + 1)
  }
  const liveSet = new Set(
    (activeSessions.data ?? []).map((s) => s.class_id)
  )

  const navClasses: SideNavClass[] = (classes ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    studentCount: countByClass.get(c.id) ?? 0,
    live: liveSet.has(c.id),
  }))

  return (
    <div className="flex min-h-screen flex-col bg-klaz-bg lg:flex-row">
      <SideNav
        role="teacher"
        name={profile.name}
        classes={navClasses}
        orgLabel="Teacher"
      />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  )
}
