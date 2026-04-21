-- Run this in the Supabase SQL editor.
-- The ALTER PUBLICATION statements at the bottom enable Realtime
-- on the 'messages' and 'sessions' tables. If re-running, those
-- two statements will error with "already a member" — safe to ignore.

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─── profiles ─────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null,
  email text not null,
  role text not null check (role in ('teacher', 'student')),
  avatar_url text,
  created_at timestamptz default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'student')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── classes ──────────────────────────────────────────────────────────────────
create table public.classes (
  id uuid default gen_random_uuid() primary key,
  teacher_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  subject text not null,
  grade text,
  join_code text unique not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ─── class_enrollments ────────────────────────────────────────────────────────
create table public.class_enrollments (
  id uuid default gen_random_uuid() primary key,
  class_id uuid references public.classes(id) on delete cascade not null,
  student_id uuid references public.profiles(id) on delete cascade not null,
  joined_at timestamptz default now(),
  unique(class_id, student_id)
);

-- ─── sessions ─────────────────────────────────────────────────────────────────
create table public.sessions (
  id uuid default gen_random_uuid() primary key,
  class_id uuid references public.classes(id) on delete cascade not null,
  teacher_id uuid references public.profiles(id) not null,
  title text not null,
  lesson_plan text,
  ai_context text,
  status text default 'active' check (status in ('active', 'ended')),
  started_at timestamptz default now(),
  ended_at timestamptz
);

-- ─── messages ─────────────────────────────────────────────────────────────────
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.sessions(id) on delete cascade not null,
  student_id uuid references public.profiles(id) not null,
  student_text text not null,
  ai_response text,
  topics text[] default '{}',
  confidence_signal text check (confidence_signal in ('confused', 'partial', 'understood')),
  created_at timestamptz default now()
);

-- ─── student_topic_scores ─────────────────────────────────────────────────────
create table public.student_topic_scores (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references public.profiles(id) on delete cascade not null,
  class_id uuid references public.classes(id) on delete cascade not null,
  topic text not null,
  score integer default 50 check (score >= 0 and score <= 100),
  last_updated timestamptz default now(),
  unique(student_id, class_id, topic)
);

-- ─── practice_sets ────────────────────────────────────────────────────────────
create table public.practice_sets (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references public.profiles(id) not null,
  session_id uuid references public.sessions(id) not null,
  topics text[] not null,
  status text default 'pending' check (status in ('pending', 'approved', 'sent')),
  created_at timestamptz default now()
);

-- ─── practice_items ───────────────────────────────────────────────────────────
create table public.practice_items (
  id uuid default gen_random_uuid() primary key,
  practice_set_id uuid references public.practice_sets(id) on delete cascade not null,
  question text not null,
  answer text not null,
  hint text,
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  sort_order integer default 0
);

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_enrollments enable row level security;
alter table public.sessions enable row level security;
alter table public.messages enable row level security;
alter table public.student_topic_scores enable row level security;
alter table public.practice_sets enable row level security;
alter table public.practice_items enable row level security;

-- Security-definer helpers — these break policy recursion between classes,
-- class_enrollments, sessions and messages, all of which reference each other.
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

-- profiles
create policy "users read own profile" on profiles for select using (auth.uid() = id);
create policy "users update own profile" on profiles for update using (auth.uid() = id);
create policy "teacher reads enrolled students" on profiles for select using (
  exists (
    select 1 from class_enrollments ce
    where ce.student_id = profiles.id
      and public.is_teacher_of_class(ce.class_id)
  )
);

-- classes
create policy "teacher manages own classes" on classes for all using (teacher_id = auth.uid());
create policy "student reads enrolled classes" on classes for select using (
  public.is_enrolled_in_class(classes.id)
);
create policy "anyone can read class by join code" on classes for select using (true);

-- class_enrollments
create policy "student manages own enrollment" on class_enrollments for all using (student_id = auth.uid());
create policy "teacher reads class enrollments" on class_enrollments for select using (
  public.is_teacher_of_class(class_enrollments.class_id)
);

-- sessions
create policy "teacher manages own sessions" on sessions for all using (teacher_id = auth.uid());
create policy "student reads active session" on sessions for select using (
  public.is_enrolled_in_class(sessions.class_id)
);

-- messages
create policy "student manages own messages" on messages for all using (student_id = auth.uid());
create policy "teacher reads class messages" on messages for select using (
  public.is_teacher_of_session(messages.session_id)
);

-- student_topic_scores
create policy "student reads own scores" on student_topic_scores for select using (student_id = auth.uid());
create policy "teacher reads class scores" on student_topic_scores for select using (
  public.is_teacher_of_class(student_topic_scores.class_id)
);
create policy "service role manages scores" on student_topic_scores for all using (true);

-- practice_sets & items
create policy "student reads own practice" on practice_sets for select using (student_id = auth.uid());
create policy "teacher manages practice" on practice_sets for all using (
  public.is_teacher_of_session(practice_sets.session_id)
);
create policy "practice items follow set" on practice_items for select using (
  exists (
    select 1 from practice_sets ps
    where ps.id = practice_items.practice_set_id
      and (ps.student_id = auth.uid() or public.is_teacher_of_session(ps.session_id))
  )
);

-- ─── Realtime ─────────────────────────────────────────────────────────────────
-- Register messages and sessions with the realtime publication so the teacher's
-- Class Pulse and the students' session banner receive live updates.
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.sessions;
