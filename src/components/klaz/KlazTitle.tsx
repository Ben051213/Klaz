import * as React from "react"
import { cn } from "@/lib/utils"

// Editorial serif page title with the Klaz signature terracotta period.
// Usage:
//   <KlazTitle>Your classes</KlazTitle>
//   <KlazTitle size="lg">Algebra II · Period 3</KlazTitle>

export function KlazTitle({
  children,
  size = "md",
  as: Tag = "h1",
  className,
  noPeriod = false,
}: {
  children: React.ReactNode
  size?: "sm" | "md" | "lg" | "xl"
  as?: "h1" | "h2" | "h3"
  className?: string
  noPeriod?: boolean
}) {
  const sizeClass = {
    sm: "text-[22px] leading-none",
    md: "text-[30px] leading-none md:text-[34px]",
    lg: "text-[36px] leading-[1.02] md:text-[44px]",
    xl: "text-[48px] leading-[0.98] md:text-[64px]",
  }[size]
  return (
    <Tag
      className={cn(
        "font-serif tracking-[-0.02em] font-normal text-klaz-ink",
        sizeClass,
        className
      )}
    >
      {children}
      {noPeriod ? null : <span className="text-klaz-accent">.</span>}
    </Tag>
  )
}
