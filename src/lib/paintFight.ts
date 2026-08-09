// ── Paint Fight — grid-based territory painting ─────────────────────────────
// The shared arena is a fine grid of cells. Moving over a cell claims it in
// your color. Only compact cell-index batches are synced (never raw pixels)
// via an append-only log every client replays — same shape as
// lava_floor_builds / hvz_actions — cheap enough for ~20 concurrently-
// painting phones, while rendering (paintFightRender.ts) draws overlapping
// rounded blobs per cell so it still reads as one continuous brush stroke.

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const CELL = 16; // logical px per grid cell

export const PAINT = {
  start: 100,
  drainPerSec: 6,
  rewardPerCorrect: 30,
};

export const PLAYER_SPEED = 220;   // base px/s
// Brush footprint radius, logical px. The roller icon's on-screen size is
// *derived* from this (rollerIconSize in paintFightRender.ts) — grow this
// number to grow the paint, and the icon grows right along with it,
// matching exactly. Don't shrink this to chase a size mismatch; the icon
// side already tracks it correctly, so a mismatch means this number is
// wrong, not the icon.
export const PLAYER_RADIUS = 20;

export const POWERUP_DEFS = {
  speed:  { speedMult: 1.5, durationMs: 5000 },
  roller: { radiusMult: 2,  durationMs: 5000 },
  splash: { radius: 70 },          // instant one-off burst, no duration
} as const;

export type PowerupKind = keyof typeof POWERUP_DEFS;
export const POWERUP_KINDS: PowerupKind[] = ["speed", "roller", "splash"];

/**
 * Arena grid, sized to give a camera-followed player real room to roam
 * (student view now shows a local zoomed window, not the whole map fit to
 * screen — see computeCamera in paintFightRender.ts) while still scaling up
 * for bigger rosters so it doesn't feel cramped at 20+ players.
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

/** Cells within `radius` logical px of (x,y) — the brush footprint and splash bursts. */
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

/** Evenly-spaced unique hue per join order (golden-angle spacing) — holds up at 5 or 20 players. */
export const hueForJoinIndex = (n: number) => Math.round((n * 137.508) % 360);

export type CellOwner = { studentId: string; hue: number };
export type Stroke = { student_id: string; hue: number; cell_indices: number[] };

// Hue is for rendering only. Golden-angle spacing rounded to a whole degree
// can still land two different students on the same integer hue at ordinary
// class sizes (it's a low-discrepancy spread, not a collision-free one) — so
// scoring/leaderboard identity must key off student_id, never hue.

/** Replay the append-only stroke log into current cell ownership (last write wins, by insertion order). */
export const replayStrokes = (strokes: Stroke[]): Map<number, CellOwner> => {
  const owner = new Map<number, CellOwner>();
  for (const s of strokes) for (const idx of s.cell_indices) owner.set(idx, { studentId: s.student_id, hue: s.hue });
  return owner;
};

export type CoverageRow = { studentId: string; hue: number; count: number; pct: number };

/** Per-student coverage %, derived from the same replay used by student HUD, monitor, and results. */
export const computeCoverage = (strokes: Stroke[], totalCells: number): CoverageRow[] => {
  const owner = replayStrokes(strokes);
  const counts = new Map<string, { hue: number; count: number }>();
  for (const { studentId, hue } of owner.values()) {
    const cur = counts.get(studentId);
    if (cur) cur.count++; else counts.set(studentId, { hue, count: 1 });
  }
  const rows: CoverageRow[] = [];
  for (const [studentId, { hue, count }] of counts) {
    rows.push({ studentId, hue, count, pct: totalCells > 0 ? (count / totalCells) * 100 : 0 });
  }
  rows.sort((a, b) => b.count - a.count);
  return rows;
};
