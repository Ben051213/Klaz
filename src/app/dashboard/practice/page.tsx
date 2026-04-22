import { Card, CardContent } from "@/components/ui/card"
import { PracticeSetCard } from "@/components/PracticeSetCard"
import { createClient } from "@/lib/supabase/server"
import { formatDateTime } from "@/lib/utils"

// Teacher-only reference view. After a session ends, Klaz auto-generates
// follow-up questions targeting each student's weak topics. They stay here
// as prep material for the teacher — students never see them directly.
export default async function SuggestedFollowUps() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: sets } = await supabase
    .from("practice_sets")
    .select(
      "id, topics, status, created_at, student_id, profiles(id, name), sessions!inner(id, title, class_id, classes!inner(teacher_id, name)), practice_items(id, question, answer, hint, difficulty, sort_order)"
    )
    .eq("sessions.classes.teacher_id", user.id)
    .order("created_at", { ascending: false })

  // Supabase can return to-one relations as either an object or a
  // single-element array — normalize both shapes so the template never
  // blows up on r.profiles?.name etc.
  type Profile = { id: string; name: string }
  type ClassRel = { teacher_id: string; name: string }
  type SessionRel = {
    id: string
    title: string
    class_id: string
    classes: ClassRel | ClassRel[] | null
  }
  type PracticeItem = {
    id: string
    question: string
    answer: string
    hint: string | null
    difficulty: "easy" | "medium" | "hard" | null
    sort_order: number
  }
  type RawRow = {
    id: string
    topics: string[]
    status: string
    created_at: string
    student_id: string
    profiles: Profile | Profile[] | null
    sessions: SessionRel | SessionRel[] | null
    practice_items: PracticeItem[]
  }
  type Row = {
    id: string
    topics: string[]
    status: string
    created_at: string
    student_id: string
    profiles: Profile | null
    sessions:
      | (Omit<SessionRel, "classes"> & { classes: ClassRel | null })
      | null
    practice_items: PracticeItem[]
  }
  const pickOne = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? v[0] ?? null : v ?? null
  const rows: Row[] = ((sets as RawRow[] | null) ?? []).map((r) => {
    const sess = pickOne(r.sessions)
    return {
      id: r.id,
      topics: r.topics,
      status: r.status,
      created_at: r.created_at,
      student_id: r.student_id,
      profiles: pickOne(r.profiles),
      sessions: sess
        ? {
            id: sess.id,
            title: sess.title,
            class_id: sess.class_id,
            classes: pickOne(sess.classes),
          }
        : null,
      practice_items: r.practice_items ?? [],
    }
  })

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy">
          Suggested follow-ups
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          AI-generated questions targeting each student&apos;s weak topics —
          use these to plan your next session. Students do not see these.
        </p>
      </div>
      {rows.length === 0 ? (
        <Card className="mt-6 border-dashed bg-white">
          <CardContent className="py-12 text-center text-sm text-slate-500">
            Nothing suggested yet. End a session to generate follow-ups for
            students who struggled with specific topics.
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 space-y-4">
          {rows.map((r) => (
            <div key={r.id}>
              <p className="mb-1 text-xs text-slate-400">
                {r.sessions?.classes?.name ?? "Class"} ·{" "}
                {r.sessions?.title ?? "Session"} ·{" "}
                {formatDateTime(r.created_at)}
              </p>
              <PracticeSetCard
                studentName={r.profiles?.name}
                topics={r.topics}
                items={[...r.practice_items].sort(
                  (a, b) => a.sort_order - b.sort_order
                )}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
