import Link from "next/link"
import { Session, Class } from "@/lib/types"

// Banner that shows up on the student home when a teacher in one of their
// enrolled classes kicks off a live session. Warm editorial styling with
// the pulsing terracotta LIVE dot — the same motif the teacher sees on
// their own dashboard's LiveHero so students feel the connection.
export function SessionBanner({
  session,
  classInfo,
  teacherName,
}: {
  session: Pick<Session, "id" | "title">
  classInfo: Pick<Class, "name" | "subject">
  teacherName?: string
}) {
  return (
    <div className="animate-[slide-down_0.3s_ease-out] overflow-hidden rounded-lg border border-klaz-accent/30 bg-klaz-accent-bg p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="relative inline-flex h-2.5 w-2.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-klaz-accent/60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-klaz-accent" />
          </span>
          <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-klaz-accent">
            Live now
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-[18px] leading-none tracking-[-0.01em] text-klaz-ink">
            {session.title}
          </p>
          <p className="mt-1 truncate text-[12.5px] text-klaz-muted">
            {classInfo.name} · {classInfo.subject}
            {teacherName ? ` · ${teacherName}` : ""}
          </p>
        </div>
        <Link
          href={`/learn/session/${session.id}`}
          className="inline-flex items-center rounded-md bg-klaz-ink px-4 py-2 text-[13px] font-medium text-klaz-bg transition hover:bg-klaz-deep"
        >
          Join session →
        </Link>
      </div>
    </div>
  )
}
