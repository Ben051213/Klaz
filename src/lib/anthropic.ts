import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@/lib/supabase/server"

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export function buildSystemPrompt(session: {
  title: string
  ai_context?: string | null
  classes?: {
    subject: string
    grade?: string | null
    profiles?: { name: string } | null
  } | null
}): string {
  const teacher = session.classes?.profiles?.name || "your teacher"
  const subject = session.classes?.subject || "this subject"
  const grade = session.classes?.grade || ""
  const context = session.ai_context || ""

  return `You are Klaz, an AI classroom tutor for ${teacher}'s ${subject} class${grade ? ` (${grade})` : ""}.

Today's session: "${session.title}"
${context ? `\nLesson context:\n${context}` : ""}

Your rules:
- Only help with topics relevant to today's session. If a student asks something off-topic, gently redirect them.
- Give step-by-step explanations. Never just give the answer without showing the reasoning.
- Be encouraging and patient. Never make a student feel stupid for asking.
- Keep responses under 300 words unless a worked example genuinely requires more.
- Use plain language. Avoid jargon unless you define it.
- If a student says they understand, briefly check with a simple follow-up question.`
}

export async function tagMessage(params: {
  studentText: string
  aiResponse: string
  sessionTopics: string[]
  messageId: string
  studentId: string
  classId: string
}): Promise<void> {
  try {
    const topicList =
      params.sessionTopics.length > 0
        ? params.sessionTopics.join(", ")
        : "general topics from the lesson"

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `Analyse this classroom Q&A exchange and return ONLY valid JSON, no other text.

Student asked: "${params.studentText}"
AI responded: "${params.aiResponse.substring(0, 500)}"

Available topics: ${topicList}

Return JSON: { "topics": ["topic1"], "confidence_signal": "confused|partial|understood" }
- topics: array of matching topics from the available list (empty array if none match)
- confidence_signal: "confused" = student did not understand after the response, "partial" = somewhat understood but still unsure, "understood" = student got it`,
        },
      ],
    })

    const raw =
      response.content[0].type === "text" ? response.content[0].text : "{}"
    const parsed = JSON.parse(raw.trim())
    const topics: string[] = Array.isArray(parsed.topics) ? parsed.topics : []
    const signal = ["confused", "partial", "understood"].includes(
      parsed.confidence_signal
    )
      ? parsed.confidence_signal
      : "partial"

    const supabase = await createClient()
    await supabase
      .from("messages")
      .update({ topics, confidence_signal: signal })
      .eq("id", params.messageId)

    for (const topic of topics) {
      await upsertTopicScore(
        supabase,
        params.studentId,
        params.classId,
        topic,
        signal
      )
    }
  } catch {
    // Tagging failure must never break the chat — silently ignore
  }
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function upsertTopicScore(
  supabase: SupabaseClient,
  studentId: string,
  classId: string,
  topic: string,
  signal: string
): Promise<void> {
  const delta = signal === "confused" ? -5 : signal === "understood" ? 8 : 0
  if (delta === 0) return

  const { data } = await supabase
    .from("student_topic_scores")
    .upsert(
      { student_id: studentId, class_id: classId, topic, score: 50 },
      { onConflict: "student_id,class_id,topic" }
    )
    .select()
    .single()

  const currentScore =
    (data as { score?: number } | null)?.score ?? 50
  const newScore = Math.min(100, Math.max(0, currentScore + delta))
  await supabase
    .from("student_topic_scores")
    .update({ score: newScore, last_updated: new Date().toISOString() })
    .eq("student_id", studentId)
    .eq("class_id", classId)
    .eq("topic", topic)
}

export async function processLessonPlan(lessonPlan: string): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `Extract from this lesson plan and return ONLY valid JSON:
${lessonPlan}

Return: { "main_topic": "...", "subtopics": ["...", "..."], "objectives": ["...", "..."] }`,
        },
      ],
    })
    const raw =
      response.content[0].type === "text" ? response.content[0].text : "{}"
    const parsed = JSON.parse(raw.trim())
    return `Main topic: ${parsed.main_topic || "See lesson plan"}
Subtopics: ${(parsed.subtopics || []).join(", ")}
Objectives: ${(parsed.objectives || []).join(" | ")}`
  } catch {
    return lessonPlan.substring(0, 800)
  }
}
