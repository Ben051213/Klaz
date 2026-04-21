"use client"

import { useEffect, useState } from "react"
import { SessionBanner } from "@/components/SessionBanner"
import { createClient } from "@/lib/supabase/client"

type ClassInfo = {
  id: string
  name: string
  subject: string
  teacher_name?: string
}

type ActiveSession = {
  id: string
  title: string
  class_id: string
  class: Pick<ClassInfo, "id" | "name" | "subject">
  teacherName?: string
}

export function LiveSessions({
  initialSessions,
  enrolledClasses,
}: {
  initialSessions: ActiveSession[]
  enrolledClasses: ClassInfo[]
}) {
  const [sessions, setSessions] = useState<ActiveSession[]>(initialSessions)

  useEffect(() => {
    const supabase = createClient()
    const channels = enrolledClasses.map((c) =>
      supabase
        .channel(`class-${c.id}`)
        .on("broadcast", { event: "session_started" }, (event) => {
          const p = event.payload as {
            id: string
            title: string
            class_id: string
          }
          setSessions((current) => {
            if (current.some((s) => s.id === p.id)) return current
            return [
              ...current,
              {
                id: p.id,
                title: p.title,
                class_id: p.class_id,
                class: { id: c.id, name: c.name, subject: c.subject },
                teacherName: c.teacher_name,
              },
            ]
          })
        })
        .on("broadcast", { event: "session_ended" }, (event) => {
          const p = event.payload as { id: string }
          setSessions((current) => current.filter((s) => s.id !== p.id))
        })
        .subscribe()
    )
    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch))
    }
  }, [enrolledClasses])

  if (sessions.length === 0) return null

  return (
    <div className="space-y-3">
      {sessions.map((s) => (
        <SessionBanner
          key={s.id}
          session={{ id: s.id, title: s.title }}
          classInfo={{ name: s.class.name, subject: s.class.subject }}
          teacherName={s.teacherName}
        />
      ))}
    </div>
  )
}
