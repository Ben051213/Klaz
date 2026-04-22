import { notFound, redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PracticeSetCard } from "@/components/PracticeSetCard"
import { TeacherSessionView } from "@/components/TeacherSessionView"
import { createClient } from "@/lib/supabase/server"

export default async function TeacherSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: session } = await supabase
    .from("sessions")
    .select(
      "id, title, status, class_id, started_at, ended_at, classes(id, name, subject, teacher_id)"
    )
    .eq("id", sessionId)
    .single()
  type S = {
    id: string
    title: string
    status: "active" | "ended"
    class_id: string
    started_at: string
    ended_at: string | null
    classes: {
      id: string
      name: string
      subject: string
      teacher_id: string
    } | null
  }
  const s = session as S | null
  if (!s) notFound()
  if (s.classes?.teacher_id !== user.id) redirect("/dashboard")

  // Roster and practice sets fetched in parallel.
  const [rosterRes, practiceRes] = await Promise.all([
    supabase
      .from("class_enrollments")
      .select("student_id, profiles(id, name, email)")
      .eq("class_id", s.class_id),
    // Only show follow-ups for ended sessions. Practice sets are generated
    // when a session ends, so fetching them during a live session would
    // always be empty and the heading would look broken.
    s.status === "ended"
      ? supabase
          .from("practice_sets")
          .select(
            "id, topics, status, created_at, student_id, profiles(id, name), practice_items(id, question, answer, hint, difficulty, sort_order)"
          )
          .eq("session_id", s.id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
  ])

  type RosterRow = {
    student_id: string
    profiles: { id: string; name: string; email: string } | null
  }

  // Supabase can return the profiles to-one relation as either an object
  // or a single-element array depending on FK inference — normalize.
  type Profile = { id: string; name: string }
  type PracticeItem = {
    id: string
    question: string
    answer: string
    hint: string | null
    difficulty: "easy" | "medium" | "hard" | null
    sort_order: number
  }
  type RawPracticeRow = {
    id: string
    topics: string[]
    status: string
    created_at: string
    student_id: string
    profiles: Profile | Profile[] | null
    practice_items: PracticeItem[]
  }
  const pickOne = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? v[0] ?? null : v ?? null
  const practiceRows = (
    (practiceRes.data as RawPracticeRow[] | null) ?? []
  ).map((r) => ({
    id: r.id,
    topics: r.topics,
    student_id: r.student_id,
    profile: pickOne(r.profiles),
    items: [...(r.practice_items ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order
    ),
  }))

  return (
    <>
      <TeacherSessionView
        session={{
          id: s.id,
          title: s.title,
          status: s.status,
          classId: s.class_id,
          className: s.classes?.name ?? "",
          subject: s.classes?.subject ?? "",
          startedAt: s.started_at,
          endedAt: s.ended_at ?? undefined,
        }}
        roster={
          ((rosterRes.data as RosterRow[] | null) ?? [])
            .filter((r) => r.profiles)
            .map((r) => ({
              id: r.profiles!.id,
              name: r.profiles!.name,
              email: r.profiles!.email,
            }))
        }
      />

      {s.status === "ended" ? (
        <div className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-base text-brand-navy">
                Suggested follow-ups
              </CardTitle>
              <p className="text-xs text-slate-500">
                AI-generated practice questions targeting each student&apos;s
                weak topics from this session. Students do not see these —
                use them to prep the next class.
              </p>
            </CardHeader>
            <CardContent>
              {practiceRows.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  No follow-ups generated for this session yet. This happens
                  automatically a few seconds after a session ends — refresh
                  if you just ended it.
                </p>
              ) : (
                <div className="space-y-3">
                  {practiceRows.map((r) => (
                    <PracticeSetCard
                      key={r.id}
                      studentName={r.profile?.name}
                      topics={r.topics}
                      items={r.items}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  )
}
