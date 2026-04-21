import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function JoinRedirect({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  const { code } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    const target = code ? `/signup?code=${encodeURIComponent(code)}` : "/signup"
    redirect(target)
  }
  redirect(`/learn${code ? `?code=${encodeURIComponent(code)}` : ""}`)
}
