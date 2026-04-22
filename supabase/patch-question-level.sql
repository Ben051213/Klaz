-- Adds question_level tagging to messages so we can score students based on
-- the difficulty of what they ASK relative to the lesson plan, not just their
-- confidence after the AI responds.
-- Paste into the Supabase SQL editor and Run. Safe to re-run.

alter table public.messages
  add column if not exists question_level text
  check (question_level in ('below', 'at', 'above'));
