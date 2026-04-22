# Klaz

AI-powered classroom intelligence for tutor centres. Teachers run live sessions; students chat with an on-topic AI tutor; a live "class pulse" surfaces who's struggling and on what. After class, teachers one-click generate a per-student practice set.

Built on Next.js 16 (App Router, Turbopack), Supabase (auth + Postgres + Realtime), and Anthropic (Claude Sonnet 4.6 for chat, Claude Haiku 4.5 for tagging + lesson-plan extraction).

## What's inside

- **Teacher dashboard** — create classes, generate join codes, see live student activity during a session.
- **Student chat** — a session-scoped AI tutor that only answers questions relevant to the current lesson.
- **Class Pulse (live)** — per-topic scores update in real time as students ask questions.
- **Question-difficulty ranking** — every student question is tagged below / on / above the lesson level, visible to the student and factored into their topic score via a 3×3 delta matrix (mastery up, foundation gap down).
- **Lesson plan extraction** — paste outline text or upload a PDF; Claude extracts main topic, subtopics, objectives, key examples, and vocabulary, which the tutor then stays anchored to.
- **Practice generation** — at end of session, auto-generate targeted practice items for each student's weakest topics.

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev
```

Open `http://localhost:3000`.

### Required env vars

```
NEXT_PUBLIC_SUPABASE_URL       # Supabase project → Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY  # "anon public" or sb_publishable_... key
SUPABASE_SERVICE_ROLE_KEY      # service_role or sb_secret_... key (server-only)
ANTHROPIC_API_KEY              # console.anthropic.com/settings/keys
NEXT_PUBLIC_APP_URL            # http://localhost:3000 locally; your prod URL in prod
```

### Database setup

In a fresh Supabase project, open the SQL editor and run the files in `supabase/` in this order:

1. `schema.sql` — tables, triggers, RLS policies, security-definer helpers, realtime publications.
2. `patch-rls.sql` — only if you hit "infinite recursion detected in policy" (safe to re-run).
3. `patch-question-level.sql` — adds the `messages.question_level` column used by the difficulty-ranking feature.

## Deploying to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel, **Import Project** → select the repo.
3. Framework preset: **Next.js**. Root directory: the folder containing `package.json`.
4. Add the env vars listed above. Set `NEXT_PUBLIC_APP_URL` to your Vercel URL (e.g. `https://klaz.vercel.app`).
5. Deploy.

After first deploy, update **Supabase → Authentication → URL Configuration**:
- **Site URL** → your Vercel URL
- **Redirect URLs** → add `https://<your-vercel-url>/**`

Otherwise magic-link / OAuth redirects will bounce back to localhost.

## Architecture notes

- `src/proxy.ts` — Next 16 "proxy" (formerly middleware). Gates `/dashboard` and `/learn` behind auth, and hydrates the Supabase SSR cookie on every request.
- `src/lib/anthropic.ts` — `buildSystemPrompt`, `tagMessage` (async post-stream tagger), `processLessonPlan` (accepts text or PDF).
- `src/app/api/chat/route.ts` — streams Sonnet 4.6 responses back to the client, then fires `tagMessage` in the background to update `messages.topics/confidence_signal/question_level` and `student_topic_scores`.
- `src/app/api/sessions/route.ts` — accepts either JSON or multipart form (for PDF upload up to 10 MB).
- RLS uses `SECURITY DEFINER` helper functions (`is_teacher_of_class`, `is_enrolled_in_class`, `is_teacher_of_session`) to break cross-table policy recursion. If you change policies, prefer calling those helpers over joining tables.

## Scoring matrix

Topic scores move per question based on **question difficulty × confidence signal**:

|                           | confused | partial | understood |
| ------------------------- | -------- | ------- | ---------- |
| **above** (harder)        | +2       | +6      | +12        |
| **at** (on lesson level)  | −5       | 0       | +6         |
| **below** (prerequisites) | −10      | −5      | −2         |

Scores are clamped to `[0, 100]` and start at `50` on first mention.
