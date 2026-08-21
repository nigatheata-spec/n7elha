// ── Paint Fight — grid territory painting ───────────────────────────────────
//
// SYNC DESIGN (unchanged in spirit from the original, simplified in practice)
// ---------------------------------------------------------------------------
// The arena is a fixed grid of cells (`arenaCols` x `arenaRows`, frozen into
// game_sessions.settings at Start so every client agrees). A player claims
// whatever cells their brush footprint covers as they move.
//
// The ONLY thing that crosses the network as durable state is a batch of
// claimed CELL INDICES, appended to `paint_fight_strokes`. Never raw pixels,
// never per-cell rows:
//   * raw pixels would be kilobytes per tick per phone — hopeless for ~20
//     concurrently painting students on classroom wifi;
//   * one row per cell would be hundreds of INSERTs per second;
//   * an index batch every ~250ms is a few hundred bytes and compresses the
//     whole tick into one row.
// Every client replays the log in `created_at` order with last-write-wins per
// cell, so late joiners and reconnects rebuild the exact same board just by
// reading the table from the beginning. Scores are derived from that same
// replay (`computeCoverage`), which is why the monitor, the student HUD and
// the results page can never disagree.
//
// RENDERING (see paintFightRender.ts) draws straight from cell ownership — one
// pixel per cell on a tiny offscreen layer, upscaled with smoothing off. The
// picture is therefore a literal image of the score. The old implementation
// kept a *second*, independent "smooth brush trail" bitmap alongside the cell
// log and tried to decide per event which of the two should draw; the two
// drifted constantly and that was the visible glitching. There is now exactly
// one representation of paint.
//
// Live player POSITIONS still go over a realtime broadcast channel, but they
// are cosmetic only (where to draw the other players' rollers). No paint, no
// score, nothing durable depends on a broadcast arriving.

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Logical world px per grid cell. */
export const CELL = 16;

export const PAINT = {
  start: 100,
  drainPerSec: 6,
  rewardPerCorrect: 30,
};

/** World px/s at full joystick deflection. */
export const PLAYER_SPEED = 150;

/** Brush footprint radius in world px. The roller marker's on-screen size is
 *  derived from this (`rollerIconSize`), so the icon always matches the paint. */
export const PLAYER_RADIUS = 20;

/** Fixed student-camera zoom: screen px per world px. A phone therefore shows a
 *  local window of the arena (paper.io style) rather than the whole map
 *  squeezed down to nothing. */
export const PIXELS_PER_WORLD_UNIT = 1.4;

/** How often a client appends its newly-claimed cells to the log. */
export const FLUSH_INTERVAL_MS = 250;

/** How often a client broadcasts its cosmetic position. */
export const BROADCAST_INTERVAL_MS = 80;

/** A peer whose position hasn't been heard in this long stops being drawn. */
export const PEER_TIMEOUT_MS = 5000;

/**
 * Arena grid, frozen at Start from the confirmed roster: big enough that a
 * camera-followed player has room to roam, scaled up for bigger classes so 20
 * players aren't painting on top of each other.
 */
export const computeArenaSize = (playerCount: number) => {
  const n = Math.max(1, playerCount);
  const cols = Math.round(clamp(34 * Math.sqrt(n / 6), 40, 110));
  const rows = Math.round(cols * 1.5); // portrait-ish, matches phone screens
  return { cols, rows };
};

export const cellIndex = (cx: number, cy: number, cols: number) => cy * cols + cx;

export const cellOfXY = (x: number, y: number, cols: number, rows: number) => {
  const cx = clamp(Math.floor(x / CELL), 0, cols - 1);
  const cy = clamp(Math.floor(y / CELL), 0, rows - 1);
  return { cx, cy, index: cellIndex(cx, cy, cols) };
};

export const xyOfCell = (index: number, cols: number) => {
  const cx = index % cols, cy = Math.floor(index / cols);
  return { x: cx * CELL + CELL / 2, y: cy * CELL + CELL / 2 };
};

/** Cells whose center is within `radius` world px of (x,y) — the brush footprint. */
export const cellsInRadius = (x: number, y: number, radius: number, cols: number, rows: number): number[] => {
  const out: number[] = [];
  const minCx = clamp(Math.floor((x - radius) / CELL), 0, cols - 1);
  const maxCx = clamp(Math.floor((x + radius) / CELL), 0, cols - 1);
  const minCy = clamp(Math.floor((y - radius) / CELL), 0, rows - 1);
  const maxCy = clamp(Math.floor((y + radius) / CELL), 0, rows - 1);
  const r2 = radius * radius;
  for (let cy = minCy; cy <= maxCy; cy++) {
    for (let cx = minCx; cx <= maxCx; cx++) {
      const ccx = cx * CELL + CELL / 2, ccy = cy * CELL + CELL / 2;
      const dx = ccx - x, dy = ccy - y;
      if (dx * dx + dy * dy <= r2) out.push(cellIndex(cx, cy, cols));
    }
  }
  return out;
};

/** Evenly-spaced hue per join order (golden-angle spacing) — holds up at 5 or 20 players. */
export const hueForJoinIndex = (n: number) => Math.round((n * 137.508) % 360);

export type CellOwner = { studentId: string; hue: number };
export type Stroke = { student_id: string; hue: number; cell_indices: number[] };

// Hue is for rendering only. Golden-angle spacing rounded to a whole degree can
// still land two students on the same integer hue at ordinary class sizes (it's
// a low-discrepancy spread, not a collision-free one) — so scoring and
// leaderboard identity must key off student_id, never hue.

/** Replay the append-only log into current cell ownership (last write wins, by insertion order). */
export const replayStrokes = (strokes: Stroke[]): Map<number, CellOwner> => {
  const owner = new Map<number, CellOwner>();
  for (const s of strokes) for (const idx of s.cell_indices) owner.set(idx, { studentId: s.student_id, hue: s.hue });
  return owner;
};

export type CoverageRow = { studentId: string; hue: number; count: number; pct: number };

/** Turn a per-student cell tally into a sorted leaderboard. */
export const coverageFromCounts = (
  counts: Map<string, { hue: number; count: number }>,
  totalCells: number,
): CoverageRow[] => {
  const rows: CoverageRow[] = [];
  for (const [studentId, { hue, count }] of counts) {
    rows.push({ studentId, hue, count, pct: totalCells > 0 ? (count / totalCells) * 100 : 0 });
  }
  rows.sort((a, b) => b.count - a.count);
  return rows;
};

/** Per-student coverage %, derived from the same replay used by the HUD, the monitor and the results page. */
export const computeCoverage = (strokes: Stroke[], totalCells: number): CoverageRow[] => {
  const owner = replayStrokes(strokes);
  const counts = new Map<string, { hue: number; count: number }>();
  for (const { studentId, hue } of owner.values()) {
    const cur = counts.get(studentId);
    if (cur) cur.count++; else counts.set(studentId, { hue, count: 1 });
  }
  return coverageFromCounts(counts, totalCells);
};

/**
 * Incremental version of the replay above, for the live clients that receive
 * strokes one row at a time. Mutates `owner` and `counts` together so the tally
 * can never drift from the map — the two are only ever updated here.
 */
export const applyStrokeIncremental = (
  owner: Map<number, CellOwner>,
  counts: Map<string, { hue: number; count: number }>,
  studentId: string,
  hue: number,
  cellIndices: number[],
  totalCells: number,
) => {
  for (const idx of cellIndices) {
    if (idx < 0 || idx >= totalCells) continue; // ignore anything out of this arena
    const prev = owner.get(idx);
    if (prev?.studentId === studentId) continue;
    if (prev) {
      const c = counts.get(prev.studentId);
      if (c && --c.count <= 0) counts.delete(prev.studentId);
    }
    owner.set(idx, { studentId, hue });
    const mine = counts.get(studentId);
    if (mine) mine.count++; else counts.set(studentId, { hue, count: 1 });
  }
};
