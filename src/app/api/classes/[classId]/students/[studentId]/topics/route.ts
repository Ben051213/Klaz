import { NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

// Teacher-managed adjustments to a student's topic scores.
//
//   POST /api/classes/[classId]/students/[studentId]/topics
//     body: { topic: string, action: "resolve" | "improve" | "reset", note?: string }
//
// - resolve → set score to 85 (strong understanding; reserved for
//   topics the teacher has verified in person, e.g. "we talked it
//   through and she can explain it back").
// - improve → nudge up by +20 (capped at 100). "They're getting it but
//   not there yet." Lightweight signal.
// - reset → drop the teacher_override_at lock and set score back to 50
//   so the AI pipeline starts adjusting again from a neutral baseline.
//
// `teacher_override_at` is stamped to `now()` on resolve/improve. This
// locks the score from AI overwrites for 14 days (see
// upsertTopicScore in src/lib/anthropic.ts) — enough breathing room
// that the next session's noise doesn't undo the teacher's assessment.
//
// Uses the service client: student_topic_scores RLS grants teachers
// SELECT only on scores in their classes (the write path is the Haiku
// tagger on the server). We verify teacher ownership of the class
// before any mutation.

const RESOLVED_SCORE = 85
const IMPROVEMENT_DELTA = 20
const DEFAULT_SCORE = 50

type TopicAction = "resolve" | "improve" | "reset"

export async function POST(
  request: Request,
  {
    params,
  }: { params: Promise<{ classId: string; studentId: string }> }
) {
  const { classId, studentId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: klass } = await supabase
    .from("classes")
    .select("teacher_id")
    .eq("id", classId)
    .single()
  if (!klass || klass.teacher_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    topic?: string
    action?: TopicAction
    note?: string
  }
  const topic = body.topic?.trim()
  const action = body.action
  if (!topic || !action) {
    return NextResponse.json(
      { error: "Missing topic or action" },
      { status: 400 }
    )
  }
  if (action !== "resolve" && action !== "improve" && action !== "reset") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  const service = createServiceClient()

  // Fetch existing — we need it for the improve delta and to preserve
  // notes on resolve without clobbering them.
  const { data: existing } = await service
    .from("student_topic_scores")
    .select("score, teacher_note")
    .eq("student_id", studentId)
    .eq("class_id", classId)
    .eq("topic", topic)
    .maybeSingle()
  const existingRow =
    (existing as { score?: number; teacher_note?: string | null } | null) ??
    null
  const currentScore = existingRow?.score ?? DEFAULT_SCORE

  let nextScore: number
  let overrideAt: string | null
  if (action === "resolve") {
    nextScore = RESOLVED_SCORE
    overrideAt = new Date().toISOString()
  } else if (action === "improve") {
    nextScore = Math.min(100, currentScore + IMPROVEMENT_DELTA)
    overrideAt = new Date().toISOString()
  } else {
    // reset
    nextScore = DEFAULT_SCORE
    overrideAt = null
  }

  const { error } = await service.from("student_topic_scores").upsert(
    {
      student_id: studentId,
      class_id: classId,
      topic,
      score: nextScore,
      last_updated: new Date().toISOString(),
      teacher_override_at: overrideAt,
      teacher_note: body.note ?? existingRow?.teacher_note ?? null,
    },
    { onConflict: "student_id,class_id,topic" }
  )
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    topic,
    score: nextScore,
    action,
  })
}
