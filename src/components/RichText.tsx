import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import { cn } from "@/lib/utils"

// Shared markdown + KaTeX renderer used anywhere we display saved AI
// responses. Before this existed we only had the pipeline wired up on
// ChatMessage (live chat) — session history, the digest, and the teacher
// student-profile timeline all rendered `ai_response` as raw text, so
// `\frac{1}{2}` / `x^2` / `\sqrt{3}` showed up as literal symbols.
//
// Kept deliberately small — just the prose styles we already use inside
// ChatMessage, minus the avatar chrome. Caller controls the container.

type Size = "sm" | "md"

export function RichText({
  children,
  size = "md",
  className,
}: {
  children: string
  size?: Size
  className?: string
}) {
  return (
    <div
      className={cn(
        "prose max-w-none text-klaz-ink",
        size === "sm"
          ? "prose-sm text-[13px] leading-[1.55]"
          : "prose-sm text-[14px] leading-[1.6]",
        "prose-p:my-1 prose-headings:my-2 prose-headings:font-semibold prose-headings:text-klaz-ink prose-ul:my-1 prose-ol:my-1 prose-li:my-0",
        "prose-pre:my-2 prose-pre:rounded-md prose-pre:bg-klaz-deep prose-pre:p-2 prose-pre:text-xs prose-pre:text-klaz-bg",
        "prose-code:rounded prose-code:bg-klaz-line2 prose-code:px-1 prose-code:py-0.5 prose-code:text-[12.5px] prose-code:font-mono prose-code:before:content-none prose-code:after:content-none",
        "prose-a:text-klaz-accent prose-strong:text-klaz-ink",
        "prose-blockquote:my-2 prose-blockquote:border-l-[3px] prose-blockquote:border-klaz-accent prose-blockquote:bg-klaz-accent-bg prose-blockquote:py-2 prose-blockquote:pl-3 prose-blockquote:pr-2 prose-blockquote:rounded-r-md prose-blockquote:not-italic prose-blockquote:text-klaz-ink",
        "prose-table:my-2 prose-table:w-full prose-table:text-xs prose-table:border prose-table:border-klaz-line prose-table:rounded-md prose-table:overflow-hidden",
        "prose-thead:bg-klaz-panel",
        "prose-th:border prose-th:border-klaz-line prose-th:px-2 prose-th:py-1 prose-th:text-left prose-th:font-semibold",
        "prose-td:border prose-td:border-klaz-line prose-td:px-2 prose-td:py-1",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
