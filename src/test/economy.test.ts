import { describe, it, expect } from "vitest";
import * as dld from "@/lib/dontLookDown";

/* The income-tier economy's invariants: paying more must buy more. */
const ladders: [string, { level: number; cost: number; payout: number }[]][] = [
  ["don't look down", dld.INCOME_TIERS],
];

describe.each(ladders)("%s income tiers", (_name, tiers) => {
  it("starts free", () => {
    expect(tiers[0].cost).toBe(0);
  });

  it("numbers levels consecutively from 1", () => {
    expect(tiers.map(t => t.level)).toEqual(tiers.map((_, i) => i + 1));
  });

  it("costs strictly more at every step", () => {
    for (let i = 1; i < tiers.length; i++) expect(tiers[i].cost).toBeGreaterThan(tiers[i - 1].cost);
  });

  it("pays out strictly more at every step, so no tier is a trap", () => {
    for (let i = 1; i < tiers.length; i++) expect(tiers[i].payout).toBeGreaterThan(tiers[i - 1].payout);
  });

  it("pays back its own cost within a reasonable number of answers", () => {
    for (let i = 1; i < tiers.length; i++) {
      const gain = tiers[i].payout - tiers[i - 1].payout;
      expect(tiers[i].cost / gain).toBeLessThanOrEqual(100);
    }
  });
});

describe("streak multipliers", () => {
  it.each([
    ["don't look down", dld.streakMultiplier],
  ])("%s steps at 2, 5 and 8", (_name, fn) => {
    expect(fn(0)).toBe(1);
    expect(fn(1)).toBe(1);
    expect(fn(2)).toBe(2);
    expect(fn(4)).toBe(2);
    expect(fn(5)).toBe(3);
    expect(fn(7)).toBe(3);
    expect(fn(8)).toBe(4);
    expect(fn(50)).toBe(4);
  });

  it("never rewards a negative streak", () => {
    expect(dld.streakMultiplier(-5)).toBe(1);
  });
});
