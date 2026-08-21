// ── Paint Fight — shared canvas rendering ───────────────────────────────────
// The student view and the teacher arena view both draw from here so the two
// can never look different.
//
// The paint layer is an offscreen canvas of exactly `cols x rows` PIXELS — one
// pixel per grid cell, not one pixel per world px. Claiming a cell is a single
// `fillRect(cx, cy, 1, 1)`, and drawing the arena is one `drawImage` of that
// tiny bitmap upscaled with image smoothing off. Consequences that matter:
//
//   * The rendered picture IS the ownership map. A cell cannot appear painted
//     in a color that scoring disagrees with, and repainting the same cell is
//     idempotent, so replaying the log twice (history + realtime echo) is
//     harmless. The previous implementation kept a separate high-res "smooth
//     trail" bitmap next to the cell log and switched between the two per
//     event; those two pictures drifted, which is what the glitching was.
//   * Cell edges land on exact pixel boundaries of the source image, so
//     nothing tears or shimmers when the camera pans by a fraction of a px.
//   * The layer is a couple of hundred px on a side even for the biggest
//     arena, so it costs nothing to keep or to blit every frame.

import { CELL } from "./paintFight";

export const PF_PALETTE = {
  bg: "#EBDFC7",       // app's sand-dune cream background
  bgShade: "#DED0B2",
  grid: "rgba(63,90,99,0.10)",
  border: "#3F5A63",   // brand dark slate
};

export const hueFill = (hue: number, alpha = 1) => `hsla(${hue}, 62%, 50%, ${alpha})`;
export const hueDark = (hue: number, alpha = 1) => `hsla(${hue}, 58%, 34%, ${alpha})`;

/**
 * Size a canvas to its CSS box at devicePixelRatio and reset the transform so
 * all drawing below is in CSS px. Called once at the top of every frame: a
 * canvas whose backing store doesn't match its CSS box is the classic source
 * of "everything is blurry / offset by a bit", and it can change at any time
 * (rotation, browser chrome collapsing, dragging between monitors), so it is
 * checked per frame rather than on a resize listener.
 */
export const resizeCanvas = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
  const bw = Math.max(1, Math.round(cssW * dpr)), bh = Math.max(1, Math.round(cssH * dpr));
  if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { cssW, cssH };
};

export const drawArenaBackground = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  ctx.fillStyle = PF_PALETTE.bgShade;
  ctx.fillRect(0, 0, w, h);
};

/** One pixel per grid cell. Created once per match, once `cols`/`rows` are known. */
export const createPaintLayer = (cols: number, rows: number): HTMLCanvasElement => {
  const layer = document.createElement("canvas");
  layer.width = Math.max(1, cols);
  layer.height = Math.max(1, rows);
  return layer;
};

/** Claim cells on the layer. Idempotent: the same batch may safely be applied twice. */
export const paintCells = (layer: HTMLCanvasElement, indices: number[], hue: number, cols: number) => {
  const ctx = layer.getContext("2d");
  if (!ctx) return;
  const total = layer.width * layer.height;
  ctx.fillStyle = hueFill(hue);
  for (const idx of indices) {
    if (idx < 0 || idx >= total) continue;
    ctx.fillRect(idx % cols, Math.floor(idx / cols), 1, 1);
  }
};

/**
 * Draw the whole paint layer, upscaled. `offX/offY` are the screen coords of
 * world (0,0) and `scale` is screen px per world px; callers pick those from
 * either a follow camera (student) or a fit-to-box (monitor). The unpainted
 * arena floor is filled first so the arena reads as a bounded sheet rather
 * than bleeding into the page background.
 */
export const blitPaint = (
  ctx: CanvasRenderingContext2D, layer: HTMLCanvasElement,
  offX: number, offY: number, scale: number,
) => {
  const w = layer.width * CELL * scale, h = layer.height * CELL * scale;
  ctx.save();
  ctx.fillStyle = PF_PALETTE.bg;
  ctx.fillRect(offX, offY, w, h);
  const prevSmoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(layer, 0, 0, layer.width, layer.height, offX, offY, w, h);
  ctx.imageSmoothingEnabled = prevSmoothing;
  ctx.strokeStyle = PF_PALETTE.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(offX, offY, w, h);
  ctx.restore();
};

export interface Camera { x: number; y: number; halfW: number; halfH: number; }

/**
 * Follow camera at a fixed zoom, clamped so the window never shows past the
 * arena edge (unless the arena is smaller than the window, which only happens
 * on desktop preview).
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
 * Corner overview of the whole arena so a zoomed-in local camera doesn't leave
 * a player lost: painted territory at a glance, a dot per player, and a box
 * marking what the follow camera is currently showing.
 */
export const drawMinimap = (
  ctx: CanvasRenderingContext2D, layer: HTMLCanvasElement, cam: Camera,
  worldW: number, worldH: number,
  players: { x: number; y: number; hue: number }[],
  box: { x: number; y: number; w: number; h: number },
) => {
  ctx.save();
  roundRect(ctx, box.x, box.y, box.w, box.h, 8);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fill();
  ctx.strokeStyle = PF_PALETTE.border;
  ctx.lineWidth = 2;
  ctx.stroke();

  roundRect(ctx, box.x + 3, box.y + 3, box.w - 6, box.h - 6, 6);
  ctx.clip();
  const mScale = Math.min((box.w - 6) / worldW, (box.h - 6) / worldH);
  const mOffX = box.x + 3 + ((box.w - 6) - worldW * mScale) / 2;
  const mOffY = box.y + 3 + ((box.h - 6) - worldH * mScale) / 2;
  ctx.fillStyle = PF_PALETTE.bg;
  ctx.fillRect(mOffX, mOffY, worldW * mScale, worldH * mScale);
  const prevSmoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(layer, mOffX, mOffY, worldW * mScale, worldH * mScale);
  ctx.imageSmoothingEnabled = prevSmoothing;

  ctx.strokeStyle = PF_PALETTE.border;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(
    mOffX + (cam.x - cam.halfW) * mScale, mOffY + (cam.y - cam.halfH) * mScale,
    cam.halfW * 2 * mScale, cam.halfH * 2 * mScale,
  );

  for (const p of players) {
    ctx.fillStyle = hueFill(p.hue);
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(mOffX + p.x * mScale, mOffY + p.y * mScale, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
};

/**
 * Paint-roller player marker, rotated to face the heading.
 *
 * Pivot is the striped drum's center in the source artwork (x:150-178 -> 164,
 * y:44-186 -> 115), NOT the handle: (x,y) is exactly where paint is being laid
 * down, so if the sprite pivoted on the handle the drum would render ~62
 * viewBox units away from the cells it is supposedly painting.
 */
export const drawPlayerRoller = (
  ctx: CanvasRenderingContext2D,
  x: number, y: number, angle: number, hue: number, size: number,
  opts: { frozen?: boolean; alpha?: number } = {},
) => {
  const s = size / 200; // the reference artwork's 200x200 viewBox
  const cx = 164, cy = 115;
  const ink = opts.frozen ? "#6b7280" : "#000000";

  // grounding shadow, unrotated
  ctx.save();
  ctx.globalAlpha = (opts.alpha ?? 1) * 0.22;
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.ellipse(x, y + size * 0.36, size * 0.32, size * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s, s);
  ctx.translate(-cx, -cy);
  ctx.globalAlpha = opts.alpha ?? 1;

  ctx.fillStyle = ink;
  ctx.fillRect(80, 97, 58, 16);                 // connecting bar
  roundRect(ctx, 8, 90, 88, 30, 10); ctx.fill(); // handle ring
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, 23, 100, 58, 10, 5); ctx.fill(); // handle slot
  ctx.fillStyle = ink;
  roundRect(ctx, 132, 26, 64, 178, 6); ctx.fill(); // roller frame

  // striped drum, recolored to the player's hue
  ctx.save();
  roundRect(ctx, 150, 44, 28, 142, 2);
  ctx.clip();
  ctx.fillStyle = opts.frozen ? "#9ca3af" : hueDark(hue);
  ctx.fillRect(150, 44, 28, 142);
  ctx.strokeStyle = opts.frozen ? "rgba(255,255,255,0.4)" : hueFill(hue);
  ctx.lineWidth = 12;
  for (let i = -6; i <= 12; i++) {
    ctx.beginPath();
    ctx.moveTo(150 + i * 24, 44);
    ctx.lineTo(150 + i * 24 - 142, 44 + 142);
    ctx.stroke();
  }
  ctx.restore();

  ctx.globalAlpha = 1;
  ctx.restore();
};

// Stroke width is measured PERPENDICULAR to travel. Local +x is the travel
// direction (the axis `angle` rotates onto), so the drum dimension matching the
// paint width is its LOCAL-Y extent — the drum's 142-unit length — not its
// 28-unit depth. Anchoring on the depth (an easy axis mixup) leaves the roller
// looking several times wider than the trail it lays.
const ROLLER_VIEWBOX = 200;
const ROLLER_CORE_LENGTH = 142;
export const rollerIconSize = (brushWidth: number, scale: number) =>
  Math.max(18, (brushWidth * ROLLER_VIEWBOX / ROLLER_CORE_LENGTH) * scale);

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

export const drawNameTag = (ctx: CanvasRenderingContext2D, x: number, y: number, name: string, scale = 1) => {
  if (!name) return;
  const fs = Math.round(11 * scale);
  ctx.save();
  ctx.font = `700 ${fs}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const w = ctx.measureText(name).width + 12 * scale;
  const h = 15 * scale;
  roundRect(ctx, x - w / 2, y, w, h, 5 * scale);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fill();
  ctx.strokeStyle = PF_PALETTE.border;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = PF_PALETTE.border;
  ctx.fillText(name, x, y + h - 4 * scale);
  ctx.restore();
};
