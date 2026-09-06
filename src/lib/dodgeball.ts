/** Stop-the-clock timer rounds: players tap when they think 10s have passed. */
export const TIMER_TARGET_MS = 10_000;

export type TimerTap = { student_id: string; elapsed_ms: number };

/** Closest tap to the target wins. Earlier taps break ties, matching the
    `order("elapsed_ms")` the taps are read back in. */
export const pickTimerWinner = (taps: TimerTap[]): string | null => {
  if (taps.length === 0) return null;
  const best = taps.reduce((prev, cur) =>
    Math.abs(cur.elapsed_ms - TIMER_TARGET_MS) < Math.abs(prev.elapsed_ms - TIMER_TARGET_MS) ? cur : prev);
  return best.student_id;
};
