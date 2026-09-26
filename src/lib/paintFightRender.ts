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

// An art-room table: a sheet of paper taped down on a wooden desk. The paper
// is the arena; the grain and the pencil dot grid are there so movement reads
// even over bare floor — a flat colour gives no sense of speed at all.
export const PF = {
  void:   "#B98E5F",  // the desk beyond the sheet
  floor:  "#FBF7EE",  // unclaimed paper
  edge:   "rgba(17,62,54,0.20)",
  ink:    "#123A33",
  inkSoft:"rgba(18,58,51,0.55)",
  tape:   "rgba(238,224,178,0.92)",
};

export const hueFill = (hue: number, alpha = 1) => `hsla(${hue}, 74%, 58%, ${alpha})`;
export const hueDeep = (hue: number, alpha = 1) => `hsla(${hue}, 68%, 38%, ${alpha})`;
export const hueSoft = (hue: number, alpha = 1) => `hsla(${hue}, 82%, 70%, ${alpha})`;

/** How far the round-join stroke dilates a territory, in world px. Half of this
 *  is both the corner radius and the overspill, so it stays under half a cell. */
const ROUND = CELL * 0.9;

/** How far a territory's darker underside shows below it, in world px. */
const DEPTH = 3;

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

// ── Textures ────────────────────────────────────────────────────────────────
// Painted once into small offscreen tiles and repeated as patterns anchored to
// WORLD space, so the grain scrolls with the camera instead of sliding over it.
// Seeded, so every device (and every reload) draws the same sheet.

const TILE_WORLD = 160;           // world px one tile covers (16 cells)
const TILE_PX = TILE_WORLD * 2;   // drawn at 2x so the grain stays crisp on phones

const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

let paperTile: HTMLCanvasElement | null = null;
let woodTile: HTMLCanvasElement | null = null;

const makeTile = (paint: (g: CanvasRenderingContext2D, rnd: () => number) => void, seed: number) => {
  const c = document.createElement("canvas");
  c.width = c.height = TILE_PX;
  const g = c.getContext("2d");
  if (g) paint(g, seeded(seed));
  return c;
};

const getPaperTile = () => paperTile ??= makeTile((g, rnd) => {
  g.fillStyle = PF.floor;
  g.fillRect(0, 0, TILE_PX, TILE_PX);
  // Grain: faint light and dark flecks.
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = rnd() < 0.5 ? `rgba(120,100,60,${0.03 + rnd() * 0.05})` : `rgba(255,255,255,${0.4 + rnd() * 0.4})`;
    g.fillRect(rnd() * TILE_PX, rnd() * TILE_PX, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
  }
  // Fibres.
  g.lineCap = "round";
  for (let i = 0; i < 46; i++) {
    const x = rnd() * TILE_PX, y = rnd() * TILE_PX, a = rnd() * Math.PI, l = 6 + rnd() * 16;
    g.strokeStyle = `rgba(110,90,50,${0.035 + rnd() * 0.04})`;
    g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  // Pencil dot grid every 4 cells: the motion cue on empty paper.
  g.fillStyle = "rgba(18,58,51,0.13)";
  const step = TILE_PX / 4;
  for (let yy = step / 2; yy < TILE_PX; yy += step)
    for (let xx = step / 2; xx < TILE_PX; xx += step) {
      g.beginPath(); g.arc(xx, yy, 2.2, 0, Math.PI * 2); g.fill();
    }
}, 7);

const getWoodTile = () => woodTile ??= makeTile((g, rnd) => {
  g.fillStyle = PF.void;
  g.fillRect(0, 0, TILE_PX, TILE_PX);
  // Planks with grain running across them.
  const plank = TILE_PX / 4;
  for (let i = 0; i < 4; i++) {
    g.fillStyle = `rgba(${i % 2 ? "255,235,200" : "80,50,20"},${0.05 + rnd() * 0.05})`;
    g.fillRect(0, i * plank, TILE_PX, plank);
    g.fillStyle = "rgba(60,35,12,0.28)";
    g.fillRect(0, i * plank, TILE_PX, 2);
  }
  for (let i = 0; i < 60; i++) {
    const y = rnd() * TILE_PX, amp = 1 + rnd() * 3, ph = rnd() * 6;
    g.strokeStyle = `rgba(70,42,16,${0.06 + rnd() * 0.08})`;
    g.lineWidth = 0.6 + rnd() * 1.2;
    g.beginPath();
    for (let x = 0; x <= TILE_PX; x += 8) {
      const yy = y + Math.sin(x / 40 + ph) * amp;
      if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
    }
    g.stroke();
  }
}, 11);

const worldPattern = (ctx: CanvasRenderingContext2D, tile: HTMLCanvasElement, offX: number, offY: number, scale: number) => {
  const pat = ctx.createPattern(tile, "repeat");
  if (!pat) return null;
  const k = scale * (TILE_WORLD / TILE_PX);
  try { pat.setTransform(new DOMMatrix([k, 0, 0, k, offX, offY])); } catch { /* old Safari: unanchored is fine */ }
  return pat;
};

/** The desk, the sheet's shadow on it, the sheet, and masking tape holding it
 *  down along every edge. The tape is also the wall, so it reads as one. */
export const drawArena = (
  ctx: CanvasRenderingContext2D, cssW: number, cssH: number,
  offX: number, offY: number, scale: number, worldW: number, worldH: number,
) => {
  ctx.fillStyle = worldPattern(ctx, getWoodTile(), offX, offY, scale) ?? PF.void;
  ctx.fillRect(0, 0, cssW, cssH);

  const w = worldW * scale, h = worldH * scale;
  ctx.fillStyle = "rgba(40,22,6,0.28)";
  ctx.fillRect(offX + 3 * scale, offY + 7 * scale, w, h);
  ctx.fillStyle = worldPattern(ctx, getPaperTile(), offX, offY, scale) ?? PF.floor;
  ctx.fillRect(offX, offY, w, h);

  // Tape: a band straddling each edge, plus a crossed strip at each corner.
  const t = 14 * scale;
  ctx.fillStyle = PF.tape;
  ctx.fillRect(offX - t / 2, offY - t / 2, w + t, t);
  ctx.fillRect(offX - t / 2, offY + h - t / 2, w + t, t);
  ctx.fillRect(offX - t / 2, offY - t / 2, t, h + t);
  ctx.fillRect(offX + w - t / 2, offY - t / 2, t, h + t);
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fillRect(offX - t / 2, offY - t / 2, w + t, t * 0.3);
  ctx.fillRect(offX - t / 2, offY + h - t / 2, w + t, t * 0.3);
  const corner = (cx: number, cy: number, rot: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.fillStyle = "rgba(230,212,160,0.95)";
    ctx.fillRect(-t * 2.2, -t * 0.75, t * 4.4, t * 1.5);
    ctx.restore();
  };
  corner(offX, offY, -Math.PI / 4);
  corner(offX + w, offY, Math.PI / 4);
  corner(offX, offY + h, Math.PI / 4);
  corner(offX + w, offY + h, -Math.PI / 4);
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
  // Two passes: every slab's darker underside first, then every top. A thick
  // coat of paint standing off the paper, not a flat decal — and doing all the
  // undersides first keeps one player's edge from drawing over another's top.
  ctx.save();
  ctx.translate(0, DEPTH);
  for (const [studentId, cells] of board.byPlayer) {
    if (cells.size === 0) continue;
    const path = paths.get(studentId, cells);
    ctx.fillStyle = ctx.strokeStyle = hueDeep(board.hues.get(studentId) ?? 0);
    ctx.stroke(path);
    ctx.fill(path);
  }
  ctx.restore();
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
  // Wet paint: a darker bead underneath, the stroke, and a gloss line on top.
  ctx.save();
  ctx.translate(0, 1.6);
  ctx.lineWidth = width;
  ctx.strokeStyle = hueDeep(hue, 0.55);
  ctx.stroke();
  ctx.restore();
  ctx.lineWidth = width;
  ctx.strokeStyle = hueSoft(hue, 0.95);
  ctx.stroke();
  ctx.save();
  ctx.translate(-0.8, -1.1);
  ctx.lineWidth = width * 0.26;
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.stroke();
  ctx.restore();
  ctx.restore();
};

/**
 * The player: a drop of their own paint with a face. The drop's tail trails
 * behind the heading, so which way you're going reads at a glance; the eyes
 * stay upright (only the pupils follow the heading) so the face never ends up
 * upside down. An empty tank goes grey with closed eyes.
 */
export const drawPlayer = (
  ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, hue: number, size: number,
  opts: { frozen?: boolean; alpha?: number } = {},
) => {
  const s = size / 2;
  const alpha = opts.alpha ?? 1;
  ctx.save();
  ctx.globalAlpha = alpha * 0.2;
  ctx.fillStyle = PF.ink;
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.9, s * 1.05, s * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const body = opts.frozen ? "#A4ACA8" : hueFill(hue);
  const rim = opts.frozen ? "#66716D" : hueDeep(hue);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(angle);
  const tip = s * 1.7;
  const phi = Math.acos(s / tip);
  ctx.beginPath();
  ctx.moveTo(-tip, 0);
  ctx.arc(0, 0, s, Math.PI + phi, Math.PI - phi);
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(1.5, size * 0.1);
  ctx.strokeStyle = rim;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = alpha;
  // Gloss.
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.ellipse(x - s * 0.42, y - s * 0.5, s * 0.26, s * 0.16, -0.6, 0, Math.PI * 2);
  ctx.fill();
  // Eyes.
  const lx = Math.cos(angle), ly = Math.sin(angle);
  const er = s * 0.3;
  for (const side of [-1, 1]) {
    const ex = x + side * s * 0.36 + lx * s * 0.16, ey = y - s * 0.06 + ly * s * 0.16;
    if (opts.frozen) {
      ctx.strokeStyle = PF.ink;
      ctx.lineWidth = Math.max(1.2, s * 0.14);
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(ex - er * 0.8, ey); ctx.lineTo(ex + er * 0.8, ey); ctx.stroke();
      continue;
    }
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PF.ink;
    ctx.beginPath(); ctx.arc(ex + lx * er * 0.42, ey + ly * er * 0.42, er * 0.52, 0, Math.PI * 2); ctx.fill();
  }
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

// ── Effects ─────────────────────────────────────────────────────────────────
// Everything here is cosmetic and local to one screen: a splash when a player
// bursts, the stain it leaves, the wet shine that sweeps over freshly captured
// ground, and a small camera punch on your own capture. None of it touches the
// board, so a device that misses an effect is never wrong about the score.

type Splash = { x: number; y: number; hue: number; t0: number; parts: { a: number; d: number; r: number }[] };
type Stain = { x: number; y: number; hue: number; t0: number; blobs: { dx: number; dy: number; r: number }[] };
type Wave = { x: number; y: number; reach: number; path: Path2D; t0: number };

const SPLASH_MS = 560;
const WAVE_MS = 650;
const STAIN_MS = 60_000;
const PUNCH_MS = 280;

const easeOut = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);

export class PaintFx {
  private splashes: Splash[] = [];
  private stains: Stain[] = [];
  private waves: Wave[] = [];
  private punchAt = -1e9;
  private punchAmt = 0;

  /** A burst of droplets. `power` scales how far they fly. */
  splash(x: number, y: number, hue: number, power = 1) {
    const n = Math.round(12 + power * 6);
    const parts = Array.from({ length: n }, () => ({
      a: Math.random() * Math.PI * 2,
      d: (18 + Math.random() * 34) * power,
      r: 1.6 + Math.random() * 3.2,
    }));
    this.splashes.push({ x, y, hue, t0: performance.now(), parts });
  }

  /** A player's burst leaves their colour on the paper for a while. */
  stain(x: number, y: number, hue: number) {
    const blobs = [{ dx: 0, dy: 0, r: 13 + Math.random() * 5 }];
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * Math.PI * 2, d = 14 + Math.random() * 20;
      blobs.push({ dx: Math.cos(a) * d, dy: Math.sin(a) * d, r: 2 + Math.random() * 5 });
    }
    this.stains.push({ x, y, hue, t0: performance.now(), blobs });
    if (this.stains.length > 40) this.stains.shift();
  }

  /** Wet shine sweeping outward from (x, y) over the cells just captured. */
  wave(x: number, y: number, cells: Iterable<number>, cols: number) {
    const set = new Set(cells);
    if (set.size === 0) return;
    let reach = 0;
    for (const idx of set) {
      const cx = (idx % cols + 0.5) * CELL, cy = (Math.floor(idx / cols) + 0.5) * CELL;
      reach = Math.max(reach, Math.hypot(cx - x, cy - y));
    }
    this.waves.push({ x, y, reach: reach + CELL * 2, path: territoryPath(set, cols), t0: performance.now() });
    if (this.waves.length > 12) this.waves.shift();
  }

  /** Camera punch; `amt` is the extra zoom at its peak (0.04 = 4%). */
  punch(amt = 0.035) { this.punchAt = performance.now(); this.punchAmt = amt; }

  zoom(now = performance.now()) {
    const t = (now - this.punchAt) / PUNCH_MS;
    return t >= 0 && t < 1 ? 1 + this.punchAmt * Math.sin(Math.PI * t) : 1;
  }

  /** Floor layer: stains, drawn before territories so claimed ground covers them. */
  drawUnder(ctx: CanvasRenderingContext2D, offX: number, offY: number, scale: number, now = performance.now()) {
    this.stains = this.stains.filter(s => now - s.t0 < STAIN_MS);
    if (this.stains.length === 0) return;
    ctx.save();
    ctx.translate(offX, offY);
    ctx.scale(scale, scale);
    for (const s of this.stains) {
      const age = (now - s.t0) / STAIN_MS;
      const grow = easeOut(Math.min(1, (now - s.t0) / 220));
      ctx.fillStyle = hueFill(s.hue, 0.34 * (1 - age * age));
      ctx.beginPath();
      for (const b of s.blobs) {
        ctx.moveTo(s.x + b.dx * grow + b.r, s.y + b.dy * grow);
        ctx.arc(s.x + b.dx * grow, s.y + b.dy * grow, b.r * grow, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.restore();
  }

  /** Top layer: capture shine and flying droplets. */
  drawOver(ctx: CanvasRenderingContext2D, offX: number, offY: number, scale: number, now = performance.now()) {
    this.waves = this.waves.filter(w => now - w.t0 < WAVE_MS);
    this.splashes = this.splashes.filter(s => now - s.t0 < SPLASH_MS);
    if (this.waves.length === 0 && this.splashes.length === 0) return;
    ctx.save();
    ctx.translate(offX, offY);
    ctx.scale(scale, scale);

    for (const w of this.waves) {
      const t = (now - w.t0) / WAVE_MS;
      const r = w.reach * easeOut(t);
      ctx.save();
      ctx.clip(w.path);
      ctx.beginPath();
      ctx.arc(w.x, w.y, Math.max(1, r), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.42 * (1 - t)})`;
      ctx.fill();
      ctx.lineWidth = 7;
      ctx.strokeStyle = `rgba(255,255,255,${0.85 * (1 - t)})`;
      ctx.stroke();
      ctx.restore();
    }

    for (const s of this.splashes) {
      const t = (now - s.t0) / SPLASH_MS;
      const k = easeOut(t);
      ctx.fillStyle = hueFill(s.hue, 1 - t * 0.6);
      ctx.beginPath();
      for (const p of s.parts) {
        const px = s.x + Math.cos(p.a) * p.d * k, py = s.y + Math.sin(p.a) * p.d * k + 10 * t * t;
        const r = p.r * (1 - t * 0.55);
        ctx.moveTo(px + r, py);
        ctx.arc(px, py, r, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.restore();
  }
}
