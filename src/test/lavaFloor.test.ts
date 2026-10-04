import { describe, it, expect } from "vitest";
import {
  towerHeight, partialCourse, climbNeed, paceRate, lavaNow, towerName,
  MIN_RATE, MAX_RATE, PACE,
} from "@/lib/lavaFloor";
import { layoutTowers, type BoardTower } from "@/lib/lavaFloorRender";

const tower = (width: number, bricks: number, base = 3) => ({ width, bricks, base });

describe("tower height", () => {
  it("counts only finished courses", () => {
    expect(towerHeight(tower(1, 4))).toBe(7);
    expect(towerHeight(tower(5, 9))).toBe(4);   // one full course of 5, four bricks into the next
    expect(partialCourse(tower(5, 9))).toBe(4);
  });

  it("climbs at the same pace per student whatever the tower's width", () => {
    // each of n students lays k bricks: a solo pillar and an n-wide wall both rise k
    for (const n of [1, 4, 30]) expect(towerHeight(tower(n, n * 6))).toBe(3 + 6);
  });

  it("never divides by a zero width", () => {
    expect(towerHeight(tower(0, 3))).toBe(6);
  });
});

describe("climbing out", () => {
  it("asks two answers of one student and one of each member of a group", () => {
    expect(climbNeed(1)).toBe(2);
    expect(climbNeed(6)).toBe(6);
  });
});

describe("lava pace", () => {
  it("follows the typical tower, not the leader", () => {
    expect(paceRate([0.1, 0.1, 0.1, 5])).toBeCloseTo(0.1 * PACE);
  });

  it("never stands still and never runs away", () => {
    expect(paceRate([])).toBe(MIN_RATE);
    expect(paceRate([0, 0])).toBe(MIN_RATE);
    expect(paceRate([10, 10])).toBe(MAX_RATE);
  });

  it("carries on from the last snapshot", () => {
    const at = new Date(1_000_000).toISOString();
    expect(lavaNow({ level: 2, at, rate: 0.5 }, 1_000_000 + 4000)).toBeCloseTo(4);
    expect(lavaNow({ level: 2, at, rate: 0.5 }, 1_000_000 - 4000)).toBe(2);
  });
});

describe("tower names", () => {
  it("names teams by color and the class as one", () => {
    expect(towerName("teams", { idx: 1, name: null }, false)).toBe("Blue team");
    expect(towerName("class", { idx: 0, name: null }, false)).toBe("The class");
    expect(towerName("solo", { idx: 3, name: "Sara" }, false)).toBe("Sara");
  });
});

describe("board layout", () => {
  const board = (widths: number[]): BoardTower[] => widths.map((width, i) => ({
    id: String(i), width, courses: 3, partial: 0, color: "#000", dunked: false, climb: 0, need: 2, members: [],
  }));

  it("keeps every tower on screen and in order", () => {
    for (const widths of [[1, 1, 1, 1], [8, 7, 7], [30]]) {
      const { pos } = layoutTowers(board(widths), 1440, 70);
      pos.forEach((p, i) => {
        expect(p.x0).toBeGreaterThanOrEqual(0);
        expect(p.x1).toBeLessThanOrEqual(1440);
        if (i) expect(p.x0).toBeGreaterThan(pos[i - 1].x1);
      });
    }
  });

  it("centers a phone on the player's own slot when the wall is wider than the screen", () => {
    const { pos } = layoutTowers(board([30]), 375, 16, 46, { tower: 0, slot: 15 });
    expect(Math.abs(pos[0].slotX(15) - 375 / 2)).toBeLessThan(46);
  });
});
