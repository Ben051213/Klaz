import { redirect } from "next/navigation"
import { StudentPracticeList } from "@/components/StudentPracticeList"
import { createClient } from "@/lib/supabase/server"

// Student practice — shows everything the teacher has assigned to this
// student across every enrolled class. Students can mark sets complete
// after they've worked through them.

export default async function StudentPracticePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: sets } = await supabase
    .from("practice_sets")
    .select(
      "id, class_id, session_id, topics, title, assigned_at, completed_at, created_at, status, items:practice_items(id, question, hint, difficulty, sort_order, answer), sessions(title), classes(name, subject)"
    )
    .eq("student_id", user.id)
    .eq("status", "sent")
    .order("assigned_at", { ascending: false })

  type Item = {
    id: string
    question: string
    hint: string | null
    difficulty: "easy" | "medium" | "hard" | null
    sort_order: number | null
    answer: string
  }
  type RawSet = {
    id: string
    class_id: string | null
    session_id: string | null
    topics: string[]
    title: string | null
    assigned_at: string | null
    completed_at: string | null
    created_at: string
    status: "pending" | "approved" | "sent"
    items: Item[] | null
    sessions: { title: string } | { title: string }[] | null
    classes:
      | { name: string; subject: string }
      | { name: string; subject: string }[]
      | null
  }
  const raw = (sets as RawSet[] | null) ?? []

  const flattened = raw.map((r) => {
    const session = Array.isArray(r.sessions) ? r.sessions[0] : r.sessions
    const klass = Array.isArray(r.classes) ? r.classes[0] : r.classes
    const items = (r.items ?? [])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    return {
      id: r.id,
      className: klass?.name ?? "Class",
      subject: klass?.subject ?? "",
      sessionTitle: session?.title ?? null,
      topics: r.topics ?? [],
      title: r.title,
      assignedAt: r.assigned_at,
      completedAt: r.completed_at,
      createdAt: r.created_at,
      items,
    }
  })

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <div>
        <h1 className="font-serif text-[34px] font-normal leading-none tracking-[-0.02em] text-klaz-ink sm:text-[40px]">
          Practice<span className="text-klaz-accent">.</span>
        </h1>
        <p className="mt-2 text-[13px] text-klaz-muted">
          Questions your teacher assigned. Mark a set complete when
          you&apos;ve worked through it — answers reveal after you try.
        </p>
      </div>

      <div className="mt-6">
        <StudentPracticeList sets={flattened} />
      </div>
    </div>
  )
}
