import Link from "next/link"
import { JoinClassCard } from "@/components/JoinClassCard"
import { LiveSessions } from "@/components/LiveSessions"
import { createClient } from "@/lib/supabase/server"
import { formatRelative } from "@/lib/utils"

// Student home — warm editorial twin of the teacher dashboard.
// Serif "Your classes." title, then the JoinClassCard, then live-session
// banners (if any), then the enrolled-class grid. Keeping the structure
// parallel to /dashboard makes it easy for mixed-role users (teachers
// auditing as students) to orient.
export default async function LearnHome() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: enrollments } = await supabase
    .from("class_enrollments")
    .select(
      "id, joined_at, classes(id, name, subject, grade, teacher_id, profiles:profiles!classes_teacher_id_fkey(name))"
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
      profiles: { name: string } | null
    } | null
  }
  const rows = (enrollments as EnrollmentRow[] | null) ?? []

  const classIds = rows.map((r) => r.classes?.id).filter(Boolean) as string[]

  const { data: activeSessions } = classIds.length
    ? await supabase
        .from("sessions")
        .select("id, title, class_id")
        .in("class_id", classIds)
        .eq("status", "active")
    : { data: [] as { id: string; title: string; class_id: string }[] }

  const { data: lastSessions } = classIds.length
    ? await supabase
        .from("sessions")
        .select("id, class_id, started_at")
        .in("class_id", classIds)
        .order("started_at", { ascending: false })
    : { data: [] as { id: string; class_id: string; started_at: string }[] }

  const latestByClass = new Map<string, string>()
  for (const s of lastSessions ?? []) {
    if (!latestByClass.has(s.class_id))
      latestByClass.set(s.class_id, s.started_at)
  }

  const activeClassIds = new Set(
    (activeSessions ?? []).map((s) => s.class_id)
  )

  const initialSessions = (activeSessions ?? []).map((s) => {
    const row = rows.find((r) => r.classes?.id === s.class_id)
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

  const enrolledClasses = rows
    .filter((r) => r.classes)
    .map((r) => ({
      id: r.classes!.id,
      name: r.classes!.name,
      subject: r.classes!.subject,
      teacher_name: r.classes!.profiles?.name,
    }))

  const enrolledCount = rows.length
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
      {/* title + summary */}
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

      <div className="mt-6">
        <JoinClassCard />
      </div>

      <div className="mt-5">
        <LiveSessions
          initialSessions={initialSessions}
          enrolledClasses={enrolledClasses}
        />
      </div>

      {rows.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-klaz-line bg-klaz-panel p-10 text-center">
          <p className="font-serif text-[20px] leading-none tracking-[-0.01em] text-klaz-ink">
            No classes yet<span className="text-klaz-accent">.</span>
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
            {rows.map((r) => {
              const klass = r.classes
              if (!klass) return null
              const last = latestByClass.get(klass.id)
              const isLive = activeClassIds.has(klass.id)
              return (
                <div
                  key={r.id}
                  className="group relative flex flex-col rounded-lg border border-klaz-line bg-klaz-panel p-4 transition hover:border-klaz-line2 hover:bg-klaz-panel2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-serif text-[19px] leading-tight tracking-[-0.01em] text-klaz-ink">
                        {klass.name}
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
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-klaz-accent-bg px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-klaz-accent">
                        <span className="relative inline-flex h-1.5 w-1.5">
                          <span className="absolute inset-0 animate-ping rounded-full bg-klaz-accent/60" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-klaz-accent" />
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
    </div>
  )
}
