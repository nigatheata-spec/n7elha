// ── Paint Fight — territory capture ─────────────────────────────────────────
//
// THE GAME
// ---------------------------------------------------------------------------
// Every player owns a patch of the arena. You drive out of it, leaving a trail
// behind you, and the moment you get back onto your own territory everything
// your loop encloses becomes yours — including cells that belonged to someone
// else. You are only vulnerable while you are outside your own territory: if
// anyone touches your trail you die and lose the lot; if you touch your own
// trail, same thing. Crossing somebody else's trail kills them.
//
// The quiz fills your colour tank. Moving spends it, a correct answer refills
// it, and at empty you stop dead — which, if you stopped halfway around a big
// loop, is exactly where you least want to be standing.
//
// WHO DECIDES WHAT (there is no server, so this matters)
// ---------------------------------------------------------------------------
// Every client is authoritative over ITS OWN player and nothing else:
//   * it computes its own capture fill and appends the resulting cells to the
//     `paint_fight_strokes` log;
//   * it decides its own death, and on death appends a `wipe` row.
// Nobody ever writes a verdict about somebody else, so two clients can never
// disagree about who died or who owns what. A kill is reported by the VICTIM
// (it knows who ran into it) over broadcast, and the killer's own client is
// what increments its counter.
//
// DURABLE STATE is still just the append-only log, replayed in `created_at`
// order with last-write-wins per cell, so a late joiner or a reconnect rebuilds
// the identical board by reading the table from the beginning — and scores are
// derived from that same replay, which is why the student HUD, the projector
// and the results page can never disagree. Two ops:
//   claim — these cell indices now belong to student_id
//   wipe  — student_id owns nothing any more (they died)
// A wipe cannot be expressed as a claim, and without it a dead player's
// territory would still be sitting on everyone else's screen.
//
// LIVE POSITIONS and the cosmetic trail polylines go over a realtime broadcast
// channel. Nothing durable and nothing about scoring depends on a broadcast
// arriving: collision is always judged against the client's OWN trail, which it
// holds exactly.

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Logical world px per grid cell. */
export const CELL = 10;

/** The colour tank. Movement is the only thing that spends it, and a correct
 *  answer is the only thing that refills it. */
export const TANK = {
  start: 100,
  drainPerSec: 4.5,
  rewardPerCorrect: 34,
  low: 25,
};

/** World px/s. Constant: the joystick steers, it does not throttle. */
export const PLAYER_SPEED = 132;

/** Max steering, rad/s. Low enough that a hairpin turn onto your own trail is
 *  a decision rather than a twitch. */
export const TURN_RATE = 6.2;

/** Half-width of the trail in world px — just under one cell. */
export const TRAIL_RADIUS = 4.5;

/** A fresh spawn owns a (2n+1)² block of cells. */
export const SPAWN_HALF = 3;

/** How long you sit dead before respawning. */
export const RESPAWN_MS = 1500;

/** Fixed student-camera zoom: screen px per world px. Set so a phone shows a
 *  few dozen cells of arena — enough that a loop worth drawing is visible in
 *  one glance, which is the whole readability of the mode. */
export const PIXELS_PER_WORLD_UNIT = 1.15;

/** How often a client appends its newly-owned cells to the log. */
export const FLUSH_INTERVAL_MS = 220;

/** How often a client broadcasts position + new trail points. */
export const BROADCAST_INTERVAL_MS = 70;

/** A peer whose position hasn't been heard in this long stops being drawn. */
export const PEER_TIMEOUT_MS = 5000;

/**
 * Arena grid, frozen into settings at Start from the confirmed roster. Sized so
 * a loop worth making takes a few seconds to run and 20 players aren't standing
 * on each other's spawns.
 */
export const computeArenaSize = (playerCount: number) => {
  const n = Math.max(1, playerCount);
  const cols = Math.round(clamp(56 * Math.sqrt(n / 6), 60, 170));
  const rows = Math.round(cols * 1.35); // portrait-ish, matches phone screens
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

/**
 * Cells the disc of `radius` at (x,y) OVERLAPS — tested against each cell's
 * rectangle, not its centre. Centre distance is the obvious way to write this
 * and it is wrong: half a cell's diagonal is 7.1px and the trail's radius is
 * 4.5px, so a player standing on a cell corner would be within range of no
 * centre at all and lay nothing. A trail with holes in it is one an opponent
 * can drive straight through without being cut off. Rectangle distance always
 * includes the cell you are standing in, whatever the radius.
 */
export const cellsUnderDisc = (x: number, y: number, radius: number, cols: number, rows: number): number[] => {
  const out: number[] = [];
  const minCx = clamp(Math.floor((x - radius) / CELL), 0, cols - 1);
  const maxCx = clamp(Math.floor((x + radius) / CELL), 0, cols - 1);
  const minCy = clamp(Math.floor((y - radius) / CELL), 0, rows - 1);
  const maxCy = clamp(Math.floor((y + radius) / CELL), 0, rows - 1);
  const r2 = radius * radius;
  for (let cy = minCy; cy <= maxCy; cy++) {
    for (let cx = minCx; cx <= maxCx; cx++) {
      const nx = clamp(x, cx * CELL, (cx + 1) * CELL);
      const ny = clamp(y, cy * CELL, (cy + 1) * CELL);
      const dx = nx - x, dy = ny - y;
      if (dx * dx + dy * dy <= r2) out.push(cellIndex(cx, cy, cols));
    }
  }
  return out;
};

/** The (2*SPAWN_HALF+1)² block of cells around a spawn point. */
export const spawnBlock = (cx: number, cy: number, cols: number, rows: number): number[] => {
  const out: number[] = [];
  for (let y = cy - SPAWN_HALF; y <= cy + SPAWN_HALF; y++) {
    for (let x = cx - SPAWN_HALF; x <= cx + SPAWN_HALF; x++) {
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      out.push(cellIndex(x, y, cols));
    }
  }
  return out;
};

/**
 * Cells swept by the segment (x0,y0)→(x1,y1) at the trail's width. Sampled
 * rather than rasterised exactly: a physics step at 132 px/s covers ~2px, so
 * sampling every half-cell can never skip over a cell. A skipped cell would be
 * a hole an opponent could drive through without cutting anybody.
 */
export const cellsAlongSegment = (
  x0: number, y0: number, x1: number, y1: number, cols: number, rows: number,
): number[] => {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist / (CELL / 2)));
  const seen = new Set<number>();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    for (const idx of cellsUnderDisc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, TRAIL_RADIUS, cols, rows)) seen.add(idx);
  }
  return Array.from(seen);
};

/**
 * How far you must have travelled past a bit of your own trail before it can
 * kill you. Without a grace period you die on your fifteenth step every single
 * time: the trail is wider than a cell, so each step re-sweeps cells the step
 * before it laid down, and "am I standing on my own trail" is trivially true
 * for the ground directly under you. It has to be longer than the trail is
 * wide and shorter than a U-turn (turn radius is PLAYER_SPEED / TURN_RATE, so
 * a hairpin comes back after ~66px), which is what makes a hairpin fatal and
 * driving in a straight line safe.
 */
export const TRAIL_GRACE = CELL * 2.5;

/**
 * A player's trail: the polyline for drawing, the cells for the capture fill,
 * and the answer to "did that move cut me off". One object so the three can
 * never disagree — the collision test is the reason this is not just an array.
 */
export class Trail {
  /** cell index → distance travelled when it was first laid. */
  readonly cells = new Map<number, number>();
  points: { x: number; y: number }[] = [];
  /** Points laid since the last time they were put on the wire. */
  pending: { x: number; y: number }[] = [];
  travelled = 0;

  get size() { return this.cells.size; }

  clear() {
    this.cells.clear();
    this.points = [];
    this.pending = [];
    this.travelled = 0;
  }

  /**
   * Lay trail along a move. Returns true if the move crossed the part of this
   * trail that is old enough to be lethal — in which case the caller dies and
   * nothing is laid.
   */
  extend(x0: number, y0: number, x1: number, y1: number, cols: number, rows: number): boolean {
    const swept = cellsAlongSegment(x0, y0, x1, y1, cols, rows);
    const moved = Math.hypot(x1 - x0, y1 - y0);
    for (const idx of swept) {
      const laidAt = this.cells.get(idx);
      if (laidAt !== undefined && this.travelled - laidAt > TRAIL_GRACE) return true;
    }
    this.travelled += moved;
    for (const idx of swept) if (!this.cells.has(idx)) this.cells.set(idx, this.travelled);
    const tail = this.points[this.points.length - 1];
    if (!tail || Math.hypot(x1 - tail.x, y1 - tail.y) > 4) {
      const pt = { x: Math.round(x1), y: Math.round(y1) };
      this.points.push(pt);
      this.pending.push(pt);
    }
    return false;
  }

  /** Is somebody standing on this trail? Their position comes from a broadcast,
   *  so this is a frame late at worst — but never wrong about whose trail it is. */
  covers(x: number, y: number, cols: number, rows: number) {
    return this.cells.has(cellOfXY(x, y, cols, rows).index);
  }
}

/** Evenly-spaced hue per join order (golden-angle spacing) — holds up at 5 or 20 players. */
export const hueForJoinIndex = (n: number) => Math.round((n * 137.508) % 360);

// Hue is for rendering only. Golden-angle spacing rounded to a whole degree can
// still land two students on the same integer hue at ordinary class sizes (it's
// a low-discrepancy spread, not a collision-free one) — so scoring and
// leaderboard identity must key off student_id, never hue.

export type CellOwner = { studentId: string; hue: number };
export type StrokeOp = "claim" | "wipe";
export type Stroke = { student_id: string; hue: number; cell_indices: number[]; op?: StrokeOp | null };

/**
 * The whole board. `owner` answers "who holds this cell", `byPlayer` answers
 * "which cells does this player hold" — the capture fill needs the second one
 * and deriving it from the first every time a loop closes would walk the entire
 * arena. They are only ever mutated together, right here, so they cannot drift.
 */
export type Territory = {
  owner: Map<number, CellOwner>;
  byPlayer: Map<string, Set<number>>;
  hues: Map<string, number>;
};

export const emptyTerritory = (): Territory => ({ owner: new Map(), byPlayer: new Map(), hues: new Map() });

export const cellsOf = (t: Territory, studentId: string): Set<number> =>
  t.byPlayer.get(studentId) ?? new Set<number>();

/** Claim cells for a player. Returns the ids whose picture changed (for redraw caches). */
export const claimCells = (
  t: Territory, studentId: string, hue: number, indices: Iterable<number>, totalCells: number,
): Set<string> => {
  const touched = new Set<string>();
  t.hues.set(studentId, hue);
  let mine = t.byPlayer.get(studentId);
  if (!mine) { mine = new Set(); t.byPlayer.set(studentId, mine); }
  for (const idx of indices) {
    if (idx < 0 || idx >= totalCells) continue; // ignore anything out of this arena
    const prev = t.owner.get(idx);
    if (prev?.studentId === studentId) continue;
    if (prev) {
      t.byPlayer.get(prev.studentId)?.delete(idx);
      touched.add(prev.studentId);
    }
    t.owner.set(idx, { studentId, hue });
    mine.add(idx);
    touched.add(studentId);
  }
  return touched;
};

/** A player died: everything they held goes back to bare floor. */
export const wipePlayer = (t: Territory, studentId: string): Set<string> => {
  const mine = t.byPlayer.get(studentId);
  if (!mine || mine.size === 0) return new Set();
  for (const idx of mine) t.owner.delete(idx);
  mine.clear();
  return new Set([studentId]);
};

export const applyStroke = (t: Territory, s: Stroke, totalCells: number): Set<string> =>
  s.op === "wipe" ? wipePlayer(t, s.student_id) : claimCells(t, s.student_id, s.hue, s.cell_indices, totalCells);

/** Replay the append-only log into a board. */
export const replayStrokes = (strokes: Stroke[], totalCells: number): Territory => {
  const t = emptyTerritory();
  for (const s of strokes) applyStroke(t, s, totalCells);
  return t;
};

/**
 * The capture. `mine` plus `trail` seals a region; anything the outside can no
 * longer reach becomes yours, whoever held it before. Returns only the cells
 * that are newly yours, which is exactly what goes on the wire.
 *
 * The flood is run over the bounding box of the sealed shape rather than the
 * whole arena — an enclosed cell is by definition inside that box, and at 170
 * columns the difference is a scan of a few hundred cells instead of 39,000
 * every time somebody closes a loop. Sealing a bay against the arena wall
 * counts as enclosing it, which is the intended behaviour: the wall is a wall.
 */
export const captureFill = (
  mine: Set<number>, trail: Iterable<number>, cols: number, rows: number,
): number[] => {
  const claimed = new Set(mine);
  for (const idx of trail) claimed.add(idx);
  if (claimed.size === 0) return [];

  let minX = cols, maxX = -1, minY = rows, maxY = -1;
  for (const idx of claimed) {
    const x = idx % cols, y = (idx / cols) | 0;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  minX = Math.max(0, minX - 1); maxX = Math.min(cols - 1, maxX + 1);
  minY = Math.max(0, minY - 1); maxY = Math.min(rows - 1, maxY + 1);

  const w = maxX - minX + 1, h = maxY - minY + 1;
  const outside = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (lx: number, ly: number) => {
    const k = ly * w + lx;
    if (outside[k]) return;
    if (claimed.has((ly + minY) * cols + (lx + minX))) return;
    outside[k] = 1;
    stack.push(k);
  };
  // Seed only from sides of the box that open onto the rest of the arena. A
  // side that sits on the arena's own boundary is a WALL, not a way out: seeding
  // it would let the flood in behind a bay the player sealed against the edge,
  // and that bay is a legitimate capture. (When the box spans the whole arena
  // there is nowhere left to seed from and everything unclaimed is, correctly,
  // enclosed — solid walls on all four sides is exactly what that means.)
  if (minY > 0) for (let lx = 0; lx < w; lx++) push(lx, 0);
  if (maxY < rows - 1) for (let lx = 0; lx < w; lx++) push(lx, h - 1);
  if (minX > 0) for (let ly = 0; ly < h; ly++) push(0, ly);
  if (maxX < cols - 1) for (let ly = 0; ly < h; ly++) push(w - 1, ly);
  while (stack.length) {
    const k = stack.pop()!;
    const lx = k % w, ly = (k / w) | 0;
    if (lx > 0) push(lx - 1, ly);
    if (lx < w - 1) push(lx + 1, ly);
    if (ly > 0) push(lx, ly - 1);
    if (ly < h - 1) push(lx, ly + 1);
  }

  const gained: number[] = [];
  for (let ly = 0; ly < h; ly++) {
    for (let lx = 0; lx < w; lx++) {
      if (outside[ly * w + lx]) continue;
      const idx = (ly + minY) * cols + (lx + minX);
      if (mine.has(idx)) continue;
      gained.push(idx);
    }
  }
  return gained;
};

export type CoverageRow = { studentId: string; hue: number; count: number; pct: number };

/** Turn a board into a sorted leaderboard. */
export const coverageOf = (t: Territory, totalCells: number): CoverageRow[] => {
  const rows: CoverageRow[] = [];
  for (const [studentId, cells] of t.byPlayer) {
    if (cells.size === 0) continue;
    rows.push({
      studentId,
      hue: t.hues.get(studentId) ?? 0,
      count: cells.size,
      pct: totalCells > 0 ? (cells.size / totalCells) * 100 : 0,
    });
  }
  rows.sort((a, b) => b.count - a.count);
  return rows;
};

/** Per-student coverage %, derived from the same replay the live views use. */
export const computeCoverage = (strokes: Stroke[], totalCells: number): CoverageRow[] =>
  coverageOf(replayStrokes(strokes, totalCells), totalCells);
