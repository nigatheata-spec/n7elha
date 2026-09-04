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

Supabase — the CLI is **not** installed globally (no Homebrew binary, nothing on
`PATH`). Run it through npx, which works against the linked project without a
`SUPABASE_ACCESS_TOKEN`:
```bash
npx supabase@latest migration list                      # Compare local vs remote history
npx supabase@latest db push                             # Apply new migrations
npx supabase@latest functions deploy generate-quiz      # Deploy quiz AI function
npx supabase@latest functions deploy generate-question-image
npx supabase@latest secrets set KEY=value               # Set edge function secrets
```

> **DB migrations**: always run `migration list` before `db push`. Push applies
> *every* migration missing from the remote history, so if any past migration was
> ever applied by hand instead of pushed, a push will try to replay it. When the
> two columns line up, push is safe. Commands needing Docker (`db dump`, `db diff`,
> local stack) do not work here — Docker isn't installed.

## What this app is

**nefelha** is an Arabic-first classroom quiz game platform. Teachers create quizzes, host live sessions with a 4-char room code, and students join on their phones. Nine game modes (`session.settings.mode`, picked in `HostGame.tsx`):

- **Classic** (`classic`) — the original quiz race. Answer fast, earn more.
- **Crypto Rush** (`crypto_rush`) — hacking/crypto theme. Correct answers earn crypto. Power-up lets players hack rivals to steal crypto.
- **Dodgeball** (`dodgeball`) — wrong answers cost lives (start with 1). Teacher fires stop-the-clock "timer rounds"; closest tap to 10s wins a bonus life (keep or gift to another player). Last player standing wins.
- **Hot Potato** (`hotpotato`) — a live bomb on a fuse gets passed between players; answer fast or get caught holding it when it blows.
- **Lava Floor** (`lavafloor`) — co-op survival: correct answers earn currency, spent on blocks (`lavaFloorBlocks.ts`: plank/brick/staircase/house, increasing cost and height) to build above the rising lava.
- **Humans vs Zombies** (`humansvszombies`) — two teams, two health bars. Correct answers fund team upgrades (`humansVsZombies.ts`: income tiers, streak-drain protection); heal, upgrade, sabotage, survive.
- **Don't Look Down** (`dontlookdown`) — 2D parkour platformer (`dontLookDown.ts`). Answers fuel an energy meter that's spent on movement and jumps; climb as high as you can before time runs out. A fall drops you back to the ground, and losing the height IS the cost.
- **Paint Fight** (`paintfight`) — free-for-all territory painting arena (`paintFight.ts` / `paintFightRender.ts`). Players move with a virtual joystick, leaving a paint trail in their color; a paint bucket drains on movement and refills on correct answers. No power-ups and no per-question timer — deliberately just the core loop. Real-time synced via an append-only stroke log over Supabase (`paint_fight_strokes`), replayed by every client — see that file's header comment for why cell-index batches are logged instead of raw pixels. Cell ownership is the *single* source of truth: the arena picture is a 1-pixel-per-cell offscreen bitmap upscaled with smoothing off, so what's rendered is literally the score. (`paint_fight_powerups` is now unused.)
- **Physical Games** (`physical`) — printed board + QR scans, no student devices needed. One shared device (teacher's phone/tablet) scans the board's kit QR once to connect (`kits` table, manually seeded — no admin UI), then scans whichever of the 6 repeated square-type QRs a team lands on (`src/lib/physicalGames.ts`: green/white/red = easy/medium/hard, teal = rest, yellow = double, `?` = wildcard random difficulty) to pull the next unused question of that difficulty from the quiz's own `questions` table, tracked per-session in `physical_used_questions` and reshuffled once exhausted. Question-dispenser only — no live scoring/leaderboard, scoring happens on the physical board. Camera scanning via `qr-scanner`, with a manual text-entry fallback for when camera access fails. `HostGame.tsx` skips the normal lobby/room-code flow for this mode entirely (`startPhysical` creates the session directly as `running`).

Several of the newer modes (Lava Floor, Humans vs Zombies, Don't Look Down) share an "income tier" upgrade-economy pattern: correct answers earn currency, spent on tiered purchases with rising cost/payout, defined as a `{level, cost, payout, nameEn, nameAr}[]` array in that mode's `src/lib/*.ts` file.

Two languages (Arabic default, English toggle), always LTR layout regardless of language.

## Architecture

### Data flow

All state lives in Supabase — no separate backend. Everything is either a direct Supabase table operation or an Edge Function call for AI. Realtime uses `supabase.channel()` with `postgres_changes` subscriptions.

### Route structure

**Teacher (`/app/*`)** — requires auth, wrapped in `TeacherLayout` (fixed sidebar, `collapsible="none"`, 5.5rem wide, icon-above-label style):
- `/app` → Dashboard
- `/app/quizzes` → list; `/app/quizzes/new?ai=1` → AI builder; `/app/quizzes/:id/edit` → manual editor
- `/app/host/:quizId` → mode picker (all 8 modes) then lobby config
- `/app/games/:sessionId/monitor` → single route, `GameMonitor.tsx` — reads `session.settings.mode` and renders the matching `*Monitor` component (`ClassicMonitor`, `DodgeballMonitor`, `HotPotatoMonitor`, `LavaFloorMonitor`, `HumansVsZombiesMonitor`, `DontLookDownMonitor`, `PaintFightMonitor`; unmatched mode falls through to `GameMonitor`'s own Crypto Rush view)
- `/app/games/:sessionId/results` → cinematic results screen
- `/app/settings` → account (display name, password) + language switcher

**Student (`/play/*`)** — no auth, identity in `localStorage`:
- `/play` → join with room code
- `/play/:sessionId` → single route, `Game.tsx` — reads `session.settings.mode` and renders the matching `*Game` component (`ClassicGame`, `DodgeballGame`, `HotPotatoGame`, `LavaFloorGame`, `HumansVsZombiesGame`, `DontLookDownGame`, `PaintFightGame`; unmatched mode falls through to `Game.tsx`'s own Crypto Rush view)

Adding a new mode means: a `settings.mode` string, a `*Game.tsx` + `*Monitor.tsx` pair, an entry in `HostGame.tsx`'s `MODES` array, the `if (mode === "...")` branch in both `Game.tsx` and `GameMonitor.tsx`, and usually a per-mode `src/lib/<mode>.ts` (+ a `<mode>Render.ts` for canvas-based modes) plus a migration adding its `game_students`/`game_sessions` columns.

### Database schema (key tables)

- `quizzes` — `title`, `subject`, `grade_level`, `source` (manual|ai), owned by `created_by`
- `questions` — `options` (jsonb array), `correct_index`, `image_url`, `position`-ordered
- `game_sessions` — `code`, `status` (lobby→running→finished), `settings` jsonb:
  - shared: `mode`, `minutes`, `maxStudents`, `timePerQ`
  - Crypto Rush: `cryptoCap`
  - Dodgeball: `timerActive`, `timerWinnerId`, `timerRoundId`, `timerStartedAt`
- `game_students` — per-player per-session; shared: `correct_answers`, `total_answers`; Crypto Rush: `crypto`, `hacks_made`, `hacks_received`, `is_breached`, `password`; Dodgeball: `lives`, `eliminated`, `eliminated_at`; every other mode adds its own columns in its own migration (e.g. `fight_hue` for Paint Fight, energy/checkpoint columns for Don't Look Down) — check `supabase/migrations/` for the mode's migration file rather than assuming this list is exhaustive
- `hack_events` — Crypto Rush hack log
- `question_responses` — per-student per-question answer records
- `dodgeball_timer_taps` — one row per player per timer round: `elapsed_ms`, `timer_round_id` (unique constraint prevents duplicates)
- `paint_fight_strokes` / `paint_fight_powerups` — Paint Fight's append-only cell-index log and power-up spawn tracking, see `paintFight.ts`'s header comment
- `kits` — Physical Games boards, `id` is the printed short code (e.g. `K4471`), `status` (active|disabled); manually seeded, no admin UI yet. `game_sessions.kit_id` links a session to its kit.
- `physical_used_questions` — `(session_id, question_id)`, tracks which of a Physical Games session's own quiz questions have already been dispensed, cleared per-difficulty on exhaustion (see `physicalGames.ts`)

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

### Game loop: other modes

Briefer than the two above since they're less central, but real and shipped:

- **Classic** — simplest phase machine: `waiting → question → answered → done`. No dev-only preview harness on the others; `ClassicGame.tsx` has one at `/play/preview?preview=1&mode=classic&phase=...` for iterating on a phase's UI without hosting a real session.
- **Hot Potato** — `waiting → question → answered → passing → exploded → done`. The "potato" (bomb) passes between players on a fuse; whoever's holding it when `exploded` fires is out.
- **Lava Floor** — co-op economy game. Correct answers earn currency spent on `BLOCK_TYPES` (`lavaFloorBlocks.ts`: plank → brick → staircase → house, each pricier and taller) to build a platform above the rising lava. Shares the income-tier upgrade pattern with Humans vs Zombies and Don't Look Down.
- **Humans vs Zombies** — two-team economy game (`humansVsZombies.ts`). Each team has its own `INCOME_TIERS` (different flavor text per team, same cost/payout shape) and a `STREAK_DRAIN_TIERS` ladder that softens how much a wrong-answer streak reset costs.
- **Don't Look Down** — 2D parkour platformer. World space is +Y up (renderer flips Y so world-up reads as screen-up); movement/jumping spend an energy meter refilled by correct answers. The climb is **generated per session**: `buildClimb(minutes)` in `dontLookDown.ts` sizes the tower to the session's length (~700m per minute), so a 20-minute round is four times the climb of a 5-minute one. It opens on a flat tutorial base with hint signs, then runs a sequence of *stages* — beam, shaft, pillars, chain, dip, leap — each opening on a wide rest, with platform sizes shrinking and gaps widening as you climb. Gaps are never hand-numbered: they're asked for as a fraction of what `singleReach`/`doubleReach` actually allow, so the level can't strand a player, and `src/test/dldLevel.test.ts` proves it across every session length. Above the halfway mark some jumps are sized for a double jump (the 500-cash upgrade).
  - `dldArt.ts` is pure data — the art pools, sized from `dldArtManifest.ts`. That manifest is **generated** by `scripts/bake_dld_art.py`, which bakes every sprite to the exact size it's blitted at; re-run it after changing source art. Art plays one of three roles: `tile` (square, repeats to build a platform of any width), `ledge` (one-piece, natural width), `perch` (a themed prop with a landable top — the small precision targets). `dontLookDownRender.ts` is the only module that loads the PNGs.
- **Paint Fight** — see the mode list above; `paintFight.ts` / `paintFightRender.ts` carry the fullest architecture comment of any mode file since it's the only one with continuous real-time position sync (virtual joystick + broadcast channel) rather than discrete per-question state.

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
