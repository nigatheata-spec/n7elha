# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev -- --port 8082   # Start dev server
npm run build                # Production build
npm run lint                 # ESLint
npm run test                 # Run tests once (vitest)
npm run test:watch           # Watch mode
```

> **`/tmp` wipe warning:** The project lives at `/tmp/knowledge-hack-v2` which is wiped on every Mac reboot. After a reboot you must recreate `.env.local` — credentials are saved in Claude memory (`project_supabase_credentials.md`). Always commit and push before shutting down. GitHub repo: `https://github.com/nigatheata-spec/knowledge-hack`

Single test file: `npx vitest run src/test/example.test.ts`

Supabase (requires CLI and `SUPABASE_ACCESS_TOKEN` env var):
```bash
supabase db push                                    # Apply new migrations
supabase functions deploy generate-quiz             # Deploy quiz AI function
supabase functions deploy generate-question-image   # Deploy image AI function
supabase secrets set KEY=value                      # Set edge function secrets
```

> **DB migrations**: `supabase db push` often fails without a valid PAT. Run new `.sql` files manually in the Supabase Dashboard SQL editor instead — "Success. No rows returned" is correct output.

## What this app is

**n7elha** is an Arabic-first classroom quiz game platform. Teachers create quizzes, host live sessions with a 4-char room code, and students join on their phones. Two game modes:

- **Crypto Rush** — hacking/crypto theme. Correct answers earn crypto. Power-up lets players hack rivals to steal crypto.
- **Dodgeball** — wrong answers cost lives (start with 1). Teacher fires stop-the-clock "timer rounds"; closest tap to 10s wins a bonus life (keep or gift to another player). Last player standing wins.

Two languages (Arabic default, English toggle), always LTR layout regardless of language.

## Architecture

### Data flow

All state lives in Supabase — no separate backend. Everything is either a direct Supabase table operation or an Edge Function call for AI. Realtime uses `supabase.channel()` with `postgres_changes` subscriptions.

### Route structure

**Teacher (`/app/*`)** — requires auth, wrapped in `TeacherLayout` (fixed sidebar, `collapsible="none"`, 5.5rem wide, icon-above-label style):
- `/app` → Dashboard
- `/app/quizzes` → list; `/app/quizzes/new?ai=1` → AI builder; `/app/quizzes/:id/edit` → manual editor
- `/app/host/:quizId` → mode picker (Crypto Rush / Dodgeball) then lobby config
- `/app/games/:sessionId/monitor` → projector view — routes internally to `GameMonitor` or `DodgeballMonitor`
- `/app/games/:sessionId/results` → cinematic results screen
- `/app/settings` → account (display name, password) + language switcher

**Student (`/play/*`)** — no auth, identity in `localStorage`:
- `/play` → join with room code
- `/play/:sessionId` → `Game.tsx` (Crypto Rush) or `DodgeballGame.tsx`, routed by `session.settings.mode`

### Database schema (key tables)

- `quizzes` — `title`, `subject`, `grade_level`, `source` (manual|ai), owned by `created_by`
- `questions` — `options` (jsonb array), `correct_index`, `image_url`, `position`-ordered
- `game_sessions` — `code`, `status` (lobby→running→finished), `settings` jsonb:
  - shared: `mode`, `minutes`, `maxStudents`, `timePerQ`
  - Crypto Rush: `cryptoCap`
  - Dodgeball: `timerActive`, `timerWinnerId`, `timerRoundId`, `timerStartedAt`
- `game_students` — per-player per-session; shared: `correct_answers`, `total_answers`; Crypto Rush: `crypto`, `hacks_made`, `hacks_received`, `is_breached`, `password`; Dodgeball: `lives`, `eliminated`, `eliminated_at`
- `hack_events` — Crypto Rush hack log
- `question_responses` — per-student per-question answer records
- `dodgeball_timer_taps` — one row per player per timer round: `elapsed_ms`, `timer_round_id` (unique constraint prevents duplicates)

### Game loop: Crypto Rush

`Game.tsx` phase machine: `waiting → question → answered → output → hacking → breach → question → ...`

- Questions picked randomly client-side each round (not server-driven)
- Correct → `output` phase: `OutputCards` shows reward card (flat crypto, multiplier, or hack power-up)
- Hack power-up → `hacking` phase: `HackingFlow` picks weighted random target, shows 5 password choices (1 real + 4 decoys)
- If targeted → `breach` phase: `BreachModal` animation
- `GameMonitor.tsx` auto-ends game: polls every 500ms, sets `status = "finished"` when time or crypto cap hit

### Game loop: Dodgeball

`DodgeballGame.tsx` phase machine: `waiting → question → answered → timer → tapped → life_gift → eliminated → revived → done`

- Wrong answer → lose a life; 0 lives → `eliminated`
- Teacher fires timer rounds from `DodgeballMonitor.tsx`; broadcast via `session.settings.timerActive/timerRoundId/timerStartedAt`
- Timer winner gets +1 life → `life_gift` phase: keep or gift to any player (gifting eliminated player revives them)
- **Critical implementation detail**: `handleAnswer` uses `pickedRef` (sync ref, not state) as a double-execution guard. Phase transition fires immediately via `setTimeout` — DB updates are fire-and-forget (`.catch(() => {})`). This pattern is required: awaiting DB before transitioning phase caused the game to freeze when Supabase was slow.

### Results page

`GameResults.tsx`: `loading → cinematic → results`. Cinematic is pure CSS `@keyframes` (no framer-motion) with staggered `animation-delay`. Keyframes defined in `src/index.css`: `result-crash-in`, `result-scan`, `result-grow-x`, `result-fade-in`. Mode-aware sorting: Crypto Rush by `crypto` desc, Dodgeball by `!eliminated` then `eliminated_at` desc.

### AI edge functions

- `generate-quiz` → OpenRouter (`gemini-2.0-flash-001`) — document text + images → structured quiz via function calling
- `generate-question-image` → Google AI (`gemini-2.0-flash-exp-image-generation`) → base64 image, uploaded to `question-images` storage bucket

### Auth

`AuthProvider` in `src/lib/auth.tsx`. `useAuth()` → `{ user, session, loading, signOut }`. Students bypass auth — identity in `localStorage` as `hash_student_${sessionId}`.

### i18n

`useTranslation()` / `t("key")`. Keys defined inline in `src/lib/i18n.ts` (no JSON files). Default: Arabic (`fallbackLng: "ar"`). Language stored in `localStorage` as `hash_lang`. Layout always LTR.

**Always call `triggerLangTransition()` from `src/lib/langTransitionBus.ts` before `i18n.changeLanguage()`** — the animated overlay won't play otherwise.

### Styling conventions

CSS variables and custom classes in `src/index.css`:
- `theme-game` — dark teal/coral for Crypto Rush game views
- `theme-dodgeball` — dark crimson/orange-red for Dodgeball views
- `terminal-screen`, `terminal-scanlines`, `bg-grid` — projector/monitor screens

**No emojis anywhere.** Use Lucide icons or the letter avatar system instead. Letter avatars use a deterministic color hash:
```ts
const AV_COLORS = ["#2563eb","#16a34a","#b45309","#dc2626","#7c3aed","#0891b2","#c2410c","#0f766e"];
const av = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return { bg: AV_COLORS[Math.abs(h) % AV_COLORS.length], letter: (name.charAt(0) || "?").toUpperCase() };
};
```

`font-handwritten` uses Caveat (Latin only). `HandWrittenTitle` (`src/components/ui/hand-writing-text.tsx`) detects Arabic text via `/[؀-ۿ]/` and animates the whole word as one unit — Arabic cannot be split per-character because the shaping engine needs adjacent characters to determine letter forms.

## Environment

```
VITE_SUPABASE_URL              # Supabase project URL
VITE_SUPABASE_PUBLISHABLE_KEY  # Supabase anon key — never use the service role key in frontend code
```

Edge function secrets:
```
OPENROUTER_API_KEY   # generate-quiz
GOOGLE_API_KEY       # generate-question-image
```
