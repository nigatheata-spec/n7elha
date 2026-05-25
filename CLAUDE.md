# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server on http://localhost:8080
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Run tests once (vitest)
npm run test:watch   # Watch mode
```

Single test file: `npx vitest run src/test/example.test.ts`

Supabase (requires CLI at `~/.npm-global/bin/supabase` and `SUPABASE_ACCESS_TOKEN` env var):
```bash
supabase db push                                    # Apply new migrations
supabase functions deploy generate-quiz             # Deploy quiz AI function
supabase functions deploy generate-question-image   # Deploy image AI function
supabase secrets set KEY=value                      # Set edge function secrets
```

## What this app is

**n7elha** is an Arabic-first classroom quiz game platform. Teachers create quizzes, host live game sessions with a room code, and students join on their phones. The game has a hacking/crypto theme — correct answers earn "crypto", and a special power-up lets students hack rivals to steal their crypto. The teacher watches everything in real time on a projector screen.

Two languages (Arabic default, English toggle), always LTR layout regardless of language.

## Architecture

### Data flow

All state lives in Supabase. The frontend never talks to a separate backend — everything is either a direct Supabase table operation or a Supabase Edge Function call for AI.

Realtime is driven by `supabase.channel()` with `postgres_changes` subscriptions. Every live view (lobby, game, monitor) has its own channel that refreshes local state on any DB change.

### Route structure

Two completely separate user experiences share the same codebase:

**Teacher (`/app/*`)** — requires auth, wrapped in `TeacherLayout` with sidebar:
- `/app` → Dashboard
- `/app/quizzes` → list, `/app/quizzes/new?ai=1` → AI mode, `/app/quizzes/:id/edit` → edit
- `/app/host/:quizId` → configure and open lobby, then redirects to monitor
- `/app/games/:sessionId/monitor` → full-screen projector view (no sidebar)
- `/app/games/:sessionId/results` → post-game results

**Student (`/play/*`)** — no auth, uses localStorage for identity:
- `/play` → join with room code
- `/play/:sessionId` → the game itself

### Database schema (key tables)

- `quizzes` — owned by teacher (`created_by`), has `title`, `subject`, `grade_level`, `source` (manual|ai)
- `questions` — belong to a quiz, `position`-ordered, have `options` (jsonb array), `correct_index`, `image_url`
- `game_sessions` — has `code` (4-char room code), `status` (lobby→running→finished), `settings` (jsonb with `minutes`, `cryptoCap`, `maxStudents`), `teacher_id`, `quiz_id`
- `game_students` — one row per player per session, tracks `crypto`, `correct_answers`, `total_answers`, `hacks_made`, `hacks_received`, `is_breached`, `password` (the "hackable" password shown to other players)
- `hack_events` — log of hacking attempts: `hacker_id`, `target_id`, `success`, `crypto_transferred`
- `question_responses` — individual answer records per student per question

### Game loop (student side)

`Game.tsx` manages a local `phase` state machine: `waiting → question → answered → output → hacking → breach → question → ...`

- Questions are picked **randomly client-side** from the full quiz question set each round (not server-driven)
- Correct answer → `output` phase: `OutputCards` shows a random reward card (flat crypto, multiplier, or hack power-up)
- Hack power-up → `hacking` phase: `HackingFlow` picks a weighted random target and shows 5 password choices (1 real, 4 decoys from other players)
- If targeted, player enters `breach` phase: `BreachModal` plays a breach animation

### Game end conditions

Configured by teacher in `HostGame.tsx`: time limit (minutes) and/or crypto cap. `GameMonitor.tsx` handles auto-end — it polls `now` every 500ms and triggers `status = "finished"` when either limit is hit.

### AI edge functions

- `generate-quiz` → OpenRouter (`gemini-2.0-flash-001`) — takes document text + images + config, returns structured quiz via function calling
- `generate-question-image` → Google AI native API (`gemini-2.0-flash-exp-image-generation`) — returns base64 inline image, immediately uploaded to the `question-images` storage bucket

### Auth

`AuthProvider` in `src/lib/auth.tsx` wraps the app. `useAuth()` returns `{ user, session, loading, signOut }`. `RequireAuth` component redirects unauthenticated users to `/auth`. Students bypass auth entirely — their identity is stored in `localStorage` as `hash_student_${sessionId}`.

### i18n

All UI strings go through `useTranslation()` / `t("key")`. Keys are defined inline in `src/lib/i18n.ts` (no separate JSON files). Default language is Arabic (`fallbackLng: "ar"`), toggled via `LangToggle` stored in `localStorage` as `hash_lang`. Layout is always LTR — only text content translates.

### Styling

Tailwind with a custom dark terminal theme. CSS variables for colors in `src/index.css`. Custom classes like `bg-gradient-cyan`, `shadow-glow`, `text-glow-cyan`, `terminal-screen`, `terminal-scanlines`, `bg-grid` are defined there. The game view (`/play/:sessionId` and `/monitor`) uses `theme-game` class for the green-on-black terminal aesthetic. The teacher dashboard uses the default dark theme.

## Environment

```
VITE_SUPABASE_URL          # Supabase project URL
VITE_SUPABASE_PUBLISHABLE_KEY  # Supabase anon key
```

Edge function secrets (set via `supabase secrets set`):
```
OPENROUTER_API_KEY   # For generate-quiz
GOOGLE_API_KEY       # For generate-question-image
```
