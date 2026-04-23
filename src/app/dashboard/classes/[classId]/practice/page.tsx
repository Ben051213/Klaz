import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ClassPracticeQueue } from "@/components/ClassPracticeQueue"
import { createClient } from "@/lib/supabase/server"

// Practice tab for a single class. Shows every practice set generated for
// students in this class — grouped by student, filterable by status, with
// assign/unassign actions. This is feature #2 in the current push: moving
// practice out from underneath the session detail page.

export default async function ClassPracticePage({
  params,
}: {
  params: Promise<{ classId: string }>
}) {
  const { classId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: klass } = await supabase
    .from("classes")
    .select("id, name, subject, teacher_id")
    .eq("id", classId)
    .single()
  if (!klass) notFound()
  if (klass.teacher_id !== user.id) redirect("/dashboard")

  // Practice sets: join items + student name. Scope to this class in two
  // ways: (a) explicit class_id on the set (new rows) or (b) indirectly via
  // sessions.class_id for legacy rows.
  const { data: classSessions } = await supabase
    .from("sessions")
    .select("id, title, started_at")
    .eq("class_id", classId)
    .order("started_at", { ascending: false })

  const sessionIds = (classSessions ?? []).map((s) => s.id)

  // Grab both class_id-linked and session-linked sets in one OR query.
  const orFilter = [`class_id.eq.${classId}`]
  if (sessionIds.length > 0) orFilter.push(`session_id.in.(${sessionIds.join(",")})`)

  const { data: sets } = await supabase
    .from("practice_sets")
    .select(
      "id, student_id, session_id, class_id, topics, status, title, assigned_at, completed_at, created_at, profiles:profiles!practice_sets_student_id_fkey(id, name), items:practice_items(id, question, answer, hint, difficulty, sort_order)"
    )
    .or(orFilter.join(","))
    .order("created_at", { ascending: false })

  type Item = {
    id: string
    question: string
    answer: string
    hint: string | null
    difficulty: "easy" | "medium" | "hard" | null
    sort_order: number | null
  }
  type Profile = { id: string; name: string }
  type RawSet = {
    id: string
    student_id: string
    session_id: string | null
    class_id: string | null
    topics: string[]
    status: "pending" | "approved" | "sent"
    title: string | null
    assigned_at: string | null
    completed_at: string | null
    created_at: string
    profiles: Profile | Profile[] | null
    items: Item[] | null
  }
  const raw = (sets as RawSet[] | null) ?? []

  const sessionTitleById = new Map(
    (classSessions ?? []).map((s) => [s.id, s.title] as const)
  )

  const flatSets = raw.map((r) => {
    const profile = Array.isArray(r.profiles) ? r.profiles[0] ?? null : r.profiles
    const sortedItems = (r.items ?? [])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    return {
      id: r.id,
      studentId: r.student_id,
      studentName: profile?.name ?? "Student",
      sessionId: r.session_id,
      sessionTitle: r.session_id
        ? sessionTitleById.get(r.session_id) ?? null
        : null,
      topics: r.topics ?? [],
      status: r.status,
      title: r.title,
      assignedAt: r.assigned_at,
      completedAt: r.completed_at,
      createdAt: r.created_at,
      items: sortedItems,
    }
  })

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <Link
        href={`/dashboard/classes/${classId}`}
        className="font-mono text-[11px] uppercase tracking-[0.08em] text-klaz-faint transition hover:text-klaz-ink2"
      >
        ← {klass.name}
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-[30px] font-normal leading-none tracking-[-0.02em] text-klaz-ink sm:text-[34px]">
            Practice queue<span className="text-klaz-accent">.</span>
          </h1>
          <p className="mt-2 text-[13px] text-klaz-muted">
            AI-generated questions from weak topics, per student. Assign a set
            and it appears in the student&apos;s Practice tab.
          </p>
        </div>
        <nav className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.08em] text-klaz-faint">
          <Link
            href={`/dashboard/classes/${classId}`}
            className="rounded px-2 py-1 transition hover:bg-klaz-line2"
          >
            Overview
          </Link>
          <span className="text-klaz-line">·</span>
          <span className="rounded bg-klaz-line2 px-2 py-1 text-klaz-ink">
            Practice
          </span>
        </nav>
      </div>

      <div className="mt-6">
        <ClassPracticeQueue sets={flatSets} />
      </div>
    </div>
  )
}
