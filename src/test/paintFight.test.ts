import { describe, it, expect } from "vitest";
import { computeArenaSize, computeCoverage, hueForJoinIndex, cellsInRadius, cellIndex } from "@/lib/paintFight";

describe("paintFight", () => {
  it("scales arena size up with more players, clamped at both ends", () => {
    const small = computeArenaSize(5);
    const big = computeArenaSize(20);
    expect(small.cols).toBeGreaterThanOrEqual(40);
    expect(big.cols).toBeGreaterThan(small.cols);
    expect(big.cols).toBeLessThanOrEqual(110);
  });

  it("assigns distinct hues by join order", () => {
    const hues = [0, 1, 2, 3, 4].map(hueForJoinIndex);
    expect(new Set(hues).size).toBe(hues.length);
    for (const h of hues) expect(h).toBeGreaterThanOrEqual(0);
  });

  it("computes coverage as last-write-wins per cell, percentages summing to 100", () => {
    const strokes = [
      { student_id: "a", hue: 10, cell_indices: [0, 1, 2] },
      { student_id: "b", hue: 20, cell_indices: [2, 3] }, // cell 2 flips from a to b
    ];
    const rows = computeCoverage(strokes, 10);
    const totalPct = rows.reduce((sum, r) => sum + r.pct, 0);
    expect(totalPct).toBeCloseTo(40, 5); // 4 of 10 cells painted
    const byStudent = Object.fromEntries(rows.map(r => [r.studentId, r.count]));
    expect(byStudent.a).toBe(2); // cells 0 and 1 stayed student a
    expect(byStudent.b).toBe(2); // cell 2 flipped to student b, plus cell 3
  });

  it("keeps two students with the same hue scored separately", () => {
    // Two different students can round to the same integer hue — coverage
    // must still attribute cells by student_id, not merge them.
    const strokes = [
      { student_id: "a", hue: 137, cell_indices: [0, 1] },
      { student_id: "b", hue: 137, cell_indices: [2] },
    ];
    const rows = computeCoverage(strokes, 10);
    expect(rows).toHaveLength(2);
    const byStudent = Object.fromEntries(rows.map(r => [r.studentId, r.count]));
    expect(byStudent.a).toBe(2);
    expect(byStudent.b).toBe(1);
  });

  it("cellsInRadius stays within grid bounds", () => {
    const cols = 5, rows = 5;
    const cells = cellsInRadius(0, 0, 40, cols, rows);
    for (const idx of cells) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(cols * rows);
    }
  });

  it("cellIndex is row-major", () => {
    expect(cellIndex(0, 0, 10)).toBe(0);
    expect(cellIndex(3, 2, 10)).toBe(23);
  });
});
