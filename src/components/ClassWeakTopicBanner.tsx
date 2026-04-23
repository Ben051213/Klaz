import Link from "next/link"

// ClassWeakTopicBanner — surfaces class-wide weak topics at the top of
// the class detail page so the teacher doesn't have to dig. Only
// renders when at least one topic is below the attention threshold
// (default 50) with ≥2 students affected; otherwise it stays out of
// the way. The CTA routes to the first affected student's profile
// since that's where the teacher can actually do something — the
// resolver buttons live there.

type WeakTopic = {
  topic: string
  avgScore: number
  studentCount: number
  studentIds: string[]
}

export function ClassWeakTopicBanner({
  classId,
  topics,
  studentNames,
}: {
  classId: string
  topics: WeakTopic[]
  studentNames: Map<string, string>
}) {
  const visible = topics.slice(0, 3)
  if (visible.length === 0) return null

  return (
    <div className="mt-4 rounded-xl border border-klaz-rose/30 bg-klaz-rose-bg/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-klaz-bad">
            Attention
          </div>
          <h3 className="mt-0.5 font-serif text-[20px] leading-none tracking-[-0.01em] text-klaz-ink">
            {visible.length === 1
              ? "One topic needs a second pass"
              : `${visible.length} topics need a second pass`}
            <span className="text-klaz-accent">.</span>
          </h3>
          <p className="mt-1.5 max-w-2xl text-[12.5px] text-klaz-muted">
            Scores below 50 across more than one student. Click through to the
            weakest student&apos;s profile to resolve in context, or assign
            everyone fresh practice from the practice queue.
          </p>
        </div>
      </div>

      <ul className="mt-3 flex flex-col gap-1.5">
        {visible.map((t) => {
          const firstStudent = t.studentIds[0]
          const firstName = firstStudent
            ? studentNames.get(firstStudent) ?? "Student"
            : null
          return (
            <li
              key={t.topic}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-klaz-panel px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-klaz-bad"
                  />
                  <span className="truncate text-[13.5px] font-medium text-klaz-ink">
                    {t.topic}
                  </span>
                </div>
                <div className="mt-0.5 pl-[14px] font-mono text-[10.5px] uppercase tracking-[0.08em] text-klaz-faint">
                  {t.studentCount} student{t.studentCount === 1 ? "" : "s"} ·
                  avg {Math.round(t.avgScore)}/100
                </div>
              </div>
              {firstStudent ? (
                <Link
                  href={`/dashboard/classes/${classId}/students/${firstStudent}`}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md bg-klaz-ink px-2.5 py-1 text-[11.5px] font-medium text-klaz-bg transition hover:bg-klaz-deep"
                >
                  Review {firstName} →
                </Link>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Given flat score rows, compute class-wide weak topics. */
export function computeWeakTopics(
  scores: { student_id: string; topic: string; score: number }[],
  { threshold = 50, minStudents = 2, limit = 6 } = {}
): WeakTopic[] {
  const byTopic = new Map<
    string,
    { total: number; studentIds: Set<string>; belowCount: number }
  >()
  for (const s of scores) {
    if (s.score >= threshold) continue
    const bucket = byTopic.get(s.topic) ?? {
      total: 0,
      studentIds: new Set<string>(),
      belowCount: 0,
    }
    bucket.total += s.score
    bucket.studentIds.add(s.student_id)
    bucket.belowCount += 1
    byTopic.set(s.topic, bucket)
  }
  return [...byTopic.entries()]
    .filter(([, v]) => v.studentIds.size >= minStudents)
    .map(([topic, v]) => ({
      topic,
      avgScore: v.total / Math.max(1, v.belowCount),
      studentCount: v.studentIds.size,
      studentIds: [...v.studentIds],
    }))
    .sort((a, b) => {
      // Prioritise topics hurting more students; tiebreak by lower avg.
      if (b.studentCount !== a.studentCount) {
        return b.studentCount - a.studentCount
      }
      return a.avgScore - b.avgScore
    })
    .slice(0, limit)
}
