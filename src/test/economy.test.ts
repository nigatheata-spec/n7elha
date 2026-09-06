import { describe, it, expect } from "vitest";
import * as hvz from "@/lib/humansVsZombies";
import * as lava from "@/lib/lavaFloorBlocks";
import * as dld from "@/lib/dontLookDown";

/* The three income-tier economies share a shape, so they share the invariants
   that make an upgrade ladder worth climbing: paying more must buy more. */
const ladders: [string, { level: number; cost: number; payout: number }[]][] = [
  ["humans vs zombies", hvz.INCOME_TIERS],
  ["lava floor", lava.INCOME_TIERS],
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
    ["humans vs zombies", hvz.streakMultiplier],
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
    expect(hvz.streakMultiplier(-1)).toBe(1);
    expect(dld.streakMultiplier(-5)).toBe(1);
  });
});

describe("lava floor streak tiers", () => {
  it("defaults to the free ladder", () => {
    expect(lava.streakMultiplier(8)).toBe(lava.streakMultiplier(8, 1));
  });

  it("falls back to the free ladder for an unknown tier rather than throwing", () => {
    expect(lava.streakMultiplier(8, 99)).toBe(lava.streakMultiplier(8, 1));
  });

  it("pays at least as much at every streak as the tier below", () => {
    for (let tier = 2; tier <= 4; tier++) {
      for (const streak of [0, 1, 2, 4, 5, 7, 8, 20]) {
        expect(lava.streakMultiplier(streak, tier)).toBeGreaterThanOrEqual(
          lava.streakMultiplier(streak, tier - 1),
        );
      }
    }
  });

  it("gives no streak bonus below 2 on any tier", () => {
    for (let tier = 1; tier <= 4; tier++) expect(lava.streakMultiplier(1, tier)).toBe(1);
  });
});

describe("lava floor blocks", () => {
  it("gets taller as it gets pricier, so cost always buys height", () => {
    for (let i = 1; i < lava.BLOCK_TYPES.length; i++) {
      expect(lava.BLOCK_TYPES[i].cost).toBeGreaterThan(lava.BLOCK_TYPES[i - 1].cost);
      expect(lava.BLOCK_TYPES[i].height).toBeGreaterThan(lava.BLOCK_TYPES[i - 1].height);
    }
  });

  it("makes the cheapest block the first one", () => {
    expect(lava.cheapestBlock).toBe(lava.BLOCK_TYPES[0]);
  });

  it("indexes every block by key", () => {
    for (const b of lava.BLOCK_TYPES) expect(lava.BLOCK_BY_KEY[b.key]).toBe(b);
  });

  it("has a sprite for every block", () => {
    for (const b of lava.BLOCK_TYPES) expect(lava.spriteRuns(b.key).length).toBeGreaterThan(0);
  });
});

describe("humans vs zombies protection tiers", () => {
  it("drops less streak the more you pay", () => {
    const t = hvz.STREAK_DRAIN_TIERS;
    expect(t[0].dropBy).toBeNull(); // level 1 is a full reset
    for (let i = 2; i < t.length; i++) expect(t[i].dropBy!).toBeLessThan(t[i - 1].dropBy!);
  });

  it("loses less cash the more you pay", () => {
    const t = hvz.CASH_INSURANCE_TIERS;
    for (let i = 1; i < t.length; i++) expect(t[i].lossPct).toBeLessThan(t[i - 1].lossPct);
  });

  it("names every income level for zombies too", () => {
    for (const tier of hvz.INCOME_TIERS) expect(hvz.ZOMBIE_INCOME_NAMES[tier.level]).toBeDefined();
  });

  it("gives each team the same number of battle actions", () => {
    expect(hvz.battleActionsForTeam("human")).toHaveLength(hvz.battleActionsForTeam("zombie").length);
  });
});
