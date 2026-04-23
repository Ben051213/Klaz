import { anthropic } from "@/lib/anthropic"
import { createServiceClient } from "@/lib/supabase/server"
import type { Difficulty } from "@/lib/types"

// Generates AI follow-up practice sets for every enrolled student in a
// session, based on their weakest topics in that class. Returns the number
// of sets created. Safe to call after a session ends — does nothing if a
// student has no weak topics on file.
//
// This lives in /lib (not an API route) so we can await it inline from the
// PATCH /api/sessions/:id handler without the fire-and-forget HTTP hop,
// which was unreliable on serverless (the function terminates before the
// background fetch resolves).
//
// It uses the SERVICE client so it works even when called from a context
// without the teacher's cookie (e.g. a server action). Authorization must
// be checked by the caller.
export async function generatePracticeForSession(
  sessionId: string
): Promise<{ generated: number }> {
  const supabase = createServiceClient()

  const { data: session } = await supabase
    .from("sessions")
    .select("id, class_id, classes(grade)")
    .eq("id", sessionId)
    .single()

  type S = {
    id: string
    class_id: string
    classes: { grade: string | null } | { grade: string | null }[] | null
  }
  const s = session as S | null
  if (!s) return { generated: 0 }

  // Supabase occasionally returns a to-one relation as a single-element array
  // depending on FK inference. Normalize here.
  const classesRel = Array.isArray(s.classes) ? s.classes[0] : s.classes
  const grade = classesRel?.grade || "middle school"

  const { data: enrollments } = await supabase
    .from("class_enrollments")
    .select("student_id")
    .eq("class_id", s.class_id)
  const studentIds = (enrollments ?? []).map((r) => r.student_id)

  // Run per-student generation in parallel — each student is one Haiku call.
  // Serial would blow past the Vercel 10-30s function timeout for larger
  // classes. allSettled (not all) so one student's failure doesn't block
  // the rest.
  const results = await Promise.allSettled(
    studentIds.map((studentId) =>
      generateForStudent(supabase, sessionId, s.class_id, studentId, grade)
    )
  )
  let generated = 0
  for (const r of results) {
    if (r.status === "fulfilled") generated += r.value
    else console.error("[practice] per-student generation failed", r.reason)
  }
  return { generated }
}

async function generateForStudent(
  supabase: ReturnType<typeof createServiceClient>,
  sessionId: string,
  classId: string,
  studentId: string,
  grade: string
): Promise<number> {
  const { data: weakScores } = await supabase
    .from("student_topic_scores")
    .select("topic, score")
    .eq("class_id", classId)
    .eq("student_id", studentId)
    .lt("score", 60)

  if (!weakScores || weakScores.length === 0) return 0
  const topics = weakScores.map((t) => t.topic)

  let items: {
    question: string
    answer: string
    hint?: string
    difficulty: Difficulty
  }[] = []
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: `Generate 5 practice questions for a ${grade} student struggling with: ${topics.join(
            ", "
          )}. Return ONLY a JSON array like: [{"question":"...","answer":"...","hint":"...","difficulty":"easy|medium|hard"}]. No prose, no code fences.`,
        },
      ],
    })
    const raw =
      response.content[0].type === "text" ? response.content[0].text : "[]"
    // Strip ```json fences + extract the first [...] array, same defense as
    // tagMessage. Haiku sometimes wraps even when told not to.
    const stripped = raw
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim()
    const first = stripped.indexOf("[")
    const last = stripped.lastIndexOf("]")
    const cleaned =
      first !== -1 && last !== -1 && last > first
        ? stripped.slice(first, last + 1)
        : stripped
    const parsed: {
      question?: string
      answer?: string
      hint?: string
      difficulty?: string
    }[] = JSON.parse(cleaned)
    items = parsed
      .filter((it) => it.question && it.answer)
      .slice(0, 5)
      .map((it) => ({
        question: String(it.question),
        answer: String(it.answer),
        hint: it.hint ? String(it.hint) : undefined,
        difficulty: (["easy", "medium", "hard"] as const).includes(
          it.difficulty as Difficulty
        )
          ? (it.difficulty as Difficulty)
          : "medium",
      }))
  } catch (err) {
    console.error("[practice] Haiku/parse failed for student", studentId, err)
    items = []
  }

  if (items.length === 0) return 0

  const { data: practiceSet, error: setErr } = await supabase
    .from("practice_sets")
    .insert({
      student_id: studentId,
      session_id: sessionId,
      class_id: classId,
      topics,
      status: "pending",
    })
    .select()
    .single()
  if (setErr || !practiceSet) return 0

  await supabase.from("practice_items").insert(
    items.map((it, idx) => ({
      practice_set_id: practiceSet.id,
      question: it.question,
      answer: it.answer,
      hint: it.hint ?? null,
      difficulty: it.difficulty,
      sort_order: idx,
    }))
  )
  return 1
}
