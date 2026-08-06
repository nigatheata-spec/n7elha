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
