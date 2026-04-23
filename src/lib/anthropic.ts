import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@/lib/supabase/server"

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export function buildSystemPrompt(
  session: {
    title: string
    ai_context?: string | null
    classes?: {
      subject: string
      grade?: string | null
      tutor_tone?: string | null
      profiles?: { name: string } | null
    } | null
  },
  // Plain-text class materials (syllabus, lesson plans, handouts) uploaded by
  // the teacher on the class /materials page. Each entry is rendered as a
  // labelled block in the system prompt so the tutor can cite terminology and
  // examples consistent with what the teacher has actually taught. Kept small
  // (see the fetch on the call site — we clamp to ~6000 chars total) to leave
  // room for the session context + chat history within Sonnet's window.
  materials?: { title: string; kind: string; content: string }[]
): string {
  const teacher = session.classes?.profiles?.name || "your teacher"
  const subject = session.classes?.subject || "this subject"
  const grade = session.classes?.grade || ""
  const context = session.ai_context || ""
  const gradeLabel = grade ? ` (${grade})` : ""
  // Free-text tone override the teacher can set on the class. Small things
  // like "use UK spelling", "assume Year 8 baseline", "match the same
  // casual voice I use in class". Clamped so a runaway paste can't
  // hijack the whole system prompt.
  const tutorTone = (session.classes?.tutor_tone ?? "").slice(0, 400).trim()

  const materialsBlock =
    materials && materials.length > 0
      ? `\nClass materials — treat these as authoritative references for this class. Prefer their terminology, examples, and conventions when answering:\n${materials
          .map(
            (m) =>
              `--- ${m.kind.toUpperCase()}: ${m.title} ---\n${m.content.trim()}`
          )
          .join("\n\n")}\n`
      : ""

  const toneBlock = tutorTone
    ? `\nTeacher's tone preferences (apply to every reply): ${tutorTone}\n`
    : ""

  return `You are Klaz, an AI classroom tutor for ${teacher}'s ${subject} class${gradeLabel}.

Today's session: "${session.title}"
${context ? `\n${context}\n` : ""}${materialsBlock}${toneBlock}
How to teach:
- Help the student learn. Today's lesson is the priority, but ANY question within ${subject} is fair game — including prerequisites, foundations, or adjacent skills. For example, if today's topic is geometric progressions and the student asks about basic algebra or arithmetic, answer it: they probably need that ground to make sense of today's lesson. Only decline if the question is clearly outside ${subject} entirely (e.g. a history question in a maths class).
- Stay at ${grade || "the student's"} grade level — match the vocabulary and depth shown in the lesson plan above${
    context ? " (use its examples and vocabulary where relevant)" : ""
  }.
- Give step-by-step reasoning. Never just give the answer without showing how to get there.
- Answer directly. DO NOT ask the student follow-up questions, check-in questions, or "does that make sense?" prompts. They're in class listening to their teacher — a chatbot peppering them with questions breaks their focus. Just teach, then stop.
- Use plain language. Define any term before using it if it isn't in the lesson's vocabulary.
- Be warm and patient. Never make a student feel silly for asking.
- Keep responses under 300 words unless a worked example genuinely needs more room.
- Format with short paragraphs, bullet lists, tables, and fenced code/math blocks where useful — responses are rendered as markdown with LaTeX (use $inline$ and $$display$$ for math).`
}

export type ConfidenceSignal = "confused" | "partial" | "understood"
export type QuestionLevel = "below" | "at" | "above"

// Strip ```json ... ``` fences and any stray prose around the first { ... }
// object. Haiku sometimes ignores "return ONLY JSON" and wraps the reply,
// which throws JSON.parse and silently kills the whole tagging pipeline.
function extractJsonObject(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim()
  // Greedy extract the first balanced-looking {...} — good enough for the
  // small tagging payload and resilient to leading prose.
  const first = cleaned.indexOf("{")
  const last = cleaned.lastIndexOf("}")
  if (first !== -1 && last !== -1 && last > first) {
    return cleaned.slice(first, last + 1)
  }
  return cleaned
}

export async function tagMessage(params: {
  studentText: string
  aiResponse: string
  sessionTitle?: string | null
  sessionTopics: string[]
  lessonSummary?: string | null
  grade?: string | null
  subject?: string | null
  messageId: string
  studentId: string
  classId: string
}): Promise<void> {
  console.log("[tagMessage] start", {
    messageId: params.messageId,
    studentId: params.studentId,
    classId: params.classId,
    textLen: params.studentText.length,
  })
  try {
    const existingList =
      params.sessionTopics.length > 0 ? params.sessionTopics.join(", ") : ""
    const lessonBlock = params.lessonSummary?.trim()
      ? `Lesson summary:\n${params.lessonSummary.trim()}\n`
      : ""
    const gradeLine = params.grade ? `Grade level: ${params.grade}\n` : ""
    const subjectLine = params.subject ? `Subject: ${params.subject}\n` : ""
    const existingBlock = existingList
      ? `Topics already tracked in this class (prefer reusing these verbatim for consistency): ${existingList}\n`
      : ""

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 250,
      messages: [
        {
          role: "user",
          content: `You are tagging a classroom Q&A exchange for a tutor-centre analytics dashboard. Return ONLY valid JSON, no other text.

${subjectLine}${gradeLine}${lessonBlock}${existingBlock}
Student asked: "${params.studentText}"
AI responded: "${params.aiResponse.substring(0, 600)}"

Return JSON: { "topics": ["topic1"], "confidence_signal": "confused|partial|understood", "question_level": "below|at|above" }

Rules for "topics":
- Extract 1-3 short, concrete topic names (2-4 words each) that describe what this exchange is about. Examples: "Geometric progressions", "Solving quadratics", "Ratios", "Photosynthesis".
- If "Topics already tracked" is provided above, REUSE those names verbatim when they fit — do not create a near-duplicate like "Ratio" vs "Ratios".
- Prefer topic names grounded in the lesson summary and subject when available.
- Return at least one topic whenever the exchange is on-subject. Only return [] if the exchange is pure small talk with no learning content.

Rules for "confidence_signal" — BE STRICT. Asking a question is evidence of a gap, NOT mastery.
- "confused" = the question shows the student has a clear misconception, or they follow up saying they still don't get it.
- "understood" = ONLY if the student's message EXPLICITLY confirms understanding (e.g. "ok I get it now", "that makes sense, thanks") OR correctly applies the concept back. Do NOT use "understood" just because the AI gave a clear explanation. Do NOT use "understood" for a fresh question.
- "partial" = the default for any genuine question. Student is engaging but hasn't demonstrated mastery.

Rules for "question_level" — compare the question to the declared lesson level${params.grade ? ` and grade (${params.grade})` : ""}:
- "above" = the question reaches for concepts HARDER than what the lesson covers — extensions, edge cases, deeper "why does this work" reasoning, connections to more advanced material. Signals mastery of the base lesson.
- "at" = the question is squarely on lesson level — asking about the core concept as taught.
- "below" = the question is about a PREREQUISITE or more basic skill the lesson assumes, or the student is stuck on something that should already be known at this grade. Signals a foundation gap.`,
        },
      ],
    })

    const raw =
      response.content[0].type === "text" ? response.content[0].text : "{}"
    let parsed: {
      topics?: unknown
      confidence_signal?: unknown
      question_level?: unknown
    } = {}
    try {
      parsed = JSON.parse(extractJsonObject(raw))
    } catch (parseErr) {
      // Keep parsed = {}; we'll still write a baseline tag with the session
      // title as a fallback topic so the heatmap isn't empty.
      console.error("[tagMessage] JSON parse failed", {
        preview: raw.slice(0, 200),
        parseErr,
      })
    }
    let topics: string[] = Array.isArray(parsed.topics)
      ? parsed.topics.filter((t): t is string => typeof t === "string")
      : []
    // Fallback: if Haiku returned no topics, tag the message with the session
    // title so analytics isn't silently empty. Still better than nothing.
    if (topics.length === 0 && params.sessionTitle?.trim()) {
      topics = [params.sessionTitle.trim()]
    }
    const signalCandidates: ConfidenceSignal[] = [
      "confused",
      "partial",
      "understood",
    ]
    const signal: ConfidenceSignal = signalCandidates.includes(
      parsed.confidence_signal as ConfidenceSignal
    )
      ? (parsed.confidence_signal as ConfidenceSignal)
      : "partial"
    const levelCandidates: QuestionLevel[] = ["below", "at", "above"]
    const level: QuestionLevel = levelCandidates.includes(
      parsed.question_level as QuestionLevel
    )
      ? (parsed.question_level as QuestionLevel)
      : "at"

    const supabase = await createClient()
    // Split into two updates: if the question_level column hasn't been added
    // to the DB yet (patch-question-level.sql), the combined update would fail
    // and we'd lose the topic+confidence tagging too. Keeping them separate
    // means analytics still populate even before the patch lands.
    await supabase
      .from("messages")
      .update({ topics, confidence_signal: signal })
      .eq("id", params.messageId)
    await supabase
      .from("messages")
      .update({ question_level: level })
      .eq("id", params.messageId)

    console.log("[tagMessage] parsed", {
      messageId: params.messageId,
      topics,
      signal,
      level,
    })
    for (const topic of topics) {
      await upsertTopicScore(
        supabase,
        params.studentId,
        params.classId,
        topic,
        signal,
        level
      )
    }
    console.log("[tagMessage] done — wrote scores", {
      messageId: params.messageId,
      topicCount: topics.length,
    })
  } catch (err) {
    // Tagging failure must never break the chat — but surface it to Vercel
    // logs so we can debug why the heatmap is empty next time.
    console.error("[tagMessage] failed", err)
  }
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// 3×3 delta matrix combining question difficulty with confidence signal.
// Rows = question_level relative to lesson, cols = confidence signal.
//              confused  partial  understood
// above:         +2        +6       +12    ← reaching beyond the lesson = mastery
// at:            -5         0        +6    ← on-level, graded normally
// below:        -10        -5        -2    ← asking about prerequisites = foundation gap
const DELTA_MATRIX: Record<QuestionLevel, Record<ConfidenceSignal, number>> = {
  above: { confused: 2, partial: 6, understood: 12 },
  at: { confused: -5, partial: 0, understood: 6 },
  below: { confused: -10, partial: -5, understood: -2 },
}

async function upsertTopicScore(
  supabase: SupabaseClient,
  studentId: string,
  classId: string,
  topic: string,
  signal: ConfidenceSignal,
  level: QuestionLevel
): Promise<void> {
  // Read-then-write. The previous implementation did
  //   upsert({ score: 50 }).select().single() → then separately UPDATE
  // which had two bugs:
  //   1. Every upsert reset the existing score back to 50, so scores
  //      could never accumulate past `50 + single_delta`.
  //   2. `.select().single()` after an upsert occasionally returned zero
  //      rows under RLS and threw, killing the whole function before any
  //      write landed. That's the scenario the teacher was seeing:
  //      messages.topics got written (outside this function) but
  //      student_topic_scores stayed empty.
  // maybeSingle is null-safe; the trailing upsert writes the exact
  // computed score in one shot.
  const { data: existing } = await supabase
    .from("student_topic_scores")
    .select("score, teacher_override_at")
    .eq("student_id", studentId)
    .eq("class_id", classId)
    .eq("topic", topic)
    .maybeSingle()

  // Teacher override lock: if the teacher has resolved or manually set
  // a score in the last 14 days, one fresh confused message shouldn't
  // un-resolve it. The AI's view is noisy — the teacher's is ground
  // truth, briefly. Window is intentionally short so stale overrides
  // don't freeze a student's profile forever.
  const row = existing as
    | { score?: number; teacher_override_at?: string | null }
    | null
  const overrideAt = row?.teacher_override_at
    ? new Date(row.teacher_override_at).getTime()
    : 0
  const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000
  if (overrideAt && Date.now() - overrideAt < FOURTEEN_DAYS) {
    return
  }

  const currentScore = row?.score ?? 50
  const delta = DELTA_MATRIX[level][signal]
  const newScore = Math.min(100, Math.max(0, currentScore + delta))

  await supabase.from("student_topic_scores").upsert(
    {
      student_id: studentId,
      class_id: classId,
      topic,
      score: newScore,
      last_updated: new Date().toISOString(),
    },
    { onConflict: "student_id,class_id,topic" }
  )
}

type LessonPlanInput =
  | { kind: "text"; text: string }
  | { kind: "pdf"; base64: string }

const LESSON_EXTRACTION_PROMPT = `Extract a structured summary of this lesson plan and return ONLY valid JSON, no other text.

Return: {
  "main_topic": "short phrase — the single core concept of the lesson",
  "subtopics": ["3-6 specific ideas covered inside the main topic"],
  "objectives": ["2-5 things the student should be able to do by the end"],
  "key_examples": ["2-4 canonical examples, problems, or worked demos from the plan (short phrases)"],
  "vocabulary": ["2-8 key terms the student must know, short phrases"]
}

Rules:
- Use the student's grade-appropriate wording from the plan where possible.
- Omit the key if the plan genuinely has no signal for it (empty array is fine).
- Do not invent examples or objectives that aren't implied by the plan.`

export async function processLessonPlan(
  input: string | LessonPlanInput
): Promise<string> {
  const normalized: LessonPlanInput =
    typeof input === "string" ? { kind: "text", text: input } : input
  try {
    const userContent =
      normalized.kind === "text"
        ? [
            {
              type: "text" as const,
              text: `${LESSON_EXTRACTION_PROMPT}\n\nLesson plan:\n${normalized.text}`,
            },
          ]
        : [
            {
              type: "document" as const,
              source: {
                type: "base64" as const,
                media_type: "application/pdf" as const,
                data: normalized.base64,
              },
            },
            { type: "text" as const, text: LESSON_EXTRACTION_PROMPT },
          ]

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      messages: [{ role: "user", content: userContent }],
    })
    const raw =
      response.content[0].type === "text" ? response.content[0].text : "{}"
    const parsed = JSON.parse(raw.trim()) as {
      main_topic?: string
      subtopics?: unknown
      objectives?: unknown
      key_examples?: unknown
      vocabulary?: unknown
    }
    const asList = (v: unknown) =>
      Array.isArray(v)
        ? v.filter((x): x is string => typeof x === "string")
        : []
    const main = parsed.main_topic?.trim() || "See lesson plan"
    const subs = asList(parsed.subtopics)
    const objs = asList(parsed.objectives)
    const examples = asList(parsed.key_examples)
    const vocab = asList(parsed.vocabulary)

    const sections: string[] = [`Main topic: ${main}`]
    if (subs.length) sections.push(`Subtopics: ${subs.join(", ")}`)
    if (objs.length)
      sections.push(
        `Learning objectives:\n${objs.map((o) => `- ${o}`).join("\n")}`
      )
    if (examples.length)
      sections.push(`Key examples: ${examples.join("; ")}`)
    if (vocab.length) sections.push(`Vocabulary: ${vocab.join(", ")}`)
    return sections.join("\n\n")
  } catch {
    if (normalized.kind === "text") return normalized.text.substring(0, 800)
    return "Lesson plan PDF uploaded — could not auto-summarize. Tutor will rely on the session title."
  }
}
