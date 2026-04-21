import { NextResponse } from "next/server"
import { anthropic } from "@/lib/anthropic"
import { createClient } from "@/lib/supabase/server"
import type { Difficulty } from "@/lib/types"

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { session_id } = body as { session_id?: string }
  if (!session_id) {
    return NextResponse.json({ error: "session_id required" }, { status: 400 })
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("id, class_id, classes(teacher_id, grade)")
    .eq("id", session_id)
    .single()
  type S = {
    id: string
    class_id: string
    classes: { teacher_id: string; grade: string | null } | null
  }
  const s = session as S | null
  if (!s || s.classes?.teacher_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const grade = s.classes?.grade || "middle school"

  const { data: enrollments } = await supabase
    .from("class_enrollments")
    .select("student_id")
    .eq("class_id", s.class_id)
  const studentIds = (enrollments ?? []).map((r) => r.student_id)

  let generated = 0

  for (const studentId of studentIds) {
    const { data: weakScores } = await supabase
      .from("student_topic_scores")
      .select("topic, score")
      .eq("class_id", s.class_id)
      .eq("student_id", studentId)
      .lt("score", 60)

    if (!weakScores || weakScores.length === 0) continue
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
      const cleaned = raw
        .trim()
        .replace(/^```(?:json)?/, "")
        .replace(/```$/, "")
        .trim()
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
    } catch {
      items = []
    }

    if (items.length === 0) continue

    const { data: practiceSet, error: setErr } = await supabase
      .from("practice_sets")
      .insert({
        student_id: studentId,
        session_id,
        topics,
        status: "pending",
      })
      .select()
      .single()
    if (setErr || !practiceSet) continue

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
    generated += 1
  }

  return NextResponse.json({ generated })
}
