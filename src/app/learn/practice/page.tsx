import { Card, CardContent } from "@/components/ui/card"
import { PracticeSetCard } from "@/components/PracticeSetCard"
import { createClient } from "@/lib/supabase/server"
import { formatDateTime } from "@/lib/utils"

export default async function StudentPractice() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: sets } = await supabase
    .from("practice_sets")
    .select(
      "id, topics, status, created_at, practice_items(id, question, answer, hint, difficulty, sort_order)"
    )
    .eq("student_id", user.id)
    .in("status", ["approved", "sent"])
    .order("created_at", { ascending: false })

  type Row = {
    id: string
    topics: string[]
    status: string
    created_at: string
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
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy">My practice</h1>
        <p className="mt-1 text-sm text-slate-500">
          Practice sets your teacher has approved for you.
        </p>
      </div>
      {rows.length === 0 ? (
        <Card className="mt-6 border-dashed bg-white">
          <CardContent className="py-12 text-center text-sm text-slate-500">
            Nothing assigned yet. Check back after your next session.
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 space-y-4">
          {rows.map((r) => (
            <div key={r.id}>
              <p className="mb-1 text-xs text-slate-400">
                Assigned {formatDateTime(r.created_at)}
              </p>
              <PracticeSetCard
                setId={r.id}
                topics={r.topics}
                items={[...r.practice_items].sort(
                  (a, b) => a.sort_order - b.sort_order
                )}
                revealEnabled
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
