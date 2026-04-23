import Link from "next/link"
import { redirect } from "next/navigation"
import { KlazTitle } from "@/components/klaz/KlazTitle"
import { createClient } from "@/lib/supabase/server"

// Public marketing landing. Logged-in users are redirected straight to
// their surface so they never see this again. The hero product mock is
// a decorative preview of the live-session surface — no real data.

export default async function RootPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()
    if (profile?.role === "teacher") redirect("/dashboard")
    redirect("/learn")
  }

  return (
    <div className="min-h-screen bg-klaz-bg text-klaz-ink">
      {/* Top nav */}
      <nav className="mx-auto flex w-full max-w-7xl items-center gap-7 px-6 py-5 sm:px-12">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-klaz-ink font-serif text-[17px] italic text-klaz-bg">
            K
          </span>
          <span className="font-serif text-[24px] leading-none tracking-tight">
            Klaz
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/login"
            className="hidden text-[13.5px] text-klaz-ink2 hover:text-klaz-ink sm:inline"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 rounded-md bg-klaz-ink px-4 py-2 text-[13.5px] font-medium text-klaz-bg hover:bg-klaz-deep"
          >
            Start for free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto grid w-full max-w-7xl items-center gap-10 px-6 py-10 sm:px-12 md:grid-cols-[1.05fr_1fr] md:gap-12 md:py-14">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#eac3b1] bg-klaz-accent-bg px-3 py-1 font-mono text-[11.5px] uppercase tracking-[0.06em] text-klaz-accent2">
            ● New · Class Pulse is live
          </div>
          <KlazTitle size="xl" className="mt-4">
            An AI tutor your students <i>trust</i>,<br />
            taught by <span className="text-klaz-accent">you</span>
          </KlazTitle>
          <p className="mt-5 max-w-lg text-[16.5px] leading-[1.55] text-klaz-ink2">
            Klaz is a classroom tutor scoped to <i>your</i> lessons. Students
            ask without fear of looking dumb. You see every question, every
            misconception, in real time.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 rounded-md bg-klaz-accent px-4 py-2.5 text-[14px] font-medium text-white hover:bg-klaz-accent2"
            >
              Start a free class →
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-md border border-klaz-line bg-klaz-panel2 px-4 py-2.5 text-[14px] font-medium text-klaz-ink hover:bg-klaz-line2"
            >
              Sign in
            </Link>
          </div>
          <div className="mt-5 font-mono text-[12px] uppercase tracking-[0.04em] text-klaz-muted">
            Free for teachers · No credit card · Setup in 3 min
          </div>
        </div>

        {/* Hero product mock */}
        <div className="rounded-2xl border border-klaz-line bg-klaz-panel p-4 shadow-[0_40px_80px_-40px_rgba(42,37,32,0.3)]">
          <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-klaz-faint">
            Live · Algebra II · Period 3
          </div>
          <div
            className="relative overflow-hidden rounded-xl p-5 text-klaz-bg"
            style={{
              background:
                "radial-gradient(circle at 90% 10%, rgba(142,203,178,0.35), transparent 55%), #2b2a38",
            }}
          >
            <div className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[rgba(246,241,231,0.55)]">
              Hottest topic
            </div>
            <div className="mt-1.5 font-serif text-[56px] leading-none">
              62
              <span className="text-[22px] text-[rgba(246,241,231,0.5)]">%</span>
            </div>
            <div className="font-serif text-[22px] italic text-klaz-accent">
              Quadratic formula
            </div>
            <div className="mt-2 text-[12.5px] text-[rgba(246,241,231,0.6)]">
              of 18 active students confused
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { q: "why does the formula work", t: "Sofia" },
                { q: "what's b² − 4ac", t: "Maya" },
                { q: "when do I factor instead", t: "Noah" },
              ].map((c) => (
                <div
                  key={c.q}
                  className="rounded-md border border-[rgba(246,241,231,0.12)] bg-[rgba(246,241,231,0.08)] px-2.5 py-1.5 text-[11.5px]"
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[rgba(246,241,231,0.5)]">
                    {c.t} ·{" "}
                  </span>
                  {c.q}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto grid w-full max-w-7xl gap-4 px-6 pb-12 sm:px-12 md:grid-cols-3">
        {[
          {
            n: "01",
            t: "Scoped tutoring",
            d: "Klaz only answers within what you're teaching this week. No off-topic shortcuts, no cheating.",
          },
          {
            n: "02",
            t: "Class Pulse",
            d: "Watch confusion as it happens. Bigger, hotter circles = more students asking about it, right now.",
          },
          {
            n: "03",
            t: "Per-student practice",
            d: "Practice sets built from what each student actually struggled with. You approve before they see it.",
          },
        ].map((f) => (
          <div
            key={f.n}
            className="rounded-xl border border-klaz-line bg-klaz-panel p-5"
          >
            <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-klaz-faint">
              {f.n}
            </div>
            <div className="mt-2.5 font-serif text-[24px] tracking-tight">
              {f.t}
              <span className="text-klaz-accent">.</span>
            </div>
            <div className="mt-2 text-[13.5px] leading-[1.55] text-klaz-ink2">
              {f.d}
            </div>
          </div>
        ))}
      </section>

      {/* Social proof */}
      <section className="border-t border-klaz-line bg-klaz-panel px-6 py-12 sm:px-12">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-8 md:grid-cols-2">
          <div className="font-serif text-[26px] leading-[1.2] tracking-tight md:text-[30px]">
            &ldquo;The first time I ran a live session with Klaz, three quiet
            kids asked more questions in{" "}
            <i className="text-klaz-accent">20 minutes</i> than they had all
            term.&rdquo;
            <div className="mt-3.5 font-sans text-[13.5px] text-klaz-muted">
              — Ms. Reyna Chen · Mira Tutor Centre
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { k: "2,400+", v: "teachers" },
              { k: "86k", v: "students tutored" },
              { k: "3.1M", v: "questions answered" },
            ].map((s) => (
              <div
                key={s.k}
                className="rounded-xl border border-klaz-line bg-klaz-panel2 p-4"
              >
                <div className="font-serif text-[32px] leading-none text-klaz-ink">
                  {s.k}
                </div>
                <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.06em] text-klaz-muted">
                  {s.v}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="px-6 py-8 sm:px-12">
        <div className="mx-auto w-full max-w-7xl font-mono text-[11px] uppercase tracking-[0.08em] text-klaz-faint">
          © Klaz 2026 · Privacy · Terms
        </div>
      </footer>
    </div>
  )
}
