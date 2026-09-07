import { describe, it, expect } from "vitest";
import {
  computeArenaSize, computeCoverage, hueForJoinIndex, cellsUnderDisc, cellIndex,
  captureFill, cellsAlongSegment, spawnBlock, replayStrokes, cellsOf, coverageOf,
  emptyTerritory, claimCells, wipePlayer, Trail, cellOfXY, CELL, SPAWN_HALF, TRAIL_GRACE, type Stroke,
} from "@/lib/paintFight";
import { territoryPath } from "@/lib/paintFightRender";

const setOf = (...idx: number[]) => new Set(idx);
const rect = (x0: number, y0: number, x1: number, y1: number, cols: number) => {
  const out: number[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push(y * cols + x);
  return out;
};

describe("paintFight arena", () => {
  it("scales arena size up with more players, clamped at both ends", () => {
    const small = computeArenaSize(5);
    const big = computeArenaSize(20);
    expect(small.cols).toBeGreaterThanOrEqual(60);
    expect(big.cols).toBeGreaterThan(small.cols);
    expect(big.cols).toBeLessThanOrEqual(170);
  });

  it("assigns distinct hues by join order", () => {
    const hues = [0, 1, 2, 3, 4].map(hueForJoinIndex);
    expect(new Set(hues).size).toBe(hues.length);
    for (const h of hues) expect(h).toBeGreaterThanOrEqual(0);
  });

  it("cellIndex is row-major", () => {
    expect(cellIndex(0, 0, 10)).toBe(0);
    expect(cellIndex(3, 2, 10)).toBe(23);
  });

  it("cellsUnderDisc stays within grid bounds", () => {
    for (const idx of cellsUnderDisc(0, 0, 40, 5, 5)) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(25);
    }
  });

  it("cellsUnderDisc always includes the cell the point is standing in", () => {
    // A cell corner is 7.1px from every surrounding centre; at the trail's 4.5px
    // radius a centre-distance test would return nothing at all there.
    const cols = 10, rows = 10;
    for (const [x, y] of [[50, 50], [50.001, 49.999], [3, 3], [99.9, 99.9]]) {
      const cells = cellsUnderDisc(x, y, 4.5, cols, rows);
      expect(cells).toContain(cellOfXY(x, y, cols, rows).index);
    }
  });

  it("gives a fresh spawn a square home block, clipped at the arena edge", () => {
    const full = spawnBlock(10, 10, 40, 40);
    expect(full).toHaveLength((SPAWN_HALF * 2 + 1) ** 2);
    const corner = spawnBlock(0, 0, 40, 40);
    expect(corner).toHaveLength((SPAWN_HALF + 1) ** 2);
    for (const idx of corner) expect(idx).toBeGreaterThanOrEqual(0);
  });

  it("sweeps every cell a move passes through, with no gaps", () => {
    // A long move must not skip cells: a skipped cell is a hole in the trail
    // that an opponent could drive straight through without cutting anybody.
    const cols = 40, rows = 40;
    const cells = cellsAlongSegment(5, 5, 5 + CELL * 6, 5, cols, rows);
    const xs = cells.map(i => i % cols).sort((a, b) => a - b);
    for (let x = xs[0]; x <= xs[xs.length - 1]; x++) expect(xs).toContain(x);
  });
});

describe("paintFight trail", () => {
  const cols = 60, rows = 60;
  const run = (t: Trail, pts: [number, number][]) => {
    let cut = false;
    for (let i = 1; i < pts.length; i++) {
      // Step in small hops, the way the physics loop does — the whole point of
      // the grace rule is that it survives being fed overlapping sweeps.
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 2.2));
      for (let k = 1; k <= n && !cut; k++) {
        const t0 = (k - 1) / n, t1 = k / n;
        cut = t.extend(ax + (bx - ax) * t0, ay + (by - ay) * t0, ax + (bx - ax) * t1, ay + (by - ay) * t1, cols, rows);
      }
      if (cut) break;
    }
    return cut;
  };

  it("does not cut you off on the ground you are standing on", () => {
    // The trail is wider than a cell, so every step re-sweeps cells the step
    // before it laid. Without a grace length that reads as crossing your own
    // trail and you die a second after leaving home, every time.
    const t = new Trail();
    expect(run(t, [[100, 100], [100, 400]])).toBe(false);
    expect(t.size).toBeGreaterThan(20);
  });

  it("cuts you off when you turn back onto your own trail", () => {
    const t = new Trail();
    expect(run(t, [[100, 100], [300, 100], [300, 160], [150, 160], [150, 90]])).toBe(true);
  });

  it("keeps the polyline and the cells in step, and drops both on clear", () => {
    const t = new Trail();
    run(t, [[100, 100], [100, 300]]);
    expect(t.points.length).toBeGreaterThan(1);
    expect(t.pending.length).toBe(t.points.length);
    expect(t.covers(100, 200, cols, rows)).toBe(true);
    t.clear();
    expect(t.size).toBe(0);
    expect(t.points).toHaveLength(0);
    expect(t.travelled).toBe(0);
  });

  it("gives less rope than a hairpin needs but more than the trail is wide", () => {
    expect(TRAIL_GRACE).toBeGreaterThan(CELL);
    expect(TRAIL_GRACE).toBeLessThan(66);   // the turn circle a U-turn comes back on
  });
});

describe("paintFight capture", () => {
  const cols = 20, rows = 20;

  it("claims the cells a loop encloses, plus the loop itself", () => {
    // A hollow 5x5 ring: the 3x3 inside it has to fall in.
    const ring: number[] = [];
    for (let x = 4; x <= 8; x++) { ring.push(4 * cols + x); ring.push(8 * cols + x); }
    for (let y = 5; y <= 7; y++) { ring.push(y * cols + 4); ring.push(y * cols + 8); }
    const gained = captureFill(new Set(), ring, cols, rows);
    expect(gained).toEqual(expect.arrayContaining(ring));
    for (let y = 5; y <= 7; y++) for (let x = 5; x <= 7; x++) expect(gained).toContain(y * cols + x);
    expect(gained).toHaveLength(25);
  });

  it("takes cells that belonged to someone else — enclosing is stealing", () => {
    const ring: number[] = [];
    for (let x = 4; x <= 8; x++) { ring.push(4 * cols + x); ring.push(8 * cols + x); }
    for (let y = 5; y <= 7; y++) { ring.push(y * cols + 4); ring.push(y * cols + 8); }
    const gained = captureFill(new Set(), ring, cols, rows);
    expect(gained).toContain(6 * cols + 6);   // dead centre, whoever held it
  });

  it("counts a bay sealed against the arena wall as enclosed", () => {
    // The wall is a wall: a trail that runs from edge to edge closes the region
    // behind it just as surely as a full loop does.
    const trail = [...rect(0, 0, 3, 0, cols), ...rect(3, 0, 3, 3, cols), ...rect(0, 3, 3, 3, cols)];
    const gained = captureFill(new Set(), trail, cols, rows);
    expect(gained).toContain(1 * cols + 1);
    expect(gained).not.toContain(5 * cols + 5);
  });

  it("claims nothing when the trail never closes", () => {
    const openLine = rect(4, 4, 10, 4, cols);
    const gained = captureFill(new Set(), openLine, cols, rows);
    expect(gained.sort()).toEqual(openLine.sort());  // the line, and nothing else
  });

  it("closes a loop against territory already held, not only against itself", () => {
    // The normal case in play: you leave a solid block, arc away and come back
    // to it. The arc plus the block seal a region neither would alone.
    const home = new Set(rect(4, 4, 4, 8, cols));           // a vertical wall of held ground
    const arc = [...rect(4, 4, 8, 4, cols), ...rect(8, 4, 8, 8, cols), ...rect(4, 8, 8, 8, cols)];
    const gained = captureFill(home, arc, cols, rows);
    expect(gained).toContain(6 * cols + 6);
    for (const idx of home) expect(gained).not.toContain(idx);  // already ours, not re-sent
  });
});

describe("paintFight board", () => {
  const cols = 10, rows = 10, total = 100;

  it("replays the log last-write-wins per cell", () => {
    const strokes: Stroke[] = [
      { student_id: "a", hue: 10, cell_indices: [0, 1, 2] },
      { student_id: "b", hue: 20, cell_indices: [2, 3] },   // cell 2 flips to b
    ];
    const rowsOut = computeCoverage(strokes, total);
    expect(rowsOut.reduce((s, r) => s + r.pct, 0)).toBeCloseTo(4, 5);
    const byStudent = Object.fromEntries(rowsOut.map(r => [r.studentId, r.count]));
    expect(byStudent.a).toBe(2);
    expect(byStudent.b).toBe(2);
  });

  it("a wipe erases exactly one player's ground and nobody else's", () => {
    const strokes: Stroke[] = [
      { student_id: "a", hue: 10, cell_indices: [0, 1, 2] },
      { student_id: "b", hue: 20, cell_indices: [5, 6] },
      { student_id: "a", hue: 10, cell_indices: [], op: "wipe" },
    ];
    const board = replayStrokes(strokes, total);
    expect(cellsOf(board, "a").size).toBe(0);
    expect(cellsOf(board, "b").size).toBe(2);
    expect(board.owner.has(0)).toBe(false);
    expect(coverageOf(board, total).map(r => r.studentId)).toEqual(["b"]);
  });

  it("lets a wiped player claim again — death is not elimination", () => {
    const strokes: Stroke[] = [
      { student_id: "a", hue: 10, cell_indices: [0, 1] },
      { student_id: "a", hue: 10, cell_indices: [], op: "wipe" },
      { student_id: "a", hue: 10, cell_indices: [7, 8, 9] },
    ];
    const board = replayStrokes(strokes, total);
    expect(cellsOf(board, "a").size).toBe(3);
    expect(board.owner.has(0)).toBe(false);
  });

  it("keeps owner and byPlayer in step when ground changes hands", () => {
    const t = emptyTerritory();
    claimCells(t, "a", 10, [0, 1, 2], total);
    claimCells(t, "b", 20, [2], total);
    expect(cellsOf(t, "a").has(2)).toBe(false);
    expect(t.owner.get(2)?.studentId).toBe("b");
    // the two structures must agree cell for cell, always
    for (const [id, cells] of t.byPlayer) for (const idx of cells) expect(t.owner.get(idx)?.studentId).toBe(id);
    wipePlayer(t, "a");
    expect(t.owner.size).toBe(1);
  });

  it("keeps two students with the same hue scored separately", () => {
    // Golden-angle hues are a low-discrepancy spread, not a collision-free one,
    // so identity has to key off student_id.
    const rowsOut = computeCoverage([
      { student_id: "a", hue: 137, cell_indices: [0, 1] },
      { student_id: "b", hue: 137, cell_indices: [2] },
    ], total);
    expect(rowsOut).toHaveLength(2);
    expect(Object.fromEntries(rowsOut.map(r => [r.studentId, r.count]))).toEqual({ a: 2, b: 1 });
  });
});

describe("paintFight rendering", () => {
  it("collapses a block of cells into one rectangle per row, never across rows", () => {
    // territoryPath is what keeps the draw cheap; the bug it has to not have is
    // treating cell 9 and cell 10 of a 10-wide grid as adjacent, which would
    // stretch a rectangle across the whole arena.
    const calls: number[][] = [];
    const spy = { rect: (...a: number[]) => calls.push(a) } as unknown as Path2D;
    const g = globalThis as unknown as { Path2D: unknown };
    const OriginalPath = g.Path2D;
    g.Path2D = function () { return spy; };
    try {
      territoryPath(setOf(9, 10, 11), 10);
    } finally {
      g.Path2D = OriginalPath;
    }
    expect(calls).toHaveLength(2);                       // row 0 alone, then row 1
    expect(calls[0]).toEqual([9 * CELL, 0, CELL, CELL]);
    expect(calls[1]).toEqual([0, CELL, 2 * CELL, CELL]);
  });
});
