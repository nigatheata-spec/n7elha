// ── Paint Fight — shared canvas rendering ───────────────────────────────────
// The student view, the projector view and the minimap all draw from here, so
// the three can never disagree about what the board looks like.
//
// THE PICTURE IS THE OWNERSHIP MAP. There is no second bitmap, no smoothed
// "trail layer" kept alongside the cells and reconciled per event — that split
// is what used to drift and glitch. A player's territory is drawn from their
// cell set and nothing else.
//
// HOW IT GETS ITS ROUNDED, UNPIXELATED LOOK
// ---------------------------------------------------------------------------
// Cells are square, and blitting one pixel per cell and upscaling gives you a
// staircase. Instead each player's cells are collapsed into HORIZONTAL RUNS and
// built into a Path2D in world coordinates, which is then both filled and
// stroked with a fat round-joined line of the same color. The stroke rounds
// every outer corner and welds the runs into one soft blob — flat vector shapes
// like the reference, with no blur and no per-pixel work.
//
// Two things make that cheap enough to do at 60fps:
//   * runs collapse a 900-cell blob to a few dozen rectangles;
//   * the path is in WORLD space, so it is camera-independent and is rebuilt
//     only when that player's territory actually changes (a capture, or a
//     stroke arriving) — not once a frame. `TerritoryPaths` below owns that
//     cache and its invalidation.

import { CELL, type Territory } from "./paintFight";

export const PF = {
  void:   "#D8EDE6",  // outside the arena
  floor:  "#F5FCF9",  // unclaimed ground
  edge:   "rgba(17,62,54,0.20)",
  ink:    "#123A33",
  inkSoft:"rgba(18,58,51,0.55)",
};

export const hueFill = (hue: number, alpha = 1) => `hsla(${hue}, 74%, 58%, ${alpha})`;
export const hueDeep = (hue: number, alpha = 1) => `hsla(${hue}, 68%, 38%, ${alpha})`;
export const hueSoft = (hue: number, alpha = 1) => `hsla(${hue}, 82%, 70%, ${alpha})`;

/** How far the round-join stroke dilates a territory, in world px. Half of this
 *  is both the corner radius and the overspill, so it stays under half a cell. */
const ROUND = CELL * 0.9;

/**
 * Size a canvas to its CSS box at devicePixelRatio and reset the transform so
 * all drawing below is in CSS px. Checked every frame rather than on a resize
 * listener: a backing store that doesn't match the CSS box is the classic
 * "everything is blurry and offset by a bit", and the box can change at any
 * time (rotation, browser chrome collapsing, a second monitor).
 */
export const resizeCanvas = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
  const bw = Math.max(1, Math.round(cssW * dpr)), bh = Math.max(1, Math.round(cssH * dpr));
  if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { cssW, cssH };
};

const roundRect = (ctx: CanvasRenderingContext2D | Path2D, x: number, y: number, w: number, h: number, r: number) => {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
};

/**
 * A player's cells as one world-space path, built from horizontal runs so the
 * path has tens of rectangles instead of thousands of squares.
 */
export const territoryPath = (cells: Set<number>, cols: number): Path2D => {
  const path = new Path2D();
  if (cells.size === 0) return path;
  const sorted = Array.from(cells).sort((a, b) => a - b);
  let runStart = sorted[0], prev = sorted[0];
  const emit = (from: number, to: number) => {
    const y = Math.floor(from / cols), x0 = from % cols, x1 = to % cols;
    path.rect(x0 * CELL, y * CELL, (x1 - x0 + 1) * CELL, CELL);
  };
  for (let i = 1; i < sorted.length; i++) {
    const idx = sorted[i];
    // A run breaks on a gap OR on a row change — indices are row-major, so
    // consecutive numbers spanning a row boundary are NOT adjacent on screen.
    const contiguous = idx === prev + 1 && Math.floor(idx / cols) === Math.floor(prev / cols);
    if (!contiguous) { emit(runStart, prev); runStart = idx; }
    prev = idx;
  }
  emit(runStart, prev);
  return path;
};

/**
 * Cached world-space paths, one per player, rebuilt only for the players a
 * change actually touched. Every view keeps one of these next to its board.
 */
export class TerritoryPaths {
  private cache = new Map<string, Path2D>();
  constructor(private cols: number) {}
  invalidate(ids: Iterable<string>) { for (const id of ids) this.cache.delete(id); }
  clear() { this.cache.clear(); }
  get(studentId: string, cells: Set<number>): Path2D {
    let p = this.cache.get(studentId);
    if (!p) { p = territoryPath(cells, this.cols); this.cache.set(studentId, p); }
    return p;
  }
}

/** Bare arena: the void beyond the edge, then the floor everyone paints on. */
export const drawArena = (
  ctx: CanvasRenderingContext2D, cssW: number, cssH: number,
  offX: number, offY: number, scale: number, worldW: number, worldH: number,
) => {
  ctx.fillStyle = PF.void;
  ctx.fillRect(0, 0, cssW, cssH);
  ctx.fillStyle = PF.floor;
  ctx.fillRect(offX, offY, worldW * scale, worldH * scale);
  ctx.strokeStyle = PF.edge;
  ctx.lineWidth = 3;
  ctx.strokeRect(offX, offY, worldW * scale, worldH * scale);
};

/**
 * Every player's territory, in world space. The caller sets up the camera
 * transform; drawing in world units is what lets the paths be cached.
 */
export const drawTerritories = (
  ctx: CanvasRenderingContext2D, board: Territory, paths: TerritoryPaths,
  offX: number, offY: number, scale: number,
) => {
  ctx.save();
  ctx.translate(offX, offY);
  ctx.scale(scale, scale);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = ROUND;
  for (const [studentId, cells] of board.byPlayer) {
    if (cells.size === 0) continue;
    const path = paths.get(studentId, cells);
    const color = hueFill(board.hues.get(studentId) ?? 0);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.stroke(path);   // stroke first: it is what rounds the outer corners
    ctx.fill(path);
  }
  ctx.restore();
};

/**
 * The trail: a translucent ribbon of the player's color. Drawn from the
 * polyline the player actually walked rather than from its cells, because a
 * cell staircase at trail width is exactly the pixelated look this mode is
 * getting away from. Collision is judged against the cells, never against this.
 */
export const drawTrail = (
  ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], hue: number,
  offX: number, offY: number, scale: number, width: number,
) => {
  if (pts.length < 2) return;
  ctx.save();
  ctx.translate(offX, offY);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = width;
  ctx.strokeStyle = hueSoft(hue, 0.55);
  ctx.stroke();
  ctx.lineWidth = width * 0.42;
  ctx.strokeStyle = hueFill(hue, 0.9);
  ctx.stroke();
  ctx.restore();
};

/**
 * The player: a rounded square with a darker leading face, tilted to its
 * heading. Small, flat and high-contrast — it has to stay legible on a phone
 * against its own saturated territory.
 */
export const drawPlayer = (
  ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, hue: number, size: number,
  opts: { frozen?: boolean; alpha?: number } = {},
) => {
  const s = size / 2;
  ctx.save();
  ctx.globalAlpha = (opts.alpha ?? 1) * 0.18;
  ctx.fillStyle = PF.ink;
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.85, s * 0.95, s * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  roundRect(ctx, -s, -s, s * 2, s * 2, s * 0.42);
  ctx.fillStyle = opts.frozen ? "#9CA9A5" : hueFill(hue);
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, size * 0.11);
  ctx.strokeStyle = opts.frozen ? "#5F6E6A" : hueDeep(hue);
  ctx.stroke();
  // Leading face, so which way you are pointing is readable at a glance.
  ctx.beginPath();
  roundRect(ctx, s * 0.18, -s * 0.5, s * 0.5, s, s * 0.22);
  ctx.fillStyle = opts.frozen ? "#6E7B77" : hueDeep(hue, 0.85);
  ctx.fill();
  ctx.restore();
};

/** Name in the player's own color, above their block. No chip — the reference
 *  reads as bold colored text floating on the arena. */
export const drawName = (
  ctx: CanvasRenderingContext2D, x: number, y: number, name: string, hue: number, fontPx: number,
) => {
  if (!name) return;
  ctx.save();
  ctx.font = `800 ${Math.round(fontPx)}px 'Almarai', system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(2, fontPx * 0.34);
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.strokeText(name, x, y);
  ctx.fillStyle = hueDeep(hue);
  ctx.fillText(name, x, y);
  ctx.restore();
};

export interface Camera { x: number; y: number; halfW: number; halfH: number; }

/**
 * Follow camera at a fixed zoom, clamped so the window never shows past the
 * arena edge (unless the arena is smaller than the window, which only happens
 * on a desktop preview).
 */
export const computeCamera = (
  px: number, py: number, cssW: number, cssH: number, scale: number, worldW: number, worldH: number,
): Camera => {
  const halfW = cssW / scale / 2, halfH = cssH / scale / 2;
  const clampAxis = (v: number, half: number, worldLen: number) =>
    worldLen <= half * 2 ? worldLen / 2 : Math.max(half, Math.min(worldLen - half, v));
  return { x: clampAxis(px, halfW, worldW), y: clampAxis(py, halfH, worldH), halfW, halfH };
};

/**
 * Round corner overview, so a zoomed-in local camera never leaves a player
 * lost: every territory at a glance, a dot per player, and the box the follow
 * camera is currently showing.
 */
export const drawMinimap = (
  ctx: CanvasRenderingContext2D, board: Territory, paths: TerritoryPaths,
  cam: Camera, worldW: number, worldH: number,
  players: { x: number; y: number; hue: number }[],
  cx: number, cy: number, r: number,
) => {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.fill();
  ctx.clip();

  const mScale = Math.min((r * 1.86) / worldW, (r * 1.86) / worldH);
  const offX = cx - (worldW * mScale) / 2, offY = cy - (worldH * mScale) / 2;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(offX, offY, worldW * mScale, worldH * mScale);

  ctx.save();
  ctx.translate(offX, offY);
  ctx.scale(mScale, mScale);
  ctx.lineJoin = "round";
  ctx.lineWidth = ROUND;
  for (const [studentId, cells] of board.byPlayer) {
    if (cells.size === 0) continue;
    const path = paths.get(studentId, cells);
    ctx.fillStyle = ctx.strokeStyle = hueFill(board.hues.get(studentId) ?? 0);
    ctx.stroke(path);
    ctx.fill(path);
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(18,58,51,0.45)";
  ctx.lineWidth = 1;
  ctx.strokeRect(
    offX + (cam.x - cam.halfW) * mScale, offY + (cam.y - cam.halfH) * mScale,
    cam.halfW * 2 * mScale, cam.halfH * 2 * mScale,
  );
  for (const p of players) {
    ctx.beginPath();
    ctx.arc(offX + p.x * mScale, offY + p.y * mScale, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = hueDeep(p.hue);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(18,58,51,0.35)";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();
};
