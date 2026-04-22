"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChatMessage } from "@/components/ChatMessage"
import { TopicScoreBar } from "@/components/TopicScoreBar"
import { createClient } from "@/lib/supabase/client"

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

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    })
  }, [items])

  // Listen for session end
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

  // Tagging runs async on the server after the stream closes. Poll the row
  // a couple of times to pick up question_level (and the DB id for the
  // optimistic user bubble) without waiting forever.
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

  async function send() {
    if (!input.trim() || streaming || sessionEnded) return
    const userText = input.trim()
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
      // refresh topic scores after a short delay (tagging happens async)
      setTimeout(refreshScores, 2000)
      // pick up question_level as soon as the tagger writes it back
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

  const messageCount = items.filter((x) => x.role === "user").length
  const topicsDiscussed = scores.length

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_320px]">
      <div className="flex min-h-[calc(100vh-8rem)] flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            {session.className} · {session.subject}
          </p>
          <h1 className="text-lg font-semibold text-brand-navy">
            {session.title}
          </h1>
        </div>
        <div
          ref={scrollRef}
          className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
        >
          {items.length === 0 ? (
            <div className="grid h-full place-items-center text-center text-sm text-slate-500">
              <div>
                <p className="font-medium text-slate-700">
                  Ask anything about today&apos;s lesson.
                </p>
                <p className="mt-1">
                  The AI tutor only helps with the current topic.
                </p>
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
                questionLevel={
                  item.role === "user" ? item.questionLevel ?? null : null
                }
              />
            ))
          )}
          {streaming && items[items.length - 1]?.content === "" ? (
            <div className="flex items-center gap-1 pl-9 text-xs text-slate-400">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
            </div>
          ) : null}
        </div>
        <div className="border-t border-slate-100 p-3">
          {sessionEnded ? (
            <p className="rounded-md bg-slate-100 px-3 py-2 text-center text-sm text-slate-500">
              This session has ended.
            </p>
          ) : (
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask the tutor…"
                rows={2}
                className="flex-1 resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <Button
                onClick={send}
                disabled={streaming || input.trim().length === 0}
                className="bg-brand-navy hover:bg-brand-navy/90"
              >
                Send
              </Button>
            </div>
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-base text-brand-navy">
              Session stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Questions asked</span>
              <span className="font-semibold text-slate-800">
                {messageCount}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Topics</span>
              <span className="font-semibold text-slate-800">
                {topicsDiscussed}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-base text-brand-navy">
              My progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {scores.length === 0 ? (
              <p className="text-xs text-slate-500">
                Ask a few questions to see your topic scores appear here.
              </p>
            ) : (
              scores
                .slice()
                .sort((a, b) => a.score - b.score)
                .map((s) => (
                  <TopicScoreBar
                    key={s.topic}
                    topic={s.topic}
                    score={s.score}
                  />
                ))
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}
