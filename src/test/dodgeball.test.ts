import { describe, it, expect } from "vitest";
import { pickTimerWinner, TIMER_TARGET_MS } from "@/lib/dodgeball";

describe("pickTimerWinner", () => {
  it("returns nobody when no one tapped", () => {
    expect(pickTimerWinner([])).toBeNull();
  });

  it("picks the tap closest to the target", () => {
    const winner = pickTimerWinner([
      { student_id: "early", elapsed_ms: 8_500 },
      { student_id: "closest", elapsed_ms: 9_950 },
      { student_id: "late", elapsed_ms: 12_000 },
    ]);
    expect(winner).toBe("closest");
  });

  it("does not favour undershooting over overshooting", () => {
    const winner = pickTimerWinner([
      { student_id: "under_by_300", elapsed_ms: TIMER_TARGET_MS - 300 },
      { student_id: "over_by_100", elapsed_ms: TIMER_TARGET_MS + 100 },
    ]);
    expect(winner).toBe("over_by_100");
  });

  it("awards an exact tap", () => {
    const winner = pickTimerWinner([
      { student_id: "exact", elapsed_ms: TIMER_TARGET_MS },
      { student_id: "near", elapsed_ms: TIMER_TARGET_MS - 1 },
    ]);
    expect(winner).toBe("exact");
  });

  it("breaks an equidistant tie toward the earlier tap", () => {
    const winner = pickTimerWinner([
      { student_id: "under", elapsed_ms: TIMER_TARGET_MS - 500 },
      { student_id: "over", elapsed_ms: TIMER_TARGET_MS + 500 },
    ]);
    expect(winner).toBe("under");
  });

  it("handles a single tap", () => {
    expect(pickTimerWinner([{ student_id: "only", elapsed_ms: 30_000 }])).toBe("only");
  });
});
