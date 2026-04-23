-- Feature batch 1: settings, progress, practice assignment, lesson materials,
-- session digest. Run this in the Supabase SQL editor ONCE.
-- Each statement is written to be re-runnable (IF NOT EXISTS / IF EXISTS).

-- ── class_materials ──────────────────────────────────────────────────────
-- Teacher-uploaded reference material (syllabus, lesson notes, worked
-- examples). Injected into the tutor's system prompt so answers stay
-- grounded in the teacher's own curriculum — today as plain text, later
-- we can embed + retrieve if these grow large.
create table if not exists public.class_materials (
  id uuid default gen_random_uuid() primary key,
  class_id uuid references public.classes(id) on delete cascade not null,
  title text not null,
  content text not null,
  kind text not null default 'notes' check (kind in ('notes', 'syllabus', 'lesson')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists class_materials_class_id_idx
  on public.class_materials (class_id);

alter table public.class_materials enable row level security;

drop policy if exists "teacher manages own class materials" on public.class_materials;
create policy "teacher manages own class materials" on public.class_materials
  for all using (public.is_teacher_of_class(class_id));

drop policy if exists "student reads enrolled class materials" on public.class_materials;
create policy "student reads enrolled class materials" on public.class_materials
  for select using (public.is_enrolled_in_class(class_id));

-- ── practice_sets: assignment + completion ──────────────────────────────
-- `assigned_at` = when the teacher assigned the set to the student.
-- `completed_at` = when the student marked it done.
-- Reusing the existing status enum: 'pending' (AI generated, unreviewed),
-- 'approved' (teacher reviewed, not yet assigned), 'sent' (assigned to
-- student, visible in /learn/practice).
alter table public.practice_sets
  add column if not exists assigned_at timestamptz;

alter table public.practice_sets
  add column if not exists completed_at timestamptz;

alter table public.practice_sets
  add column if not exists title text;

-- A practice set can also exist outside of a session (teacher-authored
-- or per-class assignment). Relax the NOT NULL on session_id so the
-- "Practice library" workflow can create sets that are class-wide.
alter table public.practice_sets
  alter column session_id drop not null;

-- class_id lets practice sets live at the class level, not just per
-- session. Populated for all new sets from the Practice tab.
alter table public.practice_sets
  add column if not exists class_id uuid references public.classes(id) on delete cascade;

-- Backfill class_id from the session linkage for existing rows.
update public.practice_sets ps
set class_id = s.class_id
from public.sessions s
where ps.session_id = s.id
  and ps.class_id is null;

create index if not exists practice_sets_class_id_idx
  on public.practice_sets (class_id);

-- Existing RLS on practice_sets is keyed to session_id. Add class-level
-- policies so assigned-without-session sets stay visible to the right
-- people.
drop policy if exists "teacher manages class practice" on public.practice_sets;
create policy "teacher manages class practice" on public.practice_sets
  for all using (
    class_id is not null and public.is_teacher_of_class(class_id)
  );

drop policy if exists "student updates own practice status" on public.practice_sets;
create policy "student updates own practice status" on public.practice_sets
  for update using (student_id = auth.uid());

-- Mirror the looser visibility to practice_items.
drop policy if exists "practice items follow set" on public.practice_items;
create policy "practice items follow set" on public.practice_items
  for select using (
    exists (
      select 1 from public.practice_sets ps
      where ps.id = practice_items.practice_set_id
        and (
          ps.student_id = auth.uid()
          or (ps.session_id is not null and public.is_teacher_of_session(ps.session_id))
          or (ps.class_id is not null and public.is_teacher_of_class(ps.class_id))
        )
    )
  );

-- ── profiles: avatar_url already exists; nothing to add for settings ────
