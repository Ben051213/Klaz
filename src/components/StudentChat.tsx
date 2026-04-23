"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { ChatMessage } from "@/components/ChatMessage"
import { createClient } from "@/lib/supabase/client"
import { cn, scoreHex } from "@/lib/utils"

// Student learning surface — the "warm editorial" chat with a left rail
// that shows today's class and the student's own topic proficiencies.
// The AI tutor only answers within the current session's scope; anything
// off-topic gets redirected to the teacher (that boundary is shown in
// the header under the title).

type QuestionLevel = "below" | "at" | "above"

type StoredMessage = {
  id: string
  student_text: string
  ai_response: string | null
  question_level: QuestionLevel | null
  created_at: string
}

type ChatItem =
  | {
      role: "user"
      content: string
      key: string
      messageId?: string
      questionLevel?: QuestionLevel | null
    }
  | { role: "assistant"; content: string; key: string; isStreaming?: boolean }

export function StudentChat({
  session,
  initialMessages,
  initialScores,
}: {
  session: {
    id: string
    title: string
    status: "active" | "ended"
    classId: string
    className: string
    subject: string
  }
  initialMessages: StoredMessage[]
  initialScores: { topic: string; score: number }[]
}) {
  const baseItems = useMemo<ChatItem[]>(() => {
    const out: ChatItem[] = []
    for (const m of initialMessages) {
      out.push({
        role: "user",
        content: m.student_text,
        key: `u-${m.id}`,
        messageId: m.id,
        questionLevel: m.question_level,
      })
      if (m.ai_response) {
        out.push({
          role: "assistant",
          content: m.ai_response,
          key: `a-${m.id}`,
        })
      }
    }
    return out
  }, [initialMessages])

  const [items, setItems] = useState<ChatItem[]>(baseItems)
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [scores, setScores] =
    useState<{ topic: string; score: number }[]>(initialScores)
  const [sessionEnded, setSessionEnded] = useState(
    session.status === "ended"
  )
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    })
  }, [items])

  // If the teacher ends the session from their side, bolt the composer
  // closed on the student side too — no polling needed, we already have
  // a realtime channel here.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`session-status-${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${session.id}`,
        },
        (payload) => {
          const row = payload.new as { status?: string } | null
          if (row?.status === "ended") setSessionEnded(true)
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [session.id])

  async function refreshScores() {
    const supabase = createClient()
    const { data } = await supabase
      .from("student_topic_scores")
      .select("topic, score")
      .eq("class_id", session.classId)
    if (data) setScores(data)
  }

  async function refreshQuestionLevel(userKey: string, createdAfter: string) {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    for (let attempt = 0; attempt < 4; attempt++) {
      await new Promise((r) => setTimeout(r, 1500))
      const { data } = await supabase
        .from("messages")
        .select("id, question_level")
        .eq("session_id", session.id)
        .eq("student_id", user.id)
        .gte("created_at", createdAfter)
        .order("created_at", { ascending: false })
        .limit(1)
      const row = data?.[0]
      if (row?.question_level) {
        setItems((prev) =>
          prev.map((x) =>
            x.key === userKey && x.role === "user"
              ? {
                  ...x,
                  messageId: row.id,
                  questionLevel: row.question_level as QuestionLevel,
                }
              : x
          )
        )
        return
      }
    }
  }

  async function send(text?: string) {
    const userText = (text ?? input).trim()
    if (!userText || streaming || sessionEnded) return
    setInput("")
    const sendStartedAt = new Date().toISOString()
    const userKey = `u-pending-${Date.now()}`
    const assistantKey = `a-pending-${Date.now()}`
    setItems((prev) => [
      ...prev,
      { role: "user", content: userText, key: userKey, questionLevel: null },
      { role: "assistant", content: "", key: assistantKey, isStreaming: true },
    ])
    setStreaming(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText, session_id: session.id }),
      })
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Chat failed" }))
        toast.error(err.error || "Chat failed")
        setStreaming(false)
        setItems((prev) => prev.filter((x) => x.key !== assistantKey))
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let aiText = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        aiText += decoder.decode(value, { stream: true })
        setItems((prev) =>
          prev.map((x) =>
            x.key === assistantKey
              ? { ...x, content: aiText, isStreaming: true }
              : x
          )
        )
      }
      setItems((prev) =>
        prev.map((x) =>
          x.key === assistantKey
            ? { ...x, content: aiText, isStreaming: false }
            : x
        )
      )
      setStreaming(false)
      setTimeout(refreshScores, 2000)
      refreshQuestionLevel(userKey, sendStartedAt).catch(() => {})
    } catch {
      toast.error("Network error")
      setStreaming(false)
      setItems((prev) => prev.filter((x) => x.key !== assistantKey))
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  // First-question starters only show when the transcript is still empty.
  const starters = [
    `Why does ${session.title || "this"} work?`,
    "When do I use it?",
    "Walk me through an example",
  ]

  const sortedScores = useMemo(
    () => [...scores].sort((a, b) => b.score - a.score),
    [scores]
  )

  return (
    <div
      className="flex w-full overflow-hidden bg-klaz-bg text-[13px] text-klaz-ink min-h-[calc(100dvh-49px)] lg:min-h-screen"
    >
      {/* LEFT RAIL — class info + progress */}
      <aside className="hidden w-[232px] shrink-0 flex-col border-r border-klaz-line bg-klaz-panel lg:flex">
        <div className="border-b border-klaz-line2 px-4 py-3.5">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-klaz-faint">
            Class
          </div>
          <div className="mt-1 text-[14px] font-medium text-klaz-ink">
            {session.className}
          </div>
          <div className="text-[11.5px] text-klaz-muted">{session.subject}</div>
        </div>

        <div className="px-3 pt-3">
          <div className="px-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-klaz-faint">
            Today&apos;s focus
          </div>
          <div className="mt-1 rounded-md bg-klaz-line2 px-2.5 py-1.5 text-[12.5px] font-medium text-klaz-ink">
            {session.title}
          </div>
        </div>

        <div className="mt-4 px-4 font-mono text-[10.5px] uppercase tracking-[0.08em] text-klaz-faint">
          Your topics
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-1">
          {sortedScores.length === 0 ? (
            <p className="mt-2 text-[11.5px] text-klaz-muted">
              Ask a few questions to see your topic scores appear here.
            </p>
          ) : (
            sortedScores.map((t, i) => (
              <div
                key={t.topic}
                className={cn(
                  "py-1.5",
                  i < sortedScores.length - 1 && "border-b border-klaz-line2"
                )}
              >
                <div className="flex items-center justify-between text-[12px]">
                  <span className="truncate pr-2">{t.topic}</span>
                  <span
                    className="font-mono"
                    style={{ color: scoreHex(t.score) }}
                  >
                    {t.score}
                  </span>
                </div>
                <div className="mt-0.5 h-[3px] overflow-hidden rounded-[2px] bg-klaz-line2">
                  <div
                    className="h-full"
                    style={{
                      width: `${t.score}%`,
                      background: scoreHex(t.score),
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* CHAT COLUMN */}
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-klaz-line bg-klaz-panel px-5 py-3 sm:px-7">
          <div className="min-w-0">
            <div className="truncate font-serif text-[20px] leading-none tracking-[-0.01em] md:text-[22px]">
              {session.title}
              <span className="text-klaz-accent">.</span>
            </div>
            <div className="mt-1 text-[11.5px] text-klaz-muted">
              Tutor scope:{" "}
              <span className="font-medium text-klaz-ink2">
                {session.className} — {session.subject}
              </span>{" "}
              · Questions outside this scope will be redirected to your
              teacher.
            </div>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto bg-klaz-bg px-4 py-5 sm:px-7"
        >
          <div className="mx-auto flex max-w-[760px] flex-col gap-4">
            {items.length === 0 ? (
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-klaz-ink font-serif text-[15px] italic text-klaz-bg">
                  K
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-klaz-faint">
                    Klaz tutor
                  </div>
                  <div className="mt-1 text-[14px] leading-[1.55] text-klaz-ink">
                    Hi — today we&apos;re focused on{" "}
                    <span className="font-serif text-[16px] italic">
                      {session.title}
                    </span>
                    . Ask me anything, or try one:
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {starters.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => send(q)}
                        className="rounded-full border border-klaz-line bg-klaz-panel2 px-3 py-[5px] text-[12px] text-klaz-ink2 transition hover:bg-klaz-line2"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              items.map((item) => (
                <ChatMessage
                  key={item.key}
                  role={item.role}
                  content={item.content}
                  isStreaming={
                    item.role === "assistant" ? item.isStreaming : undefined
                  }
                />
              ))
            )}
            {streaming && items[items.length - 1]?.content === "" ? (
              <div className="flex items-center gap-1 pl-9">
                <span
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-klaz-accent"
                  style={{ animationDelay: "-0.3s" }}
                />
                <span
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-klaz-accent"
                  style={{ animationDelay: "-0.15s" }}
                />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-klaz-accent" />
              </div>
            ) : null}
          </div>
        </div>

        <div className="border-t border-klaz-line bg-klaz-panel px-4 py-3.5 sm:px-7">
          <div className="mx-auto max-w-[760px]">
            {sessionEnded ? (
              <p className="rounded-md border border-klaz-line bg-klaz-panel2 px-3 py-2.5 text-center text-[12.5px] text-klaz-muted">
                This session has ended.
              </p>
            ) : (
              <>
                <div className="flex items-end gap-2.5 rounded-xl border border-klaz-line bg-klaz-panel2 px-3 py-2">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={`Ask about ${session.title || "the lesson"}…`}
                    rows={1}
                    className="flex-1 resize-none bg-transparent py-1.5 text-[13.5px] text-klaz-ink placeholder:text-klaz-muted focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => send()}
                    disabled={streaming || input.trim().length === 0}
                    aria-label="Send"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-klaz-accent text-[14px] text-white transition hover:bg-klaz-accent2 disabled:opacity-50"
                  >
                    ↑
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.06em] text-klaz-faint">
                  <span>
                    Tutor scope: {session.className} · {session.subject}
                  </span>
                  <span className="hidden sm:inline">Shift + ↵ new line</span>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
