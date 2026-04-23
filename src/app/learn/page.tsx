import Link from "next/link"
import { JoinClassCard } from "@/components/JoinClassCard"
import { LiveSessions } from "@/components/LiveSessions"
import { StudentSessionLog } from "@/components/StudentSessionLog"
import { createClient } from "@/lib/supabase/server"
import { flavorClasses } from "@/lib/flavor"
import { formatRelative } from "@/lib/utils"

// Student home — macaron edition.
//   · Serif "Your classes." title + metadata
//   · JoinClassCard
//   · LiveSessions banner (only when a teacher has one running)
//   · STREAK + TARGET bar — gentle motivation. "Ask 5 questions per
//     session to extend your streak." Replaces the old Progress tab
//     (which was shame-inducing for kids who need tutoring most).
//   · Enrolled class grid (with per-class flavor tint)
//   · Session log: every past session the student was part of, with
//     the questions they asked nested inline + any assigned practice
//     chip on the same row.

export default async function LearnHome() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: enrollments } = await supabase
    .from("class_enrollments")
    .select(
      "id, joined_at, classes(id, name, subject, grade, teacher_id, flavor, is_active, profiles:profiles!classes_teacher_id_fkey(name))"
    )
    .eq("student_id", user.id)
    .order("joined_at", { ascending: false })

  type EnrollmentRow = {
    id: string
    joined_at: string
    classes: {
      id: string
      name: string
      subject: string
      grade: string | null
      teacher_id: string
      flavor: string | null
      is_active: boolean | null
      profiles: { name: string } | null
    } | null
  }
  const rows = (enrollments as EnrollmentRow[] | null) ?? []

  // Drop archived classes — the teacher shouldn't have them cluttering
  // the student's view. Students can still see the history of past
  // sessions inside the session log, though.
  const activeRows = rows.filter(
    (r) => r.classes?.is_active !== false
  )

  const classIds = activeRows
    .map((r) => r.classes?.id)
    .filter((id): id is string => Boolean(id))
  const allEnrollmentClassIds = rows
    .map((r) => r.classes?.id)
    .filter((id): id is string => Boolean(id))

  // Fan out: active sessions, every past session for the session log,
  // each session's question count (for target %), and assigned practice.
  const [
    activeSessionsRes,
    pastSessionsRes,
    myMessagesRes,
    practiceRes,
  ] = await Promise.all([
    classIds.length
      ? supabase
          .from("sessions")
          .select("id, title, class_id")
          .in("class_id", classIds)
          .eq("status", "active")
      : Promise.resolve({ data: [] as { id: string; title: string; class_id: string }[] }),
    allEnrollmentClassIds.length
      ? supabase
          .from("sessions")
          .select("id, title, class_id, started_at, ended_at, status")
          .in("class_id", allEnrollmentClassIds)
          .order("started_at", { ascending: false })
          .limit(30)
      : Promise.resolve({
          data: [] as {
            id: string
            title: string
            class_id: string
            started_at: string
            ended_at: string | null
            status: "active" | "ended"
          }[],
        }),
    // My own messages. Ask/answer pairs across every session I've been
    // in. Used to build the session log + count toward streak.
    supabase
      .from("messages")
      .select(
        "id, session_id, student_text, ai_response, created_at"
      )
      .eq("student_id", user.id)
      .order("created_at", { ascending: true }),
    // Practice sets assigned to me.
    supabase
      .from("practice_sets")
      .select(
        "id, session_id, class_id, status, assigned_at, completed_at, topics, title"
      )
      .eq("student_id", user.id),
  ])

  const activeSessions =
    (activeSessionsRes.data as
      | { id: string; title: string; class_id: string }[]
      | null) ?? []

  type SessionRow = {
    id: string
    title: string
    class_id: string
    started_at: string
    ended_at: string | null
    status: "active" | "ended"
  }
  const pastSessions = (pastSessionsRes.data as SessionRow[] | null) ?? []

  type MsgRow = {
    id: string
    session_id: string
    student_text: string
    ai_response: string | null
    created_at: string
  }
  const myMessages = (myMessagesRes.data as MsgRow[] | null) ?? []

  type PracticeRow = {
    id: string
    session_id: string | null
    class_id: string | null
    status: "pending" | "approved" | "sent"
    assigned_at: string | null
    completed_at: string | null
    topics: string[] | null
    title: string | null
  }
  const practice = (practiceRes.data as PracticeRow[] | null) ?? []

  const latestByClass = new Map<string, string>()
  for (const s of pastSessions) {
    if (!latestByClass.has(s.class_id))
      latestByClass.set(s.class_id, s.started_at)
  }

  const activeClassIds = new Set(activeSessions.map((s) => s.class_id))

  const initialSessions = activeSessions.map((s) => {
    const row = activeRows.find((r) => r.classes?.id === s.class_id)
    return {
      id: s.id,
      title: s.title,
      class_id: s.class_id,
      class: {
        id: row?.classes?.id ?? s.class_id,
        name: row?.classes?.name ?? "Class",
        subject: row?.classes?.subject ?? "",
      },
      teacherName: row?.classes?.profiles?.name,
    }
  })

  const enrolledClasses = activeRows
    .filter((r) => r.classes)
    .map((r) => ({
      id: r.classes!.id,
      name: r.classes!.name,
      subject: r.classes!.subject,
      teacher_name: r.classes!.profiles?.name,
    }))

  // ── Session log shape ───────────────────────────────────────────────
  // For each past session, bundle the student's questions + the assigned
  // practice set (if any). Only show sessions where the student actually
  // asked a question (otherwise the log is dominated by "I didn't show
  // up" rows, which is demotivating).
  const msgsBySession = new Map<string, MsgRow[]>()
  for (const m of myMessages) {
    const bucket = msgsBySession.get(m.session_id) ?? []
    bucket.push(m)
    msgsBySession.set(m.session_id, bucket)
  }
  const practiceBySession = new Map<string, PracticeRow>()
  for (const p of practice) {
    if (p.session_id) practiceBySession.set(p.session_id, p)
  }
  const classById = new Map(
    rows
      .filter((r) => r.classes)
      .map((r) => [r.classes!.id, r.classes!] as const)
  )

  const sessionLogEntries = pastSessions
    .filter((s) => (msgsBySession.get(s.id)?.length ?? 0) > 0)
    .map((s) => {
      const msgs = msgsBySession.get(s.id) ?? []
      const klass = classById.get(s.class_id)
      const practiceSet = practiceBySession.get(s.id)
      return {
        id: s.id,
        title: s.title,
        className: klass?.name ?? "Class",
        subject: klass?.subject ?? "",
        flavor: (klass?.flavor as string | null) ?? null,
        startedAt: s.started_at,
        endedAt: s.ended_at,
        status: s.status,
        questions: msgs.map((m) => ({
          id: m.id,
          text: m.student_text,
          response: m.ai_response,
          askedAt: m.created_at,
        })),
        practice: practiceSet
          ? {
              id: practiceSet.id,
              status: practiceSet.status,
              completedAt: practiceSet.completed_at,
              assignedAt: practiceSet.assigned_at,
              topicCount: (practiceSet.topics ?? []).length,
              title: practiceSet.title,
            }
          : null,
      }
    })

  // ── Streak calculation ──────────────────────────────────────────────
  // Walk past sessions newest → oldest. A session "counts" if the
  // student asked ≥5 questions. Consecutive counting sessions = the
  // streak. As soon as we hit a session with <5, stop.
  const TARGET = 5
  const completedSessions = pastSessions
    .filter((s) => s.status === "ended")
    .sort(
      (a, b) =>
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
    )
  let streak = 0
  for (const s of completedSessions) {
    const count = msgsBySession.get(s.id)?.length ?? 0
    if (count >= TARGET) streak++
    else break
  }

  // Today's target: if there's an active session, count toward it; else
  // use the latest in-progress state (always 0 if none).
  const activeForStreak = activeSessions[0]
  const activeAsked = activeForStreak
    ? msgsBySession.get(activeForStreak.id)?.length ?? 0
    : 0
  const activeRemaining = Math.max(0, TARGET - activeAsked)

  const enrolledCount = activeRows.length
  const liveCount = initialSessions.length
  const metaBits: string[] = []
  if (enrolledCount > 0) {
    metaBits.push(
      `${enrolledCount} class${enrolledCount === 1 ? "" : "es"} enrolled`
    )
  }
  if (liveCount > 0) {
    metaBits.push(
      `${liveCount} session${liveCount === 1 ? "" : "s"} live right now`
    )
  }
  const metaLine = metaBits.join(" · ")

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
      <div>
        <h1 className="font-serif text-[34px] font-normal leading-none tracking-[-0.02em] text-klaz-ink sm:text-[40px]">
          Your classes<span className="text-klaz-accent">.</span>
        </h1>
        {metaLine ? (
          <p className="mt-2 text-[13px] text-klaz-muted">{metaLine}</p>
        ) : (
          <p className="mt-2 text-[13px] text-klaz-muted">
            When a teacher starts a session, you&apos;ll see it here.
          </p>
        )}
      </div>

      {/* Streak + target bar. Shown whenever the student has asked at
          least one question ever, or is in a live session right now —
          otherwise it'd feel noisy on an empty account. */}
      {streak > 0 || myMessages.length > 0 || activeForStreak ? (
        <div className="mt-5 rounded-lg border border-klaz-accent/30 bg-klaz-accent-bg/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-klaz-accent">
                Your streak
              </div>
              <div className="mt-0.5 font-serif text-[26px] leading-none tracking-[-0.01em] text-klaz-ink">
                {streak} session{streak === 1 ? "" : "s"} in a row
              </div>
              <p className="mt-1 text-[12.5px] text-klaz-muted">
                Ask at least <span className="font-medium text-klaz-ink">{TARGET}</span>{" "}
                questions in each live session to keep it going. Quiet classes
                are the ones where you learn the least.
              </p>
            </div>
            {activeForStreak ? (
              <div className="text-right">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-klaz-faint">
                  Live session
                </div>
                <div className="mt-0.5 font-serif text-[22px] leading-none text-klaz-ink">
                  {activeAsked}/{TARGET}
                </div>
                <p className="mt-1 text-[11.5px] text-klaz-muted">
                  {activeRemaining === 0
                    ? "Target hit — keep going."
                    : `${activeRemaining} more to bank this session.`}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-5">
        <JoinClassCard />
      </div>

      <div className="mt-5">
        <LiveSessions
          initialSessions={initialSessions}
          enrolledClasses={enrolledClasses}
        />
      </div>

      {activeRows.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-klaz-line bg-klaz-panel p-10 text-center">
          <p className="font-serif text-[20px] leading-none tracking-[-0.01em] text-klaz-ink">
            No classes yet
          </p>
          <p className="mt-2 text-[13px] text-klaz-muted">
            Enter a join code above to get started.
          </p>
        </div>
      ) : (
        <div className="mt-8">
          <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-klaz-faint">
            Enrolled
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {activeRows.map((r) => {
              const klass = r.classes
              if (!klass) return null
              const last = latestByClass.get(klass.id)
              const isLive = activeClassIds.has(klass.id)
              const flavor = flavorClasses(klass.flavor ?? undefined)
              return (
                <div
                  key={r.id}
                  className={`group relative flex flex-col rounded-lg border bg-klaz-panel p-4 transition hover:bg-klaz-panel2 ${flavor.border} ${flavor.hoverBorder}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className={`h-2 w-2 shrink-0 rounded-full ${flavor.dot}`}
                        />
                        <div className="truncate font-serif text-[19px] leading-tight tracking-[-0.01em] text-klaz-ink">
                          {klass.name}
                        </div>
                      </div>
                      <div className="mt-0.5 truncate text-[12px] text-klaz-muted">
                        {klass.subject}
                        {klass.grade ? ` · ${klass.grade}` : ""}
                        {klass.profiles?.name
                          ? ` · ${klass.profiles.name}`
                          : ""}
                      </div>
                    </div>
                    {isLive ? (
                      <span
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] ${flavor.chipBg} ${flavor.chipText}`}
                      >
                        <span className="relative inline-flex h-1.5 w-1.5">
                          <span
                            className={`absolute inset-0 animate-ping rounded-full ${flavor.ping}`}
                          />
                          <span
                            className={`relative inline-flex h-1.5 w-1.5 rounded-full ${flavor.dot}`}
                          />
                        </span>
                        Live
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 flex items-end justify-between gap-3 border-t border-klaz-line2 pt-3">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-klaz-faint">
                        Last session
                      </div>
                      <div className="mt-0.5 text-[12.5px] text-klaz-ink2">
                        {last ? formatRelative(last) : "None yet"}
                      </div>
                    </div>
                    <Link
                      href={`/learn`}
                      aria-label={`Open ${klass.name}`}
                      className="font-mono text-[11px] uppercase tracking-[0.08em] text-klaz-faint transition group-hover:text-klaz-accent"
                    >
                      {isLive ? "Join →" : ""}
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {sessionLogEntries.length > 0 ? (
        <div className="mt-10">
          <div className="flex items-end justify-between">
            <div>
              <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-klaz-faint">
                Session log
              </div>
              <h2 className="mt-1 font-serif text-[24px] leading-none tracking-[-0.01em] text-klaz-ink">
                What you asked
              </h2>
            </div>
            <p className="max-w-xs text-right text-[11.5px] text-klaz-muted">
              Only you see this — it&apos;s your personal lesson notebook.
            </p>
          </div>
          <div className="mt-4">
            <StudentSessionLog entries={sessionLogEntries} target={TARGET} />
          </div>
        </div>
      ) : activeRows.length > 0 ? (
        // Enrolled but hasn't asked anything yet. Soft nudge so the
        // surface doesn't feel half-empty, and so they know what the
        // session log is before they see a populated one.
        <div className="mt-10">
          <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-klaz-faint">
            Session log
          </div>
          <h2 className="mt-1 font-serif text-[24px] leading-none tracking-[-0.01em] text-klaz-ink">
            Nothing asked yet
          </h2>
          <p className="mt-2 max-w-md text-[13px] text-klaz-muted">
            When your teacher starts a live session, ask Klaz anything —
            even the obvious stuff. Your questions stay private to you, and
            they&rsquo;ll show up here so you can re-read the explanations
            later.
          </p>
        </div>
      ) : null}
    </div>
  )
}
