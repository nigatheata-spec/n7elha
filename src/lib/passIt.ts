// ── Pass It (hotpotato) ─────────────────────────────────────────────────────
// Several live bombs move around the class. Holding one, you pass it on by
// answering a question right; a wrong answer keeps it in your hands. Its fuse
// is hidden and random, and when it runs out whoever holds it loses half their
// points and the bomb jumps to someone else. The game runs the clock.
//
// Who writes what:
// - The projector (HotPotatoMonitor) is the only writer of the bombs. It keeps
//   them in `settings.bombs`, logs passes and blasts to `settings.hpFeed`, and
//   applies pass requests the phones send on the broadcast channel
//   `passit-<sessionId>`. One writer means two passes at the same moment can't
//   overwrite each other, which a shared settings blob otherwise would.
// - Each phone writes only its own row: points for right answers, and halving
//   its own points when it sees a blast with its name on it (the same "every
//   client is authoritative over its own fate" rule as Paint Fight and HvZ).
//
// Everything here is pure so it can be tested and shared by both sides.

export type Bomb = { id: string; holderId: string; explodesAt: string; fromId: string | null };
export type FeedEvent = { id: string; kind: "pass" | "boom" | "spawn"; from: string | null; to: string; at: string };
export type PassRequest = { bombId: string; from: string; to: string };

export const POINTS_PER_CORRECT = 100;
/** Share of points a player keeps when a bomb goes off in their hands. */
export const BOOM_KEEP = 0.5;
export const FUSE_MIN_MS = 25_000;
export const FUSE_MAX_MS = 50_000;
/** Seconds to choose who gets the bomb before it goes to someone at random. */
export const PASS_SECONDS = 5;
export const PASS_CHOICES = 3;
export const FEED_MAX = 12;

/** One bomb per five players, and always somebody without a bomb to pass to. */
export const bombCountFor = (players: number) =>
  players <= 1 ? players : Math.max(1, Math.min(Math.ceil(players / 5), players - 1, 6));

export const fuseFrom = (now: number, rand: () => number) =>
  new Date(now + FUSE_MIN_MS + rand() * (FUSE_MAX_MS - FUSE_MIN_MS)).toISOString();

const shuffle = <T,>(xs: T[], rand: () => number) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Players who don't hold a bomb, excluding `except`. */
export const freePlayers = (players: string[], bombs: Bomb[], except: string[] = []) => {
  const held = new Set(bombs.map(b => b.holderId));
  return players.filter(p => !held.has(p) && !except.includes(p));
};

export const pickTargets = (players: string[], bombs: Bomb[], me: string, rand: () => number, k = PASS_CHOICES) =>
  shuffle(freePlayers(players, bombs, [me]), rand).slice(0, k);

const newId = (rand: () => number) => Math.floor(rand() * 2 ** 32).toString(36) + Date.now().toString(36);

/** Hand out the first bombs, to different players. */
export const initBombs = (players: string[], now: number, rand: () => number): Bomb[] =>
  shuffle(players, rand).slice(0, bombCountFor(players.length)).map(holderId => ({
    id: newId(rand), holderId, explodesAt: fuseFrom(now, rand), fromId: null,
  }));

/**
 * Apply a phone's pass request. Returns null when it doesn't hold: the bomb
 * isn't the sender's any more, or the target left. A target who picked up
 * another bomb in the meantime is swapped for a random free player.
 */
export const applyPass = (bombs: Bomb[], players: string[], req: PassRequest, rand: () => number): { bombs: Bomb[]; to: string } | null => {
  const bomb = bombs.find(b => b.id === req.bombId);
  if (!bomb || bomb.holderId !== req.from) return null;
  let to = req.to;
  const free = freePlayers(players, bombs, [req.from]);
  if (!free.includes(to)) {
    if (!free.length) return null;
    to = free[Math.floor(rand() * free.length)];
  }
  return { bombs: bombs.map(b => b.id === bomb.id ? { ...b, holderId: to, fromId: req.from } : b), to };
};

/**
 * Bombs whose fuse ran out, each moved to a fresh holder with a new fuse, plus
 * the ids of who they went off on. A bomb held by someone who left the game
 * moves without a blast.
 */
export const resolveBlasts = (bombs: Bomb[], players: string[], now: number, rand: () => number) => {
  const blasts: { victim: string; to: string }[] = [];
  const moved: { from: string; to: string }[] = [];
  let next = [...bombs];
  for (const b of bombs) {
    const gone = !players.includes(b.holderId);
    if (!gone && new Date(b.explodesAt).getTime() > now) continue;
    const free = freePlayers(players, next, [b.holderId]);
    const to = free.length ? free[Math.floor(rand() * free.length)] : null;
    if (!gone) blasts.push({ victim: b.holderId, to: to ?? b.holderId });
    else if (to) moved.push({ from: b.holderId, to });
    next = to
      ? next.map(x => x.id === b.id ? { ...x, holderId: to, fromId: null, explodesAt: fuseFrom(now, rand) } : x)
      : gone ? next.filter(x => x.id !== b.id) : next.map(x => x.id === b.id ? { ...x, explodesAt: fuseFrom(now, rand) } : x);
  }
  return { bombs: next, blasts, moved };
};

/** More players joined than bombs were made for: add bombs, up to the count. */
export const topUpBombs = (bombs: Bomb[], players: string[], now: number, rand: () => number): Bomb[] => {
  const want = bombCountFor(players.length) - bombs.length;
  if (want <= 0) return bombs;
  const extra = shuffle(freePlayers(players, bombs), rand).slice(0, want).map(holderId => ({
    id: newId(rand), holderId, explodesAt: fuseFrom(now, rand), fromId: null,
  }));
  return [...bombs, ...extra];
};

/** After a pause, give every fuse back the time it was paused for. */
export const extendFuses = (bombs: Bomb[], ms: number): Bomb[] =>
  bombs.map(b => ({ ...b, explodesAt: new Date(new Date(b.explodesAt).getTime() + ms).toISOString() }));

export const pushFeed = (feed: FeedEvent[], ev: Omit<FeedEvent, "id">, rand: () => number): FeedEvent[] =>
  [{ ...ev, id: newId(rand) }, ...feed].slice(0, FEED_MAX);

/** Burned share of a fuse, 0 (fresh) to 1 (about to blow), for the fuse drawing. */
export const fuseBurn = (explodesAt: string, now: number) =>
  Math.min(1, Math.max(0, 1 - (new Date(explodesAt).getTime() - now) / FUSE_MAX_MS));
