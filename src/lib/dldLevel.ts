// ── Don't Look Down — themed level skin ─────────────────────────────────────
// The climb itself (PLATFORMS in dontLookDown.ts) is hand-authored and stays
// exactly as it is — jump distances are tuned there and nothing here changes
// how the game plays. What this file does is *skin* that ladder: every platform
// gets a real pixel-art block, and the platform's box is taken from the block's
// own baked size so the art is never stretched to fit a box it doesn't match.
//
// The x-centre of each platform is preserved, so the gaps a player jumps stay
// where the original design put them.

import { PLATFORMS, type Platform } from "./dontLookDown";
import { BLOCKS, THEME_BLOCKS, type Affinity, type BlockId, type ThemeId } from "./dldArt";

/**
 * World units → buffer pixels. The game renders into a small pixel buffer that
 * the browser scales up with nearest-neighbour, so one buffer pixel is one
 * visible "pixel-art pixel". At 0.5 the 34×46 player box is 17×23 px.
 */
export const PX = 0.5;

export const toBuf = (world: number) => world * PX;
export const toWorld = (buf: number) => buf / PX;

export type Theme = {
  id: ThemeId;
  nameEn: string;
  nameAr: string;
  /** Sky ramp, top of screen → horizon. Discrete steps: this is a pixel sky. */
  sky: string[];
  stars: boolean;
};

export const THEMES: Theme[] = [
  {
    id: "school", nameEn: "Schoolyard", nameAr: "فناء المدرسة",
    sky: ["#4aa8e0", "#63b9ea", "#7ecbf2", "#9adcf7", "#bfeafb"], stars: false,
  },
  {
    id: "beach", nameEn: "Sandbar", nameAr: "الشاطئ",
    sky: ["#2f8fd4", "#5cb0e2", "#8fd0ea", "#c8e6e2", "#f2ddab"], stars: false,
  },
  {
    id: "city", nameEn: "Uptown", nameAr: "المدينة",
    sky: ["#1d2a5e", "#3a3f83", "#6a4d95", "#a4629a", "#e08a7d"], stars: true,
  },
  {
    id: "space", nameEn: "Low Orbit", nameAr: "المدار",
    sky: ["#05060f", "#0a0c1d", "#11142f", "#191d44", "#232a5c"], stars: true,
  },
];

/** Top of the climb, from the hand-authored ladder. */
const TOP_Y = PLATFORMS[PLATFORMS.length - 1].y;
const BAND = TOP_Y / THEMES.length;

export const themeIndexAt = (y: number) =>
  Math.max(0, Math.min(THEMES.length - 1, Math.floor(Math.max(0, y) / BAND)));

export const themeAt = (y: number) => THEMES[themeIndexAt(y)];

/**
 * How far (0..1) a height sits into the fade toward the next theme. The sky
 * cross-fades over the last stretch of a band so themes don't snap over.
 */
const FADE = 420;
export const themeBlendAt = (y: number): { from: Theme; to: Theme; t: number } => {
  const i = themeIndexAt(y);
  const from = THEMES[i];
  const to = THEMES[Math.min(THEMES.length - 1, i + 1)];
  const distToEnd = (i + 1) * BAND - Math.max(0, y);
  if (distToEnd < FADE) return { from, to, t: 1 - Math.max(0, distToEnd) / FADE };
  return { from, to: from, t: 0 };
};

export type SkinnedPlatform = Platform & {
  /** Box taken from the block art, in world units. */
  w: number;
  h: number;
  block: BlockId;
  theme: ThemeId;
};

// Deterministic pick so every student and the teacher view skin the climb
// identically without syncing anything.
//
// Placement is affinity-aware: a tree, a truck or a bookshelf belongs on the
// floor of its band, a satellite or a black hole only makes sense once you are
// well off the ground. Without this the climb reads as random objects hung in
// the sky.
const wantedAffinity = (fracIntoBand: number): Affinity =>
  fracIntoBand < 0.28 ? "ground" : fracIntoBand > 0.66 ? "air" : "any";

const pick = (
  pool: BlockId[], targetW: number, want: Affinity, salt: number, avoid: BlockId | null,
  used: Map<BlockId, number>,
): BlockId => {
  // Prefer the wanted affinity, then "any", then whatever is left — a theme
  // with no "air" blocks (school, beach) just falls through to what it has.
  // A "ground" block also reads fine as a mid-height platform (a palm you hop
  // onto is normal), so it stays eligible in the "any" band — that is what lets
  // every piece of art find a home. Only "air" pieces are kept off the floor.
  const tiers: BlockId[][] =
    want === "ground" ? [pool.filter(id => BLOCKS[id].aff === "ground"), pool]
    : want === "air" ? [
        pool.filter(id => BLOCKS[id].aff === "air"),
        pool.filter(id => BLOCKS[id].aff !== "ground"),
        pool,
      ]
    : [pool.filter(id => BLOCKS[id].aff !== "air"), pool];
  const tier = tiers.find(t => t.length) ?? pool;
  const scored = tier
    .map(id => ({ id, d: Math.abs(toWorld(BLOCKS[id].w) - targetW) }))
    .sort((a, b) => a.d - b.d);
  // Vary only between blocks of genuinely similar width — otherwise a wide
  // checkpoint platform can end up as a narrow prop and the ladder's spacing
  // stops making sense.
  const best = scored[0].d;
  const near = scored.filter(s => s.d <= best + 45 && s.id !== avoid);
  const list = near.length ? near : [scored[0]];
  // Among blocks of similar width, favour the ones used least so far — with
  // more art than platforms to put it on, this is what stops a handful of
  // blocks repeating while the rest never show up at all.
  const rarest = Math.min(...list.map(s => used.get(s.id) ?? 0));
  const fresh = list.filter(s => (used.get(s.id) ?? 0) === rarest);
  return fresh[salt % fresh.length].id;
};

export const SKINNED: SkinnedPlatform[] = (() => {
  const out: SkinnedPlatform[] = [];
  const used = new Map<BlockId, number>();
  let prev: BlockId | null = null;
  PLATFORMS.forEach((pl, i) => {
    const theme = themeAt(pl.y);
    const pool = THEME_BLOCKS[theme.id];
    const into = (Math.max(0, pl.y) - themeIndexAt(pl.y) * BAND) / BAND;
    const id = pick(pool, pl.w, wantedAffinity(into), i * 7 + 3, prev, used);
    used.set(id, (used.get(id) ?? 0) + 1);
    prev = id;
    const b = BLOCKS[id];
    const w = toWorld(b.w), h = toWorld(b.h);
    const cx = pl.x + pl.w / 2;
    out.push({ ...pl, x: cx - w / 2, w, h, block: id, theme: theme.id });
  });

  // ── Coverage pass ─────────────────────────────────────────────────────────
  // There is more art than there are platforms in some bands, so width-matching
  // alone can leave a block that never appears anywhere. Every piece of art
  // should be seen at least once, so each unused block displaces the most
  // repeated block of its own theme, at whichever platform its width fits best.
  // Swapping in a *wider* block only ever narrows a gap, and a narrower one is
  // chosen by closest width, so this cannot strand a jump.
  (Object.keys(BLOCKS) as BlockId[])
    .filter(id => !used.has(id))
    .forEach(id => {
      const theme = (Object.keys(THEME_BLOCKS) as ThemeId[]).find(t => THEME_BLOCKS[t].includes(id));
      if (!theme) return;
      const candidates = out
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => p.theme === theme && (used.get(p.block) ?? 0) > 1);
      if (!candidates.length) return;
      const mostUsed = Math.max(...candidates.map(({ p }) => used.get(p.block) ?? 0));
      const target = candidates
        .filter(({ p }) => (used.get(p.block) ?? 0) === mostUsed)
        .sort((a, b) =>
          Math.abs(toWorld(BLOCKS[id].w) - a.p.w) - Math.abs(toWorld(BLOCKS[id].w) - b.p.w))[0];
      if (!target) return;
      const old = target.p.block;
      const b = BLOCKS[id];
      const w = toWorld(b.w), h = toWorld(b.h);
      const cx = target.p.x + target.p.w / 2;
      out[target.i] = { ...target.p, x: cx - w / 2, w, h, block: id };
      used.set(old, (used.get(old) ?? 1) - 1);
      used.set(id, 1);
    });

  return out;
})();

/**
 * The grass line. It is a real, solid surface — you can walk on it and you land
 * on it after a fall, so a fall costs you the climb instead of teleporting you
 * to a checkpoint.
 */
export const GROUND_Y = SKINNED[0].y - SKINNED[0].h + 6;

/** Where a player starts, and where they end up after falling all the way. */
export const groundSpawn = (playerW: number) => ({
  x: SKINNED[0].x + SKINNED[0].w / 2 - playerW / 2,
  y: SKINNED[0].y + 4,
});
