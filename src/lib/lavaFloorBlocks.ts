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
