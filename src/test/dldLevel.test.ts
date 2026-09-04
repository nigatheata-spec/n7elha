import { describe, it, expect } from "vitest";
import {
  buildClimb, climbHeightFor, singleReach, doubleReach, JUMP_APEX, DOUBLE_APEX,
  WORLD, type Climb,
} from "@/lib/dontLookDown";
import { BAND_ART, BAND_ORDER, artW } from "@/lib/dldArt";
import { ART } from "@/lib/dldArtManifest";

// The climb is generated, and its length follows the session timer, so it can't
// be eyeballed once and trusted. These run the real generator across the whole
// range of session lengths and check the thing that actually matters: that
// every jump it asks for is a jump the physics can make.

const DURATIONS = [3, 5, 8, 10, 15, 20, 30, 40];
const climbs = DURATIONS.map(m => [m, buildClimb(m)] as const);

/** Edge-to-edge gap into platform `i`, and the rise to get there. */
const jump = (c: Climb, i: number) => {
  const a = c.platforms[i - 1], b = c.platforms[i];
  const centre = Math.abs(b.x + b.w / 2 - (a.x + a.w / 2));
  return { dy: b.y - a.y, gap: centre - (a.w + b.w) / 2, needsDouble: !!b.needsDouble };
};

describe.each(climbs)("Don't Look Down — %i minute climb", (minutes, c) => {
  it("is as tall as the session is long", () => {
    expect(c.summitY).toBeGreaterThanOrEqual(climbHeightFor(minutes));
    expect(c.summitY).toBeLessThan(climbHeightFor(minutes) * 1.35);
  });

  it("never asks for a rise past what that jump can reach", () => {
    for (let i = 1; i < c.platforms.length; i++) {
      const { dy, needsDouble } = jump(c, i);
      expect(dy, `platform ${i}`).toBeLessThan(needsDouble ? DOUBLE_APEX : JUMP_APEX);
    }
  });

  it("never asks for a gap longer than that jump carries", () => {
    for (let i = 1; i < c.platforms.length; i++) {
      const { dy, gap, needsDouble } = jump(c, i);
      const reach = needsDouble ? doubleReach(dy) : singleReach(dy);
      expect(gap, `platform ${i} (dy ${dy})`).toBeLessThan(reach);
    }
  });

  it("keeps every jump clearable with a double jump, whatever else it asks", () => {
    for (let i = 1; i < c.platforms.length; i++) {
      const { dy, gap } = jump(c, i);
      expect(gap).toBeLessThan(doubleReach(dy));
    }
  });

  it("asks for a double jump only high enough up to have bought one", () => {
    for (const p of c.platforms) {
      if (p.needsDouble) expect(p.y).toBeGreaterThan(c.summitY * 0.5);
    }
  });

  it("opens every stage on a checkpoint", () => {
    for (const s of new Set(c.platforms.map(p => p.stage)))
      expect(c.platforms.find(p => p.stage === s)!.checkpoint, `stage ${s}`).toBe(true);
  });

  it("starts on a long flat base with the controls spelled out", () => {
    expect(c.platforms[0].w).toBeGreaterThan(WORLD.playerW * 20);
    expect(c.hints.length).toBeGreaterThan(2);
  });

  it("goes down as well as up", () => {
    const drops = c.platforms.filter((p, i) => i > 0 && p.y < c.platforms[i - 1].y);
    if (minutes >= 8) expect(drops.length).toBeGreaterThan(3);
  });

  it("builds every platform out of whole, unstretched sprites", () => {
    for (const p of c.platforms) {
      expect(p.sprites.length).toBeGreaterThan(0);
      expect(p.w).toBe(p.sprites.reduce((n, s) => n + artW(s.id), 0));
      for (const s of p.sprites) expect(ART[s.id]).toBeDefined();
    }
  });

  it("has small perches to land on, not just wide ledges", () => {
    const widths = c.platforms.map(p => p.w);
    // The shortest round is a warm-up and never unlocks the precision stages.
    if (minutes >= 5) expect(Math.min(...widths)).toBeLessThan(WORLD.playerW * 2.2);
    expect(new Set(widths).size, "a range of platform sizes").toBeGreaterThan(8);
  });

  it("stays in a readable corridor instead of wandering sideways", () => {
    const xs = c.platforms.flatMap(p => [p.x, p.x + p.w]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(4200);
  });
});

describe("art", () => {
  it("gives every band all three roles to build from", () => {
    for (const band of BAND_ORDER)
      for (const role of ["tile", "ledge", "perch"] as const)
        expect(BAND_ART[band][role].length, `${band}/${role}`).toBeGreaterThan(0);
  });

  it("uses every block that was baked, and every prop with a top to land on", () => {
    const pooled = new Set(BAND_ORDER.flatMap(b => [...BAND_ART[b].tile, ...BAND_ART[b].ledge, ...BAND_ART[b].perch]));
    const missing = (Object.keys(ART) as (keyof typeof ART)[])
      .filter(id => (ART[id].kind === "block" || ART[id].stand) && !pooled.has(id));
    expect(missing, `unused: ${missing.join(", ")}`).toEqual([]);
  });

  it("reaches every band's art over a long climb", () => {
    const seen = new Set(buildClimb(30).platforms.flatMap(p => p.sprites.map(s => s.id)));
    expect(seen.size).toBeGreaterThan(60);
  });
});
