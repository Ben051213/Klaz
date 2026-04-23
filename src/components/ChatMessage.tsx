import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import { cn } from "@/lib/utils"

type QuestionLevel = "below" | "at" | "above"

// Teacher-facing "above / at / below lesson level" pill. We do not render
// this on the student side (hiding the flag keeps them asking freely).
function LevelTag({ level }: { level: QuestionLevel }) {
  const cfg = {
    above: {
      label: "above lesson level",
      cls: "bg-klaz-ok-bg text-klaz-ok border-[#cfdcae]",
    },
    at: {
      label: "on level",
      cls: "bg-klaz-line2 text-klaz-ink2 border-klaz-line",
    },
    below: {
      label: "below lesson level",
      cls: "bg-klaz-warn-bg text-klaz-warn border-[#ebcc91]",
    },
  }[level]
  return (
    <span
      className={cn(
        "mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        cfg.cls
      )}
    >
      {cfg.label}
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
      <div className="flex justify-end">
        <div className="max-w-[75%]">
          <div className="text-right font-mono text-[10.5px] uppercase tracking-[0.06em] text-klaz-faint">
            You
          </div>
          <div className="mt-1 whitespace-pre-wrap rounded-[12px] rounded-br-[4px] bg-klaz-ink px-3.5 py-2.5 text-[13.5px] leading-[1.5] text-klaz-bg">
            {content}
          </div>
          {questionLevel ? (
            <div className="mt-1 text-right">
              <LevelTag level={questionLevel} />
            </div>
          ) : null}
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-klaz-ink font-mono text-[11px] font-bold text-klaz-bg">
        K
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-klaz-faint">
          Klaz tutor
        </div>
        <div
          className={cn(
            "prose prose-sm mt-1 max-w-[85%] text-[14px] leading-[1.6] text-klaz-ink",
            "prose-p:my-1 prose-headings:my-2 prose-headings:font-semibold prose-headings:text-klaz-ink prose-ul:my-1 prose-ol:my-1 prose-li:my-0",
            "prose-pre:my-2 prose-pre:rounded-md prose-pre:bg-klaz-deep prose-pre:p-2 prose-pre:text-xs prose-pre:text-klaz-bg",
            "prose-code:rounded prose-code:bg-klaz-line2 prose-code:px-1 prose-code:py-0.5 prose-code:text-[12.5px] prose-code:font-mono prose-code:before:content-none prose-code:after:content-none",
            "prose-a:text-klaz-accent prose-strong:text-klaz-ink",
            // Callouts: a borderLeft accent with a warm terracotta tint
            // gives formal "rule" / "tip" blocks a distinct look from the
            // normal body copy without leaning on chips.
            "prose-blockquote:my-2 prose-blockquote:border-l-[3px] prose-blockquote:border-klaz-accent prose-blockquote:bg-klaz-accent-bg prose-blockquote:py-2 prose-blockquote:pl-3 prose-blockquote:pr-2 prose-blockquote:rounded-r-md prose-blockquote:not-italic prose-blockquote:text-klaz-ink",
            "prose-table:my-2 prose-table:w-full prose-table:text-xs prose-table:border prose-table:border-klaz-line prose-table:rounded-md prose-table:overflow-hidden",
            "prose-thead:bg-klaz-panel",
            "prose-th:border prose-th:border-klaz-line prose-th:px-2 prose-th:py-1 prose-th:text-left prose-th:font-semibold",
            "prose-td:border prose-td:border-klaz-line prose-td:px-2 prose-td:py-1"
          )}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {content}
          </ReactMarkdown>
          {isStreaming ? (
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-klaz-accent align-middle" />
          ) : null}
        </div>
      </div>
    </div>
  )
}
