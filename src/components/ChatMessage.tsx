import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import { cn } from "@/lib/utils"

type QuestionLevel = "below" | "at" | "above"

function LevelTag({ level }: { level: QuestionLevel }) {
  const cfg = {
    above: { label: "above lesson level", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", icon: "🎯" },
    at: { label: "on level", cls: "bg-slate-50 text-slate-600 ring-slate-200", icon: "📍" },
    below: { label: "below lesson level", cls: "bg-amber-50 text-amber-700 ring-amber-200", icon: "🪜" },
  }[level]
  return (
    <span
      className={cn(
        "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1",
        cfg.cls
      )}
    >
      <span>{cfg.icon}</span>
      <span>{cfg.label}</span>
    </span>
  )
}

export function ChatMessage({
  role,
  content,
  isStreaming,
  questionLevel,
}: {
  role: "user" | "assistant"
  content: string
  isStreaming?: boolean
  questionLevel?: QuestionLevel | null
}) {
  if (role === "user") {
    return (
      <div className="flex flex-col items-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-navy px-4 py-2 text-sm text-white shadow-sm whitespace-pre-wrap">
          {content}
        </div>
        {questionLevel ? <LevelTag level={questionLevel} /> : null}
      </div>
    )
  }
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-teal text-[10px] font-bold text-white">
        K
      </div>
      <div
        className={cn(
          "prose prose-sm max-w-[85%] rounded-2xl rounded-tl-sm border border-slate-100 bg-white px-4 py-2 text-sm text-slate-800 shadow-sm",
          // Tighten prose spacing — chat bubbles shouldn't look like a blog post
          "prose-p:my-1 prose-headings:my-2 prose-headings:font-semibold prose-ul:my-1 prose-ol:my-1 prose-li:my-0",
          "prose-pre:my-2 prose-pre:rounded-md prose-pre:bg-slate-900 prose-pre:p-2 prose-pre:text-xs",
          "prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-xs prose-code:font-mono prose-code:before:content-none prose-code:after:content-none",
          "prose-a:text-brand-teal prose-strong:text-slate-900",
          // Tables: Tailwind prose strips default borders; put them back so
          // a GFM table actually looks like a table inside a chat bubble.
          "prose-table:my-2 prose-table:w-full prose-table:text-xs prose-table:border prose-table:border-slate-200 prose-table:rounded-md prose-table:overflow-hidden",
          "prose-thead:bg-slate-50",
          "prose-th:border prose-th:border-slate-200 prose-th:px-2 prose-th:py-1 prose-th:text-left prose-th:font-semibold",
          "prose-td:border prose-td:border-slate-200 prose-td:px-2 prose-td:py-1"
        )}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
        >
          {content}
        </ReactMarkdown>
        {isStreaming ? (
          <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-slate-400 align-middle" />
        ) : null}
      </div>
    </div>
  )
}
