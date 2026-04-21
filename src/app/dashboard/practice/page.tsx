import { Card, CardContent } from "@/components/ui/card"
import { PracticeSetCard } from "@/components/PracticeSetCard"
import { createClient } from "@/lib/supabase/server"

export default async function PracticeReview() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: sets } = await supabase
    .from("practice_sets")
    .select(
      "id, topics, status, created_at, student_id, profiles(id, name), sessions!inner(id, class_id, classes!inner(teacher_id)), practice_items(id, question, answer, hint, difficulty, sort_order)"
    )
    .eq("status", "pending")
    .eq("sessions.classes.teacher_id", user.id)
    .order("created_at", { ascending: false })

  type Row = {
    id: string
    topics: string[]
    status: string
    created_at: string
    student_id: string
    profiles: { id: string; name: string } | null
    practice_items: {
      id: string
      question: string
      answer: string
      hint: string | null
      difficulty: "easy" | "medium" | "hard" | null
      sort_order: number
    }[]
  }
  const rows = (sets as Row[] | null) ?? []

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy">
          Practice review
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          AI-generated practice sets waiting for your approval.
        </p>
      </div>
      {rows.length === 0 ? (
        <Card className="mt-6 border-dashed bg-white">
          <CardContent className="py-12 text-center text-sm text-slate-500">
            Nothing pending. Finish a session to generate new practice sets.
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 space-y-4">
          {rows.map((r) => (
            <PracticeSetCard
              key={r.id}
              setId={r.id}
              studentName={r.profiles?.name}
              topics={r.topics}
              items={[...r.practice_items].sort(
                (a, b) => a.sort_order - b.sort_order
              )}
              canApprove
            />
          ))}
        </div>
      )}
    </div>
  )
}
