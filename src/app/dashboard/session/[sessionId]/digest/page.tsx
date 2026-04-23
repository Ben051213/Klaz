import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { SessionDigest } from "@/components/SessionDigest"
import { createClient } from "@/lib/supabase/server"

// Post-session digest — a print-friendly / copyable summary the teacher can
// share in the class WhatsApp / parent update / lesson notebook. Composed
// entirely from data we already wrote during the session:
//   - topics that surfaced (ranked by confusion × volume)
//   - students who are now "at risk" (avg topic score < 65)
//   - top questions asked
//   - practice that was auto-generated + its per-student status
// No new AI call — it's a view, not a generation. That keeps it cheap and
// makes it re-openable any time without re-billing.

export default async function SessionDigestPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: session } = await supabase
    .from("sessions")
    .select(
      "id, title, status, class_id, started_at, ended_at, classes(id, name, subject, grade, teacher_id)"
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
      grade: string | null
      teacher_id: string
    } | null
  }
  const s = session as S | null
  if (!s) notFound()
  if (s.classes?.teacher_id !== user.id) redirect("/dashboard")

  // Pull messages, roster, topic scores, and practice sets in parallel.
  const [messagesRes, rosterRes, scoresRes, practiceRes] = await Promise.all([
    supabase
      .from("messages")
      .select(
        "id, student_id, student_text, topics, confidence_signal, created_at"
      )
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true }),
    supabase
      .from("class_enrollments")
      .select("student_id, profiles(id, name, email)")
      .eq("class_id", s.class_id),
    supabase
      .from("student_topic_scores")
      .select("student_id, topic, score")
      .eq("class_id", s.class_id),
    supabase
      .from("practice_sets")
      .select(
        "id, student_id, status, assigned_at, completed_at, topics, profiles(id, name), practice_items(id, question)"
      )
      .eq("session_id", sessionId),
  ])

  type MsgRow = {
    id: string
    student_id: string
    student_text: string
    topics: string[] | null
    confidence_signal: "confused" | "partial" | "understood" | null
    created_at: string
  }
  type RosterRow = {
    student_id: string
    profiles: { id: string; name: string; email: string } | null
  }
  type ScoreRow = { student_id: string; topic: string; score: number }
  type PracticeRow = {
    id: string
    student_id: string
    status: "pending" | "approved" | "sent"
    assigned_at: string | null
    completed_at: string | null
    topics: string[] | null
    profiles:
      | { id: string; name: string }
      | { id: string; name: string }[]
      | null
    practice_items: { id: string; question: string }[] | null
  }
  const pickOne = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? v[0] ?? null : v ?? null

  const messages = (messagesRes.data as MsgRow[] | null) ?? []
  const rosterRaw = (rosterRes.data as RosterRow[] | null) ?? []
  const scores = (scoresRes.data as ScoreRow[] | null) ?? []
  const practice = (
    (practiceRes.data as PracticeRow[] | null) ?? []
  ).map((p) => ({
    id: p.id,
    studentId: p.student_id,
    status: p.status,
    assignedAt: p.assigned_at,
    completedAt: p.completed_at,
    topics: p.topics ?? [],
    studentName: pickOne(p.profiles)?.name ?? "Student",
    itemCount: (p.practice_items ?? []).length,
  }))

  const roster = rosterRaw
    .filter((r) => r.profiles)
    .map((r) => ({
      id: r.profiles!.id,
      name: r.profiles!.name,
      email: r.profiles!.email,
    }))
  const nameById = new Map(roster.map((r) => [r.id, r.name] as const))

  // Topic ranking: count volume + confusion per topic.
  const byTopic = new Map<
    string,
    { total: number; confused: number; students: Set<string> }
  >()
  for (const m of messages) {
    if (!m.topics) continue
    for (const t of m.topics) {
      const entry =
        byTopic.get(t) ??
        { total: 0, confused: 0, students: new Set<string>() }
      entry.total += 1
      if (m.confidence_signal === "confused") entry.confused += 1
      entry.students.add(m.student_id)
      byTopic.set(t, entry)
    }
  }
  const topicStats = [...byTopic.entries()]
    .map(([topic, v]) => ({
      topic,
      total: v.total,
      confused: v.confused,
      students: v.students.size,
      confusionPct:
        v.total === 0 ? 0 : Math.round((v.confused / v.total) * 100),
    }))
    .sort((a, b) => {
      // Weight confusion first, then raw volume.
      const aScore = a.confusionPct * 2 + a.total
      const bScore = b.confusionPct * 2 + b.total
      return bScore - aScore
    })

  // Per-student avg (average topic score across the whole class) — surfaces
  // who's under 65% and should be flagged in the digest.
  const perStudent = new Map<string, { total: number; n: number }>()
  for (const sc of scores) {
    const entry = perStudent.get(sc.student_id) ?? { total: 0, n: 0 }
    entry.total += sc.score
    entry.n += 1
    perStudent.set(sc.student_id, entry)
  }
  const studentStats = roster
    .map((r) => {
      const p = perStudent.get(r.id)
      const avg = p && p.n > 0 ? Math.round(p.total / p.n) : null
      const studentMsgs = messages.filter((m) => m.student_id === r.id)
      const confusedCount = studentMsgs.filter(
        (m) => m.confidence_signal === "confused"
      ).length
      return {
        id: r.id,
        name: r.name,
        avg,
        msgCount: studentMsgs.length,
        confusedCount,
      }
    })
    .sort((a, b) => (a.avg ?? 100) - (b.avg ?? 100))

  const atRisk = studentStats.filter(
    (s) => s.avg !== null && s.avg < 65 && s.msgCount > 0
  )

  // Top-5 questions by confusion × recency. Simpler heuristic: confused
  // questions first, then the rest.
  const questions = [...messages]
    .map((m) => ({
      id: m.id,
      text: m.student_text,
      who: nameById.get(m.student_id) ?? "Student",
      topic: m.topics?.[0] ?? null,
      confused: m.confidence_signal === "confused",
      at: m.created_at,
    }))
    .sort((a, b) => {
      if (a.confused !== b.confused) return a.confused ? -1 : 1
      return new Date(b.at).getTime() - new Date(a.at).getTime()
    })
    .slice(0, 8)

  const durationMinutes =
    s.ended_at
      ? Math.max(
          1,
          Math.round(
            (new Date(s.ended_at).getTime() -
              new Date(s.started_at).getTime()) /
              60_000
          )
        )
      : null

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="print:hidden">
        <Link
          href={`/dashboard/classes/${s.class_id}`}
          className="font-mono text-[11px] uppercase tracking-[0.08em] text-klaz-faint transition hover:text-klaz-ink2"
        >
          ← {s.classes?.name ?? "Class"}
        </Link>
      </div>
      <SessionDigest
        session={{
          id: s.id,
          title: s.title,
          status: s.status,
          startedAt: s.started_at,
          endedAt: s.ended_at,
          durationMinutes,
          className: s.classes?.name ?? "",
          subject: s.classes?.subject ?? "",
          grade: s.classes?.grade ?? null,
        }}
        topics={topicStats}
        atRisk={atRisk}
        topStudents={studentStats
          .filter((st) => st.avg !== null)
          .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))
          .slice(0, 3)}
        questions={questions}
        practice={practice}
        messageCount={messages.length}
        activeStudents={new Set(messages.map((m) => m.student_id)).size}
        rosterSize={roster.length}
      />
    </div>
  )
}
