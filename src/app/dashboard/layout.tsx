import { redirect } from "next/navigation"
import { NavBar } from "@/components/NavBar"
import { createClient } from "@/lib/supabase/server"

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

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <NavBar role="teacher" name={profile.name} />
      <main className="flex-1">{children}</main>
    </div>
  )
}
