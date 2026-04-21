import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CreateClassDialog } from "@/components/CreateClassDialog"
import { createClient } from "@/lib/supabase/server"
import { formatDateTime } from "@/lib/utils"

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: classes } = await supabase
    .from("classes")
    .select(
      "id, name, subject, grade, join_code, is_active, created_at, class_enrollments(count), sessions(id,status)"
    )
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false })

  type Row = {
    id: string
    name: string
    subject: string
    grade: string | null
    join_code: string
    is_active: boolean
    created_at: string
    class_enrollments: { count: number }[]
    sessions: { id: string; status: string }[]
  }
  const rows = (classes as Row[] | null) ?? []

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Your classes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create a class, share the join code, then start a session.
          </p>
        </div>
        <CreateClassDialog />
      </div>

      {rows.length === 0 ? (
        <Card className="mt-8 border-dashed bg-white">
          <CardContent className="py-12 text-center">
            <p className="text-slate-500">
              You haven&apos;t created a class yet.
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Click &ldquo;Create New Class&rdquo; to get your first join code.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => {
            const studentCount = c.class_enrollments?.[0]?.count ?? 0
            const hasLive = c.sessions?.some((s) => s.status === "active")
            return (
              <Card key={c.id} className="flex flex-col bg-white">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-brand-navy">{c.name}</CardTitle>
                    {hasLive ? (
                      <Badge className="bg-emerald-500 hover:bg-emerald-500">
                        Live Session
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-slate-500">
                    {c.subject}
                    {c.grade ? ` · ${c.grade}` : ""}
                  </p>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-4">
                  <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex items-center justify-between">
                      <span>Students</span>
                      <span className="font-medium text-slate-900">
                        {studentCount}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Join code</span>
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold tracking-widest text-brand-navy">
                        {c.join_code}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Created</span>
                      <span className="text-slate-500">
                        {formatDateTime(c.created_at)}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/classes/${c.id}`}
                    className="inline-flex items-center justify-center rounded-md bg-brand-navy px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-navy/90"
                  >
                    View class
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
