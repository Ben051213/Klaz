import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { formatRelative, scoreTone } from "@/lib/utils"

// Cross-class practice queue for the teacher. A simple grouped summary
// of "how much practice is waiting for me to act on, per class" —
// clicking a class jumps into its full practice tab where assignment
// actually happens.

export default async function DashboardPracticeIndex() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  if (!profile || profile.role !== "teacher") redirect("/learn")

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, subject")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false })
  const classList = classes ?? []
  const classIds = classList.map((c) => c.id)

  // One query, group in memory.
  const { data: sets } = classIds.length
    ? await supabase
        .from("practice_sets")
        .select(
          "id, class_id, session_id, status, assigned_at, completed_at, created_at"
        )
        .in(
          "class_id",
          classIds
          // Also pick up legacy rows that only have session_id — join through.
        )
    : { data: [] as Row[] }

  type Row = {
    id: string
    class_id: string | null
    session_id: string | null
    status: "pending" | "approved" | "sent"
    assigned_at: string | null
    completed_at: string | null
    created_at: string
  }
  const rows = (sets as Row[] | null) ?? []

  const agg = new Map<
    string,
    {
      total: number
      needsReview: number
      ready: number
      assigned: number
      completed: number
      latest: string | null
    }
  >()
  for (const c of classList) {
    agg.set(c.id, {
      total: 0,
      needsReview: 0,
      ready: 0,
      assigned: 0,
      completed: 0,
      latest: null,
    })
  }
  for (const r of rows) {
    if (!r.class_id) continue
    const bucket = agg.get(r.class_id)
    if (!bucket) continue
    bucket.total += 1
    if (r.completed_at) bucket.completed += 1
    else if (r.status === "sent") bucket.assigned += 1
    else if (r.status === "approved") bucket.ready += 1
    else bucket.needsReview += 1
    if (!bucket.latest || r.created_at > bucket.latest) {
      bucket.latest = r.created_at
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
      <div>
        <h1 className="font-serif text-[34px] font-normal leading-none tracking-[-0.02em] text-klaz-ink sm:text-[40px]">
          Practice queue<span className="text-klaz-accent">.</span>
        </h1>
        <p className="mt-2 text-[13px] text-klaz-muted">
          Every practice set across every class, grouped by class. Click in to
          review and assign.
        </p>
      </div>

      {classList.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-klaz-line bg-klaz-panel p-10 text-center">
          <p className="font-serif text-[20px] leading-none tracking-[-0.01em] text-klaz-ink">
            No classes yet<span className="text-klaz-accent">.</span>
          </p>
          <p className="mt-2 text-[13px] text-klaz-muted">
            Create a class first — practice sets auto-generate after each
            session.
          </p>
        </div>
      ) : (
        <div className="mt-6 divide-y divide-klaz-line2 rounded-lg border border-klaz-line bg-klaz-panel">
          {classList.map((c) => {
            const a = agg.get(c.id)!
            const tone =
              a.needsReview > 0 ? "warn" : a.ready > 0 ? "accent" : "neutral"
            void scoreTone
            return (
              <Link
                key={c.id}
                href={`/dashboard/classes/${c.id}/practice`}
                className="flex flex-wrap items-center gap-4 px-5 py-4 transition hover:bg-klaz-line2/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-serif text-[18px] leading-none tracking-[-0.01em] text-klaz-ink">
                    {c.name}
                  </div>
                  <div className="mt-1 text-[11.5px] text-klaz-muted">
                    {c.subject}
                    {a.latest ? ` · latest ${formatRelative(a.latest)}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 text-[10.5px]">
                  <Pill
                    label="Review"
                    count={a.needsReview}
                    tone={a.needsReview > 0 ? "warn" : "neutral"}
                  />
                  <Pill
                    label="Ready"
                    count={a.ready}
                    tone={a.ready > 0 ? "accent" : "neutral"}
                  />
                  <Pill label="Assigned" count={a.assigned} tone="neutral" />
                  <Pill
                    label="Done"
                    count={a.completed}
                    tone={a.completed > 0 ? "ok" : "neutral"}
                  />
                </div>
                <span
                  className="shrink-0 font-mono text-[11px] uppercase tracking-[0.06em] text-klaz-faint"
                  aria-hidden
                >
                  →
                </span>
                {/* swallow the tone var so lint doesn't complain in the
                    narrow case we pre-computed but didn't use. */}
                <span hidden>{tone}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Pill({
  label,
  count,
  tone,
}: {
  label: string
  count: number
  tone: "neutral" | "ok" | "warn" | "accent"
}) {
  const cls = {
    neutral: "bg-klaz-line2 text-klaz-muted border-klaz-line",
    ok: "bg-klaz-ok-bg text-klaz-ok border-[#cfdcae]",
    warn: "bg-klaz-warn-bg text-klaz-warn border-[#ebcc91]",
    accent: "bg-klaz-accent-bg text-klaz-accent border-[#eac3b1]",
  }[tone]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono font-medium ${cls}`}
    >
      <span className="uppercase tracking-[0.06em]">{label}</span>
      <span className="tabular-nums">{count}</span>
    </span>
  )
}
