import Link from "next/link"
import { Session, Class } from "@/lib/types"

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
    <div className="animate-[slide-down_0.3s_ease-out] overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-teal-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-emerald-600">
          <span className="relative inline-flex h-3 w-3">
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide">
            Live Now
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-brand-navy">
            {session.title}
          </p>
          <p className="truncate text-sm text-slate-500">
            {classInfo.name} · {classInfo.subject}
            {teacherName ? ` · ${teacherName}` : ""}
          </p>
        </div>
        <Link
          href={`/learn/session/${session.id}`}
          className="inline-flex items-center rounded-md bg-brand-teal px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-teal/90"
        >
          Join Session →
        </Link>
      </div>
    </div>
  )
}
