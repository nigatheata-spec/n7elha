export type BlockKey = "plank" | "brick" | "staircase" | "house";

export const BLOCK_TYPES: {
  key: BlockKey;
  cost: number;
  height: number;
  labelEn: string;
  labelAr: string;
}[] = [
  { key: "plank",     cost: 5,    height: 1,    labelEn: "Plank",     labelAr: "لوح خشبي" },
  { key: "brick",     cost: 50,   height: 12,   labelEn: "Brick",     labelAr: "طوبة" },
  { key: "staircase", cost: 500,  height: 130,  labelEn: "Staircase", labelAr: "سلّم" },
  { key: "house",     cost: 5000, height: 1400, labelEn: "House",     labelAr: "منزل" },
];

export const BLOCK_BY_KEY: Record<BlockKey, (typeof BLOCK_TYPES)[number]> =
  Object.fromEntries(BLOCK_TYPES.map(b => [b.key, b])) as any;

// ── Block sprites — the real platforms that stack above the lava ────────────
// Purchased blocks are drawn, not described: every buy adds one of these
// pixel-art platforms to the tower on both the projector and the phone.
// Every sprite is 16 cells wide so the stack lines up into one column; only
// the row count differs per type.
//
// Row counts are NOT linear in `height` — that value spans 1 → 1400, so a
// literal mapping would make a plank invisible and a house taller than any
// screen. They follow the same rank order on a rough log scale instead:
// thin plank → chunky brick → stepped staircase → tall house.
export type BlockSprite = {
  cols: number;
  rows: number;
  pattern: string[];            // top row first; "." is transparent
  palette: Record<string, string>;
};

// b = body, d = shadow, l = highlight, m = mortar, r = roof, k = eave,
// w = window, n = door
export const BLOCK_SPRITES: Record<BlockKey, BlockSprite> = {
  plank: {
    cols: 16, rows: 3,
    pattern: [
      "llllllllllllllll",
      "bbdbbbbbbdbbbbbb",
      "dddddddddddddddd",
    ],
    palette: { b: "#a9743c", d: "#7a4f24", l: "#c99a5f" },
  },
  brick: {
    cols: 16, rows: 6,
    pattern: [
      "llllllllllllllll",
      "bbbbbmbbbbbmbbbb",
      "bbbbbmbbbbbmbbbb",
      "mmmmmmmmmmmmmmmm",
      "bbmbbbbbmbbbbbmb",
      "ddmdddddmdddddmd",
    ],
    palette: { b: "#b0483a", d: "#7e2f26", l: "#d3705d", m: "#cbbba6" },
  },
  staircase: {
    cols: 16, rows: 10,
    pattern: [
      "................",
      "................",
      "............llll",
      "............bbbb",
      "........llllbbbb",
      "........bbbbbbbb",
      "....llllbbbbbbbb",
      "....bbbbbbbbbbbb",
      "llllbbbbbbbbbbbb",
      "dddddddddddddddd",
    ],
    palette: { b: "#8b8f9a", d: "#5f636e", l: "#b3b8c4" },
  },
  house: {
    cols: 16, rows: 18,
    pattern: [
      ".......rr.......",
      "......rrrr......",
      ".....rrrrrr.....",
      "....rrrrrrrr....",
      "...rrrrrrrrrr...",
      "..rrrrrrrrrrrr..",
      ".rrrrrrrrrrrrrr.",
      "rrrrrrrrrrrrrrrr",
      "kkkkkkkkkkkkkkkk",
      "lbbbbbbbbbbbbbbd",
      "lbbwwbbbbbbwwbbd",
      "lbbwwbbbbbbwwbbd",
      "lbbbbbbbbbbbbbbd",
      "lbbbbbnnnbbbbbbd",
      "lbbbbbnnnbbbbbbd",
      "lbbbbbnnnbbbbbbd",
      "lbbbbbnnnbbbbbbd",
      "dddddddddddddddd",
    ],
    palette: {
      b: "#c2a06a", d: "#8a6c3f", l: "#dcc191",
      r: "#9c3b34", k: "#5f2a25", w: "#6fc2d8", n: "#5b3a20",
    },
  },
};

export type SpriteRun = { x: number; y: number; w: number; color: string };

const RUN_CACHE = new Map<BlockKey, SpriteRun[]>();

/**
 * Flatten a sprite's grid into horizontal runs of same-colored cells.
 * One <div> per cell would be ~250 nodes for a house and the tower holds
 * dozens of blocks; merging runs cuts that by roughly an order of magnitude.
 * Cached because the patterns are static.
 */
export const spriteRuns = (key: BlockKey): SpriteRun[] => {
  const cached = RUN_CACHE.get(key);
  if (cached) return cached;
  const s = BLOCK_SPRITES[key];
  const runs: SpriteRun[] = [];
  s.pattern.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let w = 1;
      while (x + w < row.length && row[x + w] === ch) w++;
      if (ch !== ".") runs.push({ x, y, w, color: s.palette[ch] });
      x += w;
    }
  });
  RUN_CACHE.set(key, runs);
  return runs;
};

export const cheapestBlock = BLOCK_TYPES[0];

export const INCOME_TIERS: {
  level: 1 | 2 | 3 | 4;
  cost: number;
  payout: number;
  nameEn: string;
  nameAr: string;
}[] = [
  { level: 1, cost: 0,    payout: 1,   nameEn: "Bare Hands",       nameAr: "بدون أداة" },
  { level: 2, cost: 10,   payout: 5,   nameEn: "Wooden Hammer",    nameAr: "مطرقة خشبية" },
  { level: 3, cost: 100,  payout: 20,  nameEn: "Iron Scaffold",    nameAr: "سقالة حديدية" },
  { level: 4, cost: 1000, payout: 100, nameEn: "Industrial Crane", nameAr: "رافعة صناعية" },
];

/**
 * Purchasable streak upgrades. Each tier keeps the same streak thresholds
 * (2 / 5 / 8) but pays out a steeper multiplier ladder, so a hot streak is
 * worth buying into rather than just lucking into.
 */
export const STREAK_TIERS: {
  level: 1 | 2 | 3 | 4;
  cost: number;
  ladder: [number, number, number, number]; // multiplier at streak 0-1, 2-4, 5-7, 8+
  nameEn: string;
  nameAr: string;
}[] = [
  { level: 1, cost: 0,    ladder: [1, 2, 3, 5],   nameEn: "Steady Hands", nameAr: "يد ثابتة" },
  { level: 2, cost: 50,   ladder: [1, 3, 4, 7],   nameEn: "Lucky Charm",  nameAr: "تعويذة الحظ" },
  { level: 3, cost: 500,  ladder: [1, 4, 6, 10],  nameEn: "Fire Gloves",  nameAr: "قفازات النار" },
  { level: 4, cost: 2500, ladder: [1, 5, 8, 15],  nameEn: "Inferno Focus", nameAr: "تركيز الجحيم" },
];

const ladderFor = (streakTier: number): [number, number, number, number] =>
  (STREAK_TIERS.find(t => t.level === streakTier) ?? STREAK_TIERS[0]).ladder;

export const streakMultiplier = (streak: number, streakTier = 1): number => {
  const [l0, l2, l5, l8] = ladderFor(streakTier);
  return streak >= 8 ? l8 : streak >= 5 ? l5 : streak >= 2 ? l2 : l0;
};
