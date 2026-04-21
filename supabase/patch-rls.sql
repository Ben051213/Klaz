-- Fix for "infinite recursion detected in policy" errors.
-- Paste this into the Supabase SQL editor and Run.
-- Safe to re-run — it drops and recreates the affected policies.

-- ─── Security-definer helpers break cross-table policy recursion ─────────────
create or replace function public.is_teacher_of_class(p_class_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.classes where id = p_class_id and teacher_id = auth.uid()
  );
$$;

create or replace function public.is_enrolled_in_class(p_class_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.class_enrollments
    where class_id = p_class_id and student_id = auth.uid()
  );
$$;

create or replace function public.is_teacher_of_session(p_session_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.sessions where id = p_session_id and teacher_id = auth.uid()
  );
$$;

-- ─── Drop old recursive policies ─────────────────────────────────────────────
drop policy if exists "teacher reads enrolled students" on public.profiles;
drop policy if exists "student reads enrolled classes" on public.classes;
drop policy if exists "anyone can read class by join code" on public.classes;
drop policy if exists "teacher reads class enrollments" on public.class_enrollments;
drop policy if exists "student reads active session" on public.sessions;
drop policy if exists "teacher reads class messages" on public.messages;
drop policy if exists "teacher reads class scores" on public.student_topic_scores;
drop policy if exists "teacher manages practice" on public.practice_sets;
drop policy if exists "practice items follow set" on public.practice_items;

-- ─── Recreate without cross-table recursion ──────────────────────────────────

-- profiles: teacher sees students in their classes
create policy "teacher reads enrolled students" on public.profiles for select using (
  exists (
    select 1 from public.class_enrollments ce
    where ce.student_id = profiles.id
      and public.is_teacher_of_class(ce.class_id)
  )
);

-- classes: students can read any class they're enrolled in; anyone can look up by code
create policy "student reads enrolled classes" on public.classes for select using (
  public.is_enrolled_in_class(classes.id)
);
create policy "anyone can read class by join code" on public.classes for select using (true);

-- class_enrollments: teachers read enrollments for their classes
create policy "teacher reads class enrollments" on public.class_enrollments for select using (
  public.is_teacher_of_class(class_enrollments.class_id)
);

-- sessions: enrolled students can read sessions for their class
create policy "student reads active session" on public.sessions for select using (
  public.is_enrolled_in_class(sessions.class_id)
);

-- messages: teacher reads messages in sessions they own
create policy "teacher reads class messages" on public.messages for select using (
  public.is_teacher_of_session(messages.session_id)
);

-- student_topic_scores: teacher reads scores in their classes
create policy "teacher reads class scores" on public.student_topic_scores for select using (
  public.is_teacher_of_class(student_topic_scores.class_id)
);

-- practice_sets: teacher manages practice for sessions they own
create policy "teacher manages practice" on public.practice_sets for all using (
  public.is_teacher_of_session(practice_sets.session_id)
);

-- practice_items: student sees their own, teacher sees sets from their sessions
create policy "practice items follow set" on public.practice_items for select using (
  exists (
    select 1 from public.practice_sets ps
    where ps.id = practice_items.practice_set_id
      and (ps.student_id = auth.uid() or public.is_teacher_of_session(ps.session_id))
  )
);
