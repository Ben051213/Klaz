-- Feature batch 2: student profile page, teacher-resolved topics,
-- per-class flavor + tutor tone, teacher notes per student, session
-- targets. Run in Supabase SQL editor ONCE. Each statement is
-- re-runnable (IF NOT EXISTS / IF EXISTS).

-- ── classes: pastel flavor + tutor tone ─────────────────────────────────
-- `flavor` drives the per-class accent tint on the student & teacher
-- dashboards. Six macaron colors; anything else stored will fall back to
-- mint on the client. `tutor_tone` is free-text injected into the tutor's
-- system prompt — small hints like "use UK spelling" or "assume Year 8
-- baseline".
alter table public.classes
  add column if not exists flavor text default 'mint'
    check (flavor in ('mint', 'rose', 'lavender', 'apricot', 'pistachio', 'vanilla'));

alter table public.classes
  add column if not exists tutor_tone text;

-- ── student_topic_scores: teacher override ──────────────────────────────
-- `teacher_override_at` locks a score from being overwritten by the AI
-- tagging pipeline for 14 days — otherwise one fresh confused message
-- would un-resolve a topic the teacher just verified in person.
-- `teacher_note` is optional context the teacher can leave for themselves.
alter table public.student_topic_scores
  add column if not exists teacher_override_at timestamptz;

alter table public.student_topic_scores
  add column if not exists teacher_note text;

-- ── class_student_notes: per-class teacher notes ────────────────────────
-- Free-text notes the teacher keeps on each student within a class
-- ("met with parent 3/4", "doing better after switching seats"). Not
-- exposed to the student — ever.
create table if not exists public.class_student_notes (
  class_id uuid references public.classes(id) on delete cascade not null,
  student_id uuid references public.profiles(id) on delete cascade not null,
  note text,
  updated_at timestamptz default now(),
  primary key (class_id, student_id)
);

alter table public.class_student_notes enable row level security;

drop policy if exists "teacher manages student notes" on public.class_student_notes;
create policy "teacher manages student notes" on public.class_student_notes
  for all using (public.is_teacher_of_class(class_id));

-- ── messages: pin for session highlights ────────────────────────────────
-- Teacher can star any question during a live session. Starred questions
-- carry into the digest as "revisit these next class" and surface in the
-- student profile timeline.
alter table public.messages
  add column if not exists pinned_at timestamptz;

-- ── Backfill flavor for existing classes so they don't all look the same ──
-- Deterministic pick based on the class id hash — spreads colors evenly
-- without randomness across deploys.
update public.classes
set flavor = (
  array['mint', 'rose', 'lavender', 'apricot', 'pistachio', 'vanilla']
)[1 + (abs(hashtext(id::text)) % 6)]
where flavor is null or flavor = 'mint';
