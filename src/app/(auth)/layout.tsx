import Link from "next/link"

// Split-screen auth shell: dark editorial panel on the left (ink deep
// bg with the terracotta glow + teacher manifesto quote), form on the
// right. Collapses to a single column on small screens — the left panel
// becomes a compact banner above the form.

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="grid min-h-screen bg-klaz-bg md:grid-cols-2">
      {/* Editorial panel */}
      <div
        className="relative flex flex-col justify-between overflow-hidden px-8 py-10 text-klaz-bg md:px-12 md:py-14"
        style={{
          background:
            "radial-gradient(circle at 100% 20%, rgba(142,203,178,0.32), transparent 55%), #2b2a38",
        }}
      >
        <Link href="/" className="relative flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-klaz-bg font-serif text-[16px] italic text-klaz-deep">
            K
          </span>
          <span className="font-serif text-[24px] leading-none tracking-tight">
            Klaz
          </span>
        </Link>

        <div className="relative py-8 md:py-0">
          <div className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-[rgba(246,241,231,0.55)]">
            A note for teachers
          </div>
          <div className="mt-3.5 font-serif text-[28px] leading-[1.1] tracking-[-0.02em] md:text-[40px]">
            Your students ask{" "}
            <i className="mr-[0.12em] text-klaz-accent">Klaz</i> the questions
            they&rsquo;d never ask out loud.
          </div>
          <p className="mt-4 max-w-md text-[14px] leading-[1.6] text-[rgba(246,241,231,0.7)]">
            So when they&rsquo;re stuck, you see it — quietly, precisely, in
            time to actually do something about it.
          </p>
        </div>

        <div className="relative font-mono text-[11px] uppercase tracking-[0.08em] text-[rgba(246,241,231,0.45)]">
          © Klaz 2026 · Privacy · Terms
        </div>
      </div>

      {/* Form column */}
      <div className="flex items-center justify-center px-6 py-10 md:px-12 md:py-14">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  )
}
