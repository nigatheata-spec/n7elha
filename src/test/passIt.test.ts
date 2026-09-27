import { describe, it, expect } from "vitest";
import {
  bombCountFor, initBombs, applyPass, resolveBlasts, topUpBombs, pickTargets, extendFuses,
  FUSE_MIN_MS, FUSE_MAX_MS, type Bomb,
} from "@/lib/passIt";

const seeded = (s = 1) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
const P = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);
const at = (ms: number) => new Date(ms).toISOString();

describe("Pass It rules", () => {
  it("scales bombs with the class and always leaves someone to pass to", () => {
    expect(bombCountFor(1)).toBe(1);
    expect(bombCountFor(2)).toBe(1);
    expect(bombCountFor(5)).toBe(1);
    expect(bombCountFor(6)).toBe(2);
    expect(bombCountFor(25)).toBe(5);
    expect(bombCountFor(100)).toBe(6);
  });

  it("hands the first bombs to different players with fuses in range", () => {
    const now = 1_000_000;
    const bombs = initBombs(P(12), now, seeded());
    expect(bombs).toHaveLength(3);
    expect(new Set(bombs.map(b => b.holderId)).size).toBe(3);
    for (const b of bombs) {
      const t = new Date(b.explodesAt).getTime() - now;
      expect(t).toBeGreaterThanOrEqual(FUSE_MIN_MS);
      expect(t).toBeLessThanOrEqual(FUSE_MAX_MS);
    }
  });

  it("never offers a pass to someone already holding a bomb", () => {
    const bombs: Bomb[] = [
      { id: "a", holderId: "p0", explodesAt: at(9e12), fromId: null },
      { id: "b", holderId: "p1", explodesAt: at(9e12), fromId: null },
    ];
    for (let s = 1; s < 30; s++) {
      const t = pickTargets(P(6), bombs, "p0", seeded(s));
      expect(t).toHaveLength(3);
      expect(t).not.toContain("p0");
      expect(t).not.toContain("p1");
    }
  });

  it("applies a pass, rejects a stale one, and reroutes a taken target", () => {
    const bombs: Bomb[] = [
      { id: "a", holderId: "p0", explodesAt: at(9e12), fromId: null },
      { id: "b", holderId: "p1", explodesAt: at(9e12), fromId: null },
    ];
    const ok = applyPass(bombs, P(4), { bombId: "a", from: "p0", to: "p2" }, seeded())!;
    expect(ok.to).toBe("p2");
    expect(ok.bombs.find(b => b.id === "a")).toMatchObject({ holderId: "p2", fromId: "p0" });
    expect(applyPass(ok.bombs, P(4), { bombId: "a", from: "p0", to: "p3" }, seeded())).toBeNull();
    const rerouted = applyPass(bombs, P(4), { bombId: "a", from: "p0", to: "p1" }, seeded())!;
    expect(["p2", "p3"]).toContain(rerouted.to);
  });

  it("blows up expired bombs, moves them on, and moves bombs off players who left", () => {
    const now = 5_000_000;
    const bombs: Bomb[] = [
      { id: "a", holderId: "p0", explodesAt: at(now - 1), fromId: "p3" },
      { id: "b", holderId: "gone", explodesAt: at(now + 10_000), fromId: null },
      { id: "c", holderId: "p1", explodesAt: at(now + 10_000), fromId: null },
    ];
    const r = resolveBlasts(bombs, P(6), now, seeded());
    expect(r.blasts.map(b => b.victim)).toEqual(["p0"]);
    expect(r.moved).toHaveLength(1);
    const holders = r.bombs.map(b => b.holderId);
    expect(new Set(holders).size).toBe(3);
    expect(holders).not.toContain("p0");
    expect(holders).not.toContain("gone");
    expect(r.bombs.find(b => b.id === "c")!.holderId).toBe("p1");
  });

  it("adds bombs as players join, and extends fuses by the pause", () => {
    const bombs = initBombs(P(4), 0, seeded());
    expect(topUpBombs(bombs, P(12), 0, seeded())).toHaveLength(3);
    const later = extendFuses(bombs, 10_000);
    expect(new Date(later[0].explodesAt).getTime() - new Date(bombs[0].explodesAt).getTime()).toBe(10_000);
  });
});
