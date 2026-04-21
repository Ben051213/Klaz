import { redirect } from "next/navigation"
import { NavBar } from "@/components/NavBar"
import { createClient } from "@/lib/supabase/server"

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

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <NavBar role="student" name={profile.name} />
      <main className="flex-1">{children}</main>
    </div>
  )
}
