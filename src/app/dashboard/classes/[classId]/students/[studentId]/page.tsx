import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { KlazTitle } from "@/components/klaz/KlazTitle"
import { StudentTopicResolver } from "@/components/StudentTopicResolver"
import { TeacherStudentNoteEditor } from "@/components/TeacherStudentNoteEditor"
import { flavorClasses } from "@/lib/flavor"
import { createClient } from "@/lib/supabase/server"
import { formatRelative } from "@/lib/utils"

// Teacher-only student profile inside a class.
//   · Crumbs back to the class
//   · Big serif student name + subject context
//   · Headline numbers: sessions attended, questions asked, avg
//     topic score, weakest topic
//   · Topic resolver grid — every tagged topic, ordered weakest first,
//     with resolve/improve/reset buttons
//   · Question timeline — every question this student has asked in
//     this class, grouped by session
//   · Private teacher notes editor
//
// Only the class's own teacher can view this page; everyone else is
// bounced to /dashboard. Student never sees it.

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ classId: string; studentId: string }>
}) {
  const { classId, studentId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Ownership check — teacher of the class only.
  const { data: klass } = await supabase
    .from("classes")
    .select("id, name, subject, grade, teacher_id, flavor")
    .eq("id", classId)
    .single()
  if (!klass) notFound()
  if (klass.teacher_id !== user.id) redirect("/dashboard")

  // Verify the student is actually enrolled here (else a teacher
  // could probe foreign users).
  const { data: enrollmentRow } = await supabase
    .from("class_enrollments")
    .select("id, joined_at")
    .eq("class_id", classId)
    .eq("student_id", studentId)
    .maybeSingle()
  if (!enrollmentRow) notFound()

  const [
    profileRes,
    topicsRes,
    messagesRes,
    sessionsRes,
    noteRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, email")
      .eq("id", studentId)
      .single(),
    supabase
      .from("student_topic_scores")
      .select(
        "topic, score, teacher_override_at, teacher_note, last_updated"
      )
      .eq("class_id", classId)
      .eq("student_id", studentId),
    supabase
      .from("messages")
      .select(
        "id, session_id, student_text, ai_response, confidence_signal, topics, created_at"
      )
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("sessions")
      .select("id, title, started_at, ended_at, status")
      .eq("class_id", classId)
      .order("started_at", { ascending: false }),
    supabase
      .from("class_student_notes")
      .select("note, updated_at")
      .eq("class_id", classId)
      .eq("student_id", studentId)
      .maybeSingle(),
  ])

  const profile = profileRes.data as
    | { id: string; name: string; email: string }
    | null
  if (!profile) notFound()

  type TopicRow = {
    topic: string
    score: number
    teacher_override_at: string | null
    teacher_note: string | null
    last_updated: string | null
  }
  const topics = (topicsRes.data as TopicRow[] | null) ?? []

  type MessageRow = {
    id: string
    session_id: string
    student_text: string
    ai_response: string | null
    confidence_signal: string | null
    topics: string[] | null
    created_at: string
  }
  const messages = (messagesRes.data as MessageRow[] | null) ?? []

  type SessionRow = {
    id: string
    title: string
    started_at: string
    ended_at: string | null
    status: "active" | "ended"
  }
  const sessions = (sessionsRes.data as SessionRow[] | null) ?? []
  const sessionIds = new Set(sessions.map((s) => s.id))

  // Only show messages that belong to THIS class. A student's
  // `messages` rows span every class they're in — we filter down.
  const classMessages = messages.filter((m) => sessionIds.has(m.session_id))

  // Backfill topic list from messages when scores haven't landed yet
  // (rare — only during live sessions before the tagger catches up).
  const knownTopics = new Set(topics.map((t) => t.topic))
  for (const m of classMessages) {
    if (!Array.isArray(m.topics)) continue
    for (const t of m.topics) {
      if (!knownTopics.has(t)) {
        topics.push({
          topic: t,
          score: 50,
          teacher_override_at: null,
          teacher_note: null,
          last_updated: null,
        })
        knownTopics.add(t)
      }
    }
  }

  // Sort: weakest first, then tied scores alphabetically — so the
  // teacher's eye lands on what needs attention.
  topics.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score
    return a.topic.localeCompare(b.topic)
  })

  const headlineAvg =
    topics.length > 0
      ? Math.round(
          topics.reduce((sum, t) => sum + t.score, 0) / topics.length
        )
      : null
  const weakest = topics[0]?.score !== undefined ? topics[0] : null
  const attendedSessions = new Set(classMessages.map((m) => m.session_id))
    .size
  const totalQuestions = classMessages.length

  const noteRow =
    (noteRes.data as { note: string | null; updated_at: string } | null) ??
    null
  const initialNote = noteRow?.note ?? ""

  // Group questions by session for the timeline view.
  const byId = new Map(sessions.map((s) => [s.id, s]))
  const bySession = new Map<string, MessageRow[]>()
  for (const m of classMessages) {
    const bucket = bySession.get(m.session_id) ?? []
    bucket.push(m)
    bySession.set(m.session_id, bucket)
  }
  const grouped = [...bySession.entries()]
    .map(([id, msgs]) => ({ session: byId.get(id), msgs }))
    .filter((g): g is { session: SessionRow; msgs: MessageRow[] } =>
      Boolean(g.session)
    )
    .sort(
      (a, b) =>
        new Date(b.session.started_at).getTime() -
        new Date(a.session.started_at).getTime()
    )

  const flavor = flavorClasses(klass.flavor as string | null)

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href={`/dashboard/classes/${classId}`}
        className="font-mono text-[11px] uppercase tracking-[0.08em] text-klaz-faint transition hover:text-klaz-ink2"
      >
        ← {klass.name}
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className={`h-2 w-2 shrink-0 rounded-full ${flavor.dot}`}
            />
            <KlazTitle size="md">{profile.name}</KlazTitle>
          </div>
          <p className="mt-1.5 text-[12.5px] text-klaz-muted">
            {profile.email} · Enrolled {formatRelative(enrollmentRow.joined_at)}
            {klass.subject ? ` · ${klass.subject}` : ""}
            {klass.grade ? ` · ${klass.grade}` : ""}
          </p>
        </div>
      </div>

      {/* KPI row */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Sessions attended" value={attendedSessions} />
        <Kpi label="Questions asked" value={totalQuestions} />
        <Kpi
          label="Avg topic score"
          value={headlineAvg ?? "—"}
          suffix={headlineAvg != null ? "/100" : ""}
          tone={
            headlineAvg == null
              ? "neutral"
              : headlineAvg >= 70
                ? "ok"
                : headlineAvg >= 50
                  ? "warn"
                  : "bad"
          }
        />
        <Kpi
          label="Weakest topic"
          value={weakest?.topic ?? "—"}
          tone={weakest ? "bad" : "neutral"}
          small
        />
      </div>

      {/* Topic resolver */}
      <section className="mt-7">
        <div className="flex items-end justify-between">
          <div>
            <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-klaz-faint">
              Topics
            </div>
            <h2 className="mt-1 font-serif text-[22px] leading-none tracking-[-0.01em] text-klaz-ink">
              Where they are
            </h2>
          </div>
          <p className="max-w-xs text-right text-[11.5px] text-klaz-muted">
            Resolving locks the score for 14 days so a stray question
            doesn&apos;t un-resolve it.
          </p>
        </div>
        <div className="mt-4">
          <StudentTopicResolver
            classId={classId}
            studentId={studentId}
            topics={topics}
          />
        </div>
      </section>

      {/* Notes + timeline */}
      <section className="mt-7 grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-klaz-faint">
            Private notes
          </div>
          <h2 className="mt-1 font-serif text-[22px] leading-none tracking-[-0.01em] text-klaz-ink">
            Just for you
          </h2>
          {noteRow?.updated_at ? (
            <p className="mt-1 text-[11.5px] text-klaz-faint">
              Last updated {formatRelative(noteRow.updated_at)}
            </p>
          ) : null}
          <div className="mt-3">
            <TeacherStudentNoteEditor
              classId={classId}
              studentId={studentId}
              initialNote={initialNote}
            />
          </div>
        </div>

        <div>
          <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-klaz-faint">
            Questions
          </div>
          <h2 className="mt-1 font-serif text-[22px] leading-none tracking-[-0.01em] text-klaz-ink">
            What they asked
          </h2>
          {grouped.length === 0 ? (
            <p className="mt-3 text-[12.5px] text-klaz-muted">
              No questions yet. When they start asking Klaz, their
              transcript will show up here.
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-4">
              {grouped.map(({ session: s, msgs }) => (
                <div
                  key={s.id}
                  className="rounded-lg border border-klaz-line bg-klaz-panel p-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/dashboard/session/${s.id}`}
                        className="truncate font-serif text-[16px] leading-tight text-klaz-ink hover:text-klaz-accent2"
                      >
                        {s.title}
                      </Link>
                      <p className="mt-0.5 text-[11px] text-klaz-faint">
                        {formatRelative(s.started_at)} · {msgs.length}{" "}
                        question{msgs.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    {s.status === "active" ? (
                      <span className="shrink-0 rounded-full bg-klaz-accent-bg px-2 py-[1px] font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-klaz-accent2">
                        Live
                      </span>
                    ) : null}
                  </div>
                  <ol className="mt-3 flex flex-col gap-2.5">
                    {msgs.map((m) => (
                      <li
                        key={m.id}
                        className="rounded-md border border-klaz-line2 bg-klaz-panel2 p-2.5"
                      >
                        <p className="text-[13px] leading-[1.5] text-klaz-ink">
                          {m.student_text}
                        </p>
                        {m.confidence_signal || m.topics?.length ? (
                          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-klaz-faint">
                            {m.confidence_signal ?? ""}
                            {m.topics?.length
                              ? ` · ${m.topics.join(", ")}`
                              : ""}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function Kpi({
  label,
  value,
  suffix,
  tone = "neutral",
  small = false,
}: {
  label: string
  value: number | string
  suffix?: string
  tone?: "ok" | "warn" | "bad" | "neutral"
  small?: boolean
}) {
  const color =
    tone === "ok"
      ? "text-klaz-ok"
      : tone === "warn"
        ? "text-klaz-warn"
        : tone === "bad"
          ? "text-klaz-bad"
          : "text-klaz-ink"
  return (
    <div className="rounded-xl border border-klaz-line bg-klaz-panel p-3.5">
      <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-klaz-faint">
        {label}
      </div>
      <div
        className={`mt-1.5 font-serif ${
          small ? "text-[19px] leading-tight" : "text-[30px] leading-none"
        } tracking-[-0.01em] ${color}`}
      >
        {value}
        {suffix ? (
          <span className="text-[16px] text-klaz-faint">{suffix}</span>
        ) : null}
      </div>
    </div>
  )
}
