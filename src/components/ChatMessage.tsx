import { cn } from "@/lib/utils"

export function ChatMessage({
  role,
  content,
  isStreaming,
}: {
  role: "user" | "assistant"
  content: string
  isStreaming?: boolean
}) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-navy px-4 py-2 text-sm text-white shadow-sm">
          {content}
        </div>
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
          "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-sm border border-slate-100 bg-white px-4 py-2 text-sm text-slate-800 shadow-sm"
        )}
      >
        {content}
        {isStreaming ? (
          <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-slate-400 align-middle" />
        ) : null}
      </div>
    </div>
  )
}
