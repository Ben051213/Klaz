import { NextResponse } from "next/server"
import { anthropic } from "@/lib/anthropic"
import { createClient } from "@/lib/supabase/server"

// The response is always shaped the same way so the UI can render labelled
// sections consistently. Missing / irrelevant fields come back as empty arrays
// or empty strings — never null — so the client doesn't need null checks.
export type StudentSummary = {
  strengths: string[]
  weaknesses: string[]
  topics_covered: string[]
  recommended_focus: string
  overall: string
}

const EMPTY_SUMMARY: StudentSummary = {
  strengths: [],
  weaknesses: [],
  topics_covered: [],
  recommended_focus: "",
  overall: "",
}

function asList(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : []
}
function asText(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { studentId } = (await request.json()) as { studentId?: string }
  if (!studentId) {
    return NextResponse.json({ error: "studentId required" }, { status: 400 })
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("id, class_id, classes(teacher_id)")
    .eq("id", sessionId)
    .single()
  type S = { id: string; class_id: string; classes: { teacher_id: string } | null }
  const s = session as S | null
  if (!s || s.classes?.teacher_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data: messages } = await supabase
    .from("messages")
    .select("student_text, ai_response, confidence_signal, question_level, topics")
    .eq("session_id", sessionId)
    .eq("student_id", studentId)
    .order("created_at", { ascending: true })

  if (!messages || messages.length === 0) {
    return NextResponse.json({
      summary: {
        ...EMPTY_SUMMARY,
        overall: "No questions asked yet.",
      } satisfies StudentSummary,
    })
  }

  const transcript = messages
    .map(
      (m) =>
        `Q: ${m.student_text}\nA: ${(m.ai_response ?? "").substring(0, 250)}\n` +
        `[signal=${m.confidence_signal ?? "unknown"}, level=${
          m.question_level ?? "unknown"
        }, topics=${(m.topics ?? []).join("|") || "none"}]`
    )
    .join("\n\n")

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `You are generating a teacher-facing session summary for a single student. Return ONLY valid JSON in the exact schema below. No markdown, no asterisks, no hashes, no code fences — just the JSON object.

Schema:
{
  "strengths": [ "short plain sentences — concepts or skills the student clearly has" ],
  "weaknesses": [ "short plain sentences — concepts they're struggling with or prerequisites they're missing" ],
  "topics_covered": [ "the topic names that came up, dedup'd" ],
  "recommended_focus": "one sentence: what the teacher should revisit with this student next class",
  "overall": "one sentence for the teacher's at-a-glance read"
}

Guidance:
- Use the tags per message: signal (confused / partial / understood), level (below / at / above the lesson), and topics.
- "above" + "understood" questions are strengths. "below" or "confused" questions are weaknesses.
- Never use markdown formatting. Plain sentences only. No asterisks, hashtags, or slashes anywhere.
- Omit a list entirely (empty array) if there's genuinely no signal — don't invent strengths or weaknesses.

Transcript:
${transcript}`,
        },
      ],
    })
    const raw =
      response.content[0].type === "text" ? response.content[0].text : "{}"
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?/, "")
      .replace(/```$/, "")
      .trim()
    const parsed = JSON.parse(cleaned) as Record<string, unknown>
    const summary: StudentSummary = {
      strengths: asList(parsed.strengths),
      weaknesses: asList(parsed.weaknesses),
      topics_covered: asList(parsed.topics_covered),
      recommended_focus: asText(parsed.recommended_focus),
      overall: asText(parsed.overall),
    }
    return NextResponse.json({ summary })
  } catch {
    return NextResponse.json({
      summary: {
        ...EMPTY_SUMMARY,
        overall: "Summary unavailable.",
      } satisfies StudentSummary,
    })
  }
}
