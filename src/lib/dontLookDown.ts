import { BAND_ART, BAND_ORDER, artW, artH, type ArtId, type BandId, type Role } from "./dldArt";

// ── Don't Look Down — 2D parkour platformer ─────────────────────────────────
// World space: +X right, +Y UP (a platform at y=400 is higher than one at y=0).
// The renderer flips Y when drawing so world-up reads as screen-up.

export const WORLD = {
  gravity: -2200,        // px/s²
  moveAccel: 4200,       // px/s² while a direction key is held
  moveDecel: 5200,       // px/s² when no direction key is held
  maxRunSpeed: 430,      // px/s horizontal cap
  jumpVelocity: 900,     // px/s applied on jump
  doubleJumpVelocity: 820,
  maxFallSpeed: -1600,   // terminal velocity (negative = falling)
  playerW: 34,
  playerH: 46,
  voidY: -260,           // fall below this and you respawn at your checkpoint
};

// ── Energy ────────────────────────────────────────────────────────────────
export const ENERGY = {
  start: 100,
  moveDrainPerSec: 2,
  jumpCost: 15,
  rewardPerCorrect: 25,
};

/** Void-fall cash penalty at insurance level 1. Scaled down by the insurance tier. */
export const VOID_CASH_PENALTY_PCT = 10;

// ── Streak → multiplier (shared ladder across modes) ──────────────────────
export const streakMultiplier = (streak: number): number =>
  streak >= 8 ? 4 : streak >= 5 ? 3 : streak >= 2 ? 2 : 1;

// ── Tab 1: economy upgrades ───────────────────────────────────────────────
export const INCOME_TIERS: { level: 1 | 2 | 3 | 4 | 5; cost: number; payout: number; nameEn: string; nameAr: string }[] = [
  { level: 1, cost: 0,     payout: 1,   nameEn: "Pocket Change",  nameAr: "فكة" },
  { level: 2, cost: 10,    payout: 5,   nameEn: "Climber's Purse", nameAr: "محفظة المتسلق" },
  { level: 3, cost: 100,   payout: 20,  nameEn: "Summit Fund",    nameAr: "صندوق القمة" },
  { level: 4, cost: 1000,  payout: 100, nameEn: "Altitude Bonds", nameAr: "سندات الارتفاع" },
  { level: 5, cost: 10000, payout: 500, nameEn: "Peak Treasury",  nameAr: "خزينة القمة" },
];

export const STREAK_INSURANCE_TIERS: { level: 1 | 2 | 3 | 4; cost: number; dropBy: number | null; nameEn: string; nameAr: string }[] = [
  { level: 1, cost: 0,    dropBy: null, nameEn: "No Cover",     nameAr: "بدون حماية" },
  { level: 2, cost: 25,   dropBy: 3,    nameEn: "Frayed Rope",  nameAr: "حبل مهترئ" },
  { level: 3, cost: 250,  dropBy: 2,    nameEn: "Safety Line",  nameAr: "حبل أمان" },
  { level: 4, cost: 2500, dropBy: 1,    nameEn: "Steel Cable",  nameAr: "كابل فولاذي" },
];

export const MULTIPLIER_INSURANCE_TIERS: { level: 1 | 2 | 3 | 4; cost: number; lossPct: number; nameEn: string; nameAr: string }[] = [
  { level: 1, cost: 0,    lossPct: 50, nameEn: "Uninsured",   nameAr: "بدون تأمين" },
  { level: 2, cost: 50,   lossPct: 35, nameEn: "Basic Cover", nameAr: "تغطية أساسية" },
  { level: 3, cost: 500,  lossPct: 20, nameEn: "Solid Cover", nameAr: "تغطية قوية" },
  { level: 4, cost: 5000, lossPct: 5,  nameEn: "Full Cover",  nameAr: "تغطية كاملة" },
];

// ── Tab 2: platformer upgrades ────────────────────────────────────────────
export const ENERGY_TANK_TIERS: { level: 1 | 2 | 3 | 4; cost: number; maxEnergy: number; nameEn: string; nameAr: string }[] = [
  { level: 1, cost: 0,    maxEnergy: 100,  nameEn: "Stock Cell",    nameAr: "خلية أساسية" },
  { level: 2, cost: 150,  maxEnergy: 200,  nameEn: "Twin Tank",     nameAr: "خزان مزدوج" },
  { level: 3, cost: 1000, maxEnergy: 400,  nameEn: "Quad Tank",     nameAr: "خزان رباعي" },
  { level: 4, cost: 5000, maxEnergy: 1000, nameEn: "Reactor Core",  nameAr: "قلب المفاعل" },
];

export const BATTERY_TIERS: { level: 1 | 2 | 3; cost: number; drainMult: number; nameEn: string; nameAr: string }[] = [
  { level: 1, cost: 0,    drainMult: 1.0,  nameEn: "Standard Draw", nameAr: "استهلاك عادي" },
  { level: 2, cost: 300,  drainMult: 0.75, nameEn: "Solar Cells",   nameAr: "خلايا شمسية" },
  { level: 3, cost: 2000, drainMult: 0.40, nameEn: "Nuclear Cell",  nameAr: "خلية نووية" },
];

export const DOUBLE_JUMP_COST = 500;
export const FEATHER_FALL_COST = 400;
export const FEATHER_FALL_MS = 15_000;
export const FEATHER_FALL_GRAVITY_SCALE = 0.5;

// ── Reach ───────────────────────────────────────────────────────────────────
// Every gap in the climb is sized from these rather than from hand-picked
// numbers, so a change to gravity or jump height re-tunes the whole level
// instead of quietly stranding a player halfway up.

const G = -WORLD.gravity;

/** Peak of a standing jump, and of one spent with the second jump at its apex. */
export const JUMP_APEX = (WORLD.jumpVelocity ** 2) / (2 * G);
export const DOUBLE_APEX = JUMP_APEX + (WORLD.doubleJumpVelocity ** 2) / (2 * G);

/** How far one jump carries horizontally while ending `dy` higher. */
export const singleReach = (dy: number) => {
  const disc = WORLD.jumpVelocity ** 2 - 2 * G * dy;
  if (disc < 0) return -1;
  return (WORLD.maxRunSpeed * (WORLD.jumpVelocity + Math.sqrt(disc))) / G;
};

/** The same, spending the second jump at the apex of the first. */
export const doubleReach = (dy: number) => {
  if (dy >= DOUBLE_APEX) return -1;
  const rise = (WORLD.jumpVelocity + WORLD.doubleJumpVelocity) / G;
  return WORLD.maxRunSpeed * (rise + Math.sqrt((2 * (DOUBLE_APEX - dy)) / G));
};

// ── Level ───────────────────────────────────────────────────────────────────

export type { BandId };

export type Sprite = { id: ArtId; dx: number };

export type Platform = {
  /** Collision box, world units. `y` is the top surface you land on. */
  x: number; y: number; w: number; h: number;
  /** What to blit, left to right. A wide platform is one tile repeated. */
  sprites: Sprite[];
  stage: number;
  band: BandId;
  checkpoint?: boolean;
  /** The gap INTO this platform is past a single jump — it wants both. */
  needsDouble?: boolean;
};

export type Hint = { x: number; y: number; en: string; ar: string };

export type Climb = {
  minutes: number;
  platforms: Platform[];
  hints: Hint[];
  summitY: number;
  groundY: number;
  /** Band boundaries by height, for the sky ramp. */
  bandEdges: { band: BandId; upto: number }[];
};

/**
 * How tall a climb is for a given session length. A five minute round wants a
 * climb you can actually get up; a twenty minute one wants four times as much
 * of it, or the best players spend the back half sitting on the summit.
 */
export const climbHeightFor = (minutes: number) =>
  Math.round(Math.max(3, Math.min(40, minutes || 5)) * 700);

const rngFrom = (seed: number) => {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
};

/**
 * Build a climb.
 *
 * The shape of it is generated rather than hand-placed, because the length has
 * to follow the session timer. What is *not* left to chance is difficulty: a
 * gap is always asked for as a fraction of what the physics above actually
 * allow, so raising `frac` makes a jump tighter and can never make it
 * impossible. That fraction, and the size of the platforms, ramp with height.
 *
 * Stages are formations rather than a steady drip of ledges — a beam you settle
 * into, a shaft with no room to run, a chain of perches that punishes one bad
 * landing, a dip that sends you back down before it lets you up. Each opens on a
 * wide rest — somewhere to stand and read the next problem before committing to
 * it. A fall costs you the whole climb, so the rest is the mercy, not a respawn.
 */
export const buildClimb = (minutes: number): Climb => {
  const target = climbHeightFor(minutes);
  const rnd = rngFrom(0x5eed ^ Math.round(target));
  const out: Platform[] = [];
  const hints: Hint[] = [];
  const used = new Map<ArtId, number>();

  let stage = -1, cx = 0, y = 0, dir = 1;

  const bandAt = (h: number) =>
    BAND_ORDER[Math.max(0, Math.min(BAND_ORDER.length - 1, Math.floor((h / target) * BAND_ORDER.length)))];

  /**
   * Least-used sprite of a role, so the art spreads over the whole climb
   * instead of a handful of favourites carrying it. `narrow` asks for the
   * smallest thing the band has — a stop sign, a milk can — for the stages
   * whose whole point is landing on something barely wider than you are.
   */
  const artFor = (band: BandId, role: Role, narrow = false): ArtId => {
    const pool = BAND_ART[band][role];
    const rarest = Math.min(...pool.map(id => used.get(id) ?? 0));
    const fresh = pool.filter(id => (used.get(id) ?? 0) === rarest);
    const id = narrow
      ? fresh.reduce((a, b) => (artW(b) < artW(a) ? b : a))
      : fresh[Math.floor(rnd() * fresh.length)];
    used.set(id, (used.get(id) ?? 0) + 1);
    return id;
  };

  /** A platform of `n` copies of one sprite, side by side. */
  const build = (id: ArtId, n: number) => {
    const tw = artW(id);
    return {
      w: n * tw, h: artH(id),
      sprites: Array.from({ length: n }, (_, i) => ({ id, dx: i * tw })),
    };
  };

  /** Centre-to-centre distance for a jump of `dy`, at `frac` of what it can do. */
  const span = (dy: number, wA: number, wB: number, frac: number, double: boolean) =>
    (double ? doubleReach(dy) : singleReach(dy)) * frac + (wA + wB) / 2;

  const last = () => out[out.length - 1];

  /** Place the next platform, `dy` up and as far across as `frac` asks for. */
  const step = (
    piece: { w: number; h: number; sprites: Sprite[] },
    dy: number, frac: number, band: BandId, sign: number, double = false,
  ) => {
    const prev = last();
    const turn = cx > CORRIDOR ? -1 : cx < -CORRIDOR ? 1 : sign;
    cx += turn * span(dy, prev ? prev.w : 0, piece.w, frac, double);
    y += dy;
    out.push({ ...piece, x: cx - piece.w / 2, y, stage, band, needsDouble: double || undefined });
  };

  /** Open a stage on a wide rest: room to stand and read what is coming. */
  const rest = (dy: number, frac: number) => {
    stage++;
    const band = bandAt(y + dy);
    const piece = build(artFor(band, "tile"), 3 + Math.round(rnd() * 2));
    step(piece, dy, frac, band, dir);
    last().checkpoint = true;
    return band;
  };

  // ── The base ──────────────────────────────────────────────────────────────
  // A long flat run before anything is asked of you: somewhere to find the
  // controls, see what a jump looks like, and miss one without it costing a
  // thing. The parkour starts at the far end of it.
  stage = 0;
  {
    const band: BandId = "school";
    const id = BAND_ART[band].tile[0];
    used.set(id, 1);
    const tw = artW(id), n = 16;
    out.push({
      x: -tw * 4, y: 0, w: n * tw, h: artH(id), stage, band, checkpoint: true,
      sprites: Array.from({ length: n }, (_, i) => ({ id, dx: i * tw })),
    });
    cx = -tw * 4 + (n * tw) / 2;
    // Plain words, no arrow glyphs: the canvas draws these left-to-right in a
    // bitmap font, and a neutral arrow character reorders itself around Arabic.
    hints.push(
      { x: -tw * 3.2, y: 132, en: "HOLD LEFT OR RIGHT TO RUN", ar: "اضغط مطولا للجري" },
      { x: tw * 0.4, y: 210, en: "TAP JUMP", ar: "اضغط للقفز" },
      { x: tw * 3.6, y: 132, en: "ANSWER QUESTIONS FOR ENERGY", ar: "أجب لكسب الطاقة" },
      { x: tw * 6.6, y: 210, en: "NOW CLIMB", ar: "والان تسلق" },
    );
    cx = out[0].x + out[0].w - artW(id);
  }

  // ── Stages ────────────────────────────────────────────────────────────────
  const ARCS = ["stairs", "shaft", "dip", "pillars", "chain", "dip", "leap"] as const;
  /** How far either side of centre the climb is allowed to wander. */
  const CORRIDOR = 1100;
  let arc = 0;

  while (y < target) {
    const t = Math.min(1, y / target);
    // Tighter jumps and smaller platforms the higher you get. `frac` is a share
    // of a real jump, so 0.86 is demanding but always clearable.
    const frac = 0.44 + 0.42 * t;
    const size = (min: number, max: number) => Math.max(min, Math.round(max - (max - min) * t));

    // Dips need somewhere to fall back to, tiny perches need you to have found
    // your feet, and nothing asks for a double jump until there has been ample
    // time to have bought one.
    let kind = ARCS[arc % ARCS.length];
    const ready = (k: typeof kind) =>
      k === "dip" ? t > 0.22 : k === "chain" ? t > 0.3 : k === "leap" ? t > 0.5 : true;
    for (let i = 0; !ready(kind) && i < ARCS.length; i++) kind = ARCS[(arc + i + 1) % ARCS.length];
    arc++;

    // Alternate direction each stage, but turn back once the climb has wandered
    // far enough sideways. Left to itself it drifts thousands of units off
    // centre, which makes the tower unreadable on the teacher's board.
    dir = cx > CORRIDOR ? -1 : cx < -CORRIDOR ? 1 : -dir;
    const band = rest(105 + Math.round(rnd() * 25), Math.min(0.6, frac));

    if (kind === "stairs") {
      // A steady diagonal you can settle into — the climb's resting heartbeat.
      const id = artFor(band, "ledge");
      for (let i = 0; i < 4 + Math.round(rnd() * 2); i++)
        step(build(id, 1), 100 + Math.round(rnd() * 30), frac, band, dir);

    } else if (kind === "shaft") {
      // Two columns, close together, straight up. No room to build speed.
      const id = artFor(band, "tile");
      const piece = build(id, size(1, 2));
      const n = 6 + Math.round(rnd() * 3);
      for (let i = 0; i < n; i++) step(piece, 92 + Math.round(rnd() * 16), frac * 0.9, band, i % 2 ? -dir : dir);

    } else if (kind === "pillars") {
      // Wide, then tiny, then wide. The narrow ones are the whole stage, and
      // each is a different object, so it reads as a row of things rather than
      // one thing stamped out six times.
      const wide = artFor(band, "ledge");
      for (let i = 0; i < 5 + Math.round(rnd() * 2); i++)
        step(build(i % 2 ? artFor(band, "perch", t > 0.5) : wide, 1),
          98 + Math.round(rnd() * 24), frac, band, dir);

    } else if (kind === "chain") {
      // A run of small perches: land each one exactly, or start the stage again.
      for (let i = 0; i < 6 + Math.round(rnd() * 3); i++)
        step(build(artFor(band, "perch", t > 0.45), 1),
          84 + Math.round(rnd() * 14), frac * 0.92, band, dir);

    } else if (kind === "dip") {
      // Down before up. The climb is not a straight line, and dropping on
      // purpose — past a checkpoint you can no longer reach — is its own nerve.
      const id = artFor(band, "ledge"), tile = artFor(band, "tile");
      for (let i = 0; i < 4; i++) step(build(id, 1), -(70 + Math.round(rnd() * 30)), frac * 0.8, band, dir);
      for (let i = 0; i < 6; i++) step(build(tile, size(1, 2)), 112 + Math.round(rnd() * 22), frac, band, dir);

    } else {
      // The long ones. Above this height a jump is allowed to want both jumps —
      // by now there has been time to buy the second one.
      const id = artFor(band, "ledge");
      const double = t > 0.58;
      for (let i = 0; i < 3 + Math.round(rnd() * 1); i++)
        step(build(id, 1), 96 + Math.round(rnd() * 26), double ? 0.72 : 0.9, band, dir, double);
    }
  }

  // The summit: unmissably wide, so the last jump of the climb is not the one
  // that throws you off it.
  stage++;
  {
    const band = bandAt(y + 120);
    step(build(artFor(band, "tile"), 6), 118, 0.5, band, dir);
    last().checkpoint = true;
  }

  const summitY = last().y;
  const bandEdges = BAND_ORDER.map((band, i) => ({
    band,
    upto: i === BAND_ORDER.length - 1 ? Infinity : ((i + 1) / BAND_ORDER.length) * target,
  }));

  return { minutes, platforms: out, hints, summitY, groundY: out[0].y - out[0].h + 6, bandEdges };
};

export const checkpointsOf = (c: Climb) =>
  c.platforms.map((p, index) => ({ ...p, index })).filter(p => p.checkpoint);

export const spawnFor = (c: Climb, checkpointIndex: number) => {
  const p = c.platforms[checkpointIndex] ?? c.platforms[0];
  return { x: p.x + p.w / 2 - WORLD.playerW / 2, y: p.y + 4 };
};

export const groundSpawn = (c: Climb) => ({
  x: c.platforms[0].x + c.platforms[0].w / 2 - WORLD.playerW / 2,
  y: c.platforms[0].y + 4,
});

/** Highest checkpoint at or below a given world Y, used when a player lands. */
export const checkpointIndexAt = (c: Climb, platformIndex: number): number | null =>
  c.platforms[platformIndex]?.checkpoint ? platformIndex : null;
