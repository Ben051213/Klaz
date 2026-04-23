import { redirect } from "next/navigation"
import { SettingsClient } from "@/components/SettingsClient"
import { createClient } from "@/lib/supabase/server"

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, email, role, created_at")
    .eq("id", user.id)
    .single()
  if (!profile) redirect("/login")

  const isTeacher = profile.role === "teacher"

  let ownedClasses: { id: string; name: string; is_active: boolean }[] = []
  let enrolledClasses: { id: string; name: string }[] = []

  if (isTeacher) {
    const { data } = await supabase
      .from("classes")
      .select("id, name, is_active")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false })
    ownedClasses = (data as typeof ownedClasses | null) ?? []
  } else {
    const { data } = await supabase
      .from("class_enrollments")
      .select("classes(id, name)")
      .eq("student_id", user.id)
    type Row = {
      classes:
        | { id: string; name: string }
        | { id: string; name: string }[]
        | null
    }
    const rows = (data as Row[] | null) ?? []
    enrolledClasses = rows
      .map((r) => (Array.isArray(r.classes) ? r.classes[0] ?? null : r.classes))
      .filter(Boolean) as typeof enrolledClasses
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <SettingsClient
        profile={{
          id: profile.id,
          name: profile.name,
          email: profile.email,
          role: profile.role as "teacher" | "student",
        }}
        ownedClasses={ownedClasses}
        enrolledClasses={enrolledClasses}
      />
    </div>
  )
}
