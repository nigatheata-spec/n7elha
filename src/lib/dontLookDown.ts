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

// ── Level ─────────────────────────────────────────────────────────────────
export type Platform = { x: number; y: number; w: number; checkpoint?: boolean };

/**
 * A vertical climb. Gaps widen and platforms narrow as you go up, so the
 * upgrades (double jump, feather fall, bigger tanks) are what make the
 * later sections reachable rather than raw key-mashing.
 * Checkpoints sit at the start of each difficulty band.
 */
export const PLATFORMS: Platform[] = [
  // ── Band 1: tutorial ground, short hops ──
  { x: -120, y: 0,    w: 460, checkpoint: true },
  { x: 420,  y: 90,   w: 190 },
  { x: 700,  y: 180,  w: 175 },
  { x: 430,  y: 285,  w: 165 },
  { x: 150,  y: 380,  w: 160 },
  // ── Band 2: wider gaps ──
  { x: -110, y: 480,  w: 250, checkpoint: true },
  { x: 260,  y: 585,  w: 145 },
  { x: 560,  y: 680,  w: 140 },
  { x: 850,  y: 780,  w: 135 },
  { x: 560,  y: 890,  w: 130 },
  { x: 240,  y: 985,  w: 130 },
  // ── Band 3: needs momentum or a double jump ──
  { x: -140, y: 1090, w: 230, checkpoint: true },
  { x: 230,  y: 1205, w: 120 },
  { x: 545,  y: 1310, w: 115 },
  { x: 880,  y: 1420, w: 115 },
  { x: 1200, y: 1530, w: 120 },
  { x: 880,  y: 1650, w: 110 },
  { x: 520,  y: 1760, w: 110 },
  // ── Band 4: long glides, feather fall territory ──
  { x: 140,  y: 1870, w: 220, checkpoint: true },
  { x: 520,  y: 1995, w: 105 },
  { x: 900,  y: 2110, w: 100 },
  { x: 1290, y: 2225, w: 100 },
  { x: 1680, y: 2345, w: 105 },
  { x: 1300, y: 2470, w: 100 },
  { x: 900,  y: 2590, w: 100 },
  // ── Band 5: the summit run ──
  { x: 480,  y: 2710, w: 200, checkpoint: true },
  { x: 860,  y: 2845, w: 95 },
  { x: 1250, y: 2975, w: 95 },
  { x: 1640, y: 3105, w: 95 },
  { x: 1250, y: 3240, w: 90 },
  { x: 840,  y: 3370, w: 90 },
  { x: 420,  y: 3500, w: 90 },
  // ── Summit ──
  { x: -60,  y: 3640, w: 420, checkpoint: true },
];

export const CHECKPOINTS = PLATFORMS
  .map((p, i) => ({ ...p, index: i }))
  .filter(p => p.checkpoint);

/** Y of the summit platform — reaching it wins the climb. */
export const SUMMIT_Y = PLATFORMS[PLATFORMS.length - 1].y;

export const spawnFor = (checkpointIndex: number) => {
  const p = PLATFORMS[checkpointIndex] ?? PLATFORMS[0];
  return { x: p.x + p.w / 2 - WORLD.playerW / 2, y: p.y + 4 };
};

/** Highest checkpoint at or below a given world Y, used when a player lands. */
export const checkpointIndexAt = (platformIndex: number): number | null => {
  const p = PLATFORMS[platformIndex];
  return p?.checkpoint ? platformIndex : null;
};

export const PLAYER_COLORS = ["#38bdf8", "#4ade80", "#facc15", "#fb7185", "#a78bfa", "#22d3ee", "#fb923c", "#f472b6"];
export const colorFor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return PLAYER_COLORS[Math.abs(h) % PLAYER_COLORS.length];
};
