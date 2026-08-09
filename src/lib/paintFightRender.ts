// ── Paint Fight — shared canvas rendering ───────────────────────────────────
// Both the student view and the teacher arena view draw from here so the two
// never drift apart visually.
//
// Paint is a persistent bitmap layer (createPaintLayer/strokeTo), not shapes
// re-stamped every frame — exactly how a real paint tool works: you stroke a
// line from the last known point to the new one with a round cap/join, and
// later strokes physically paint over earlier pixels of a different color.
// That's what makes it read as one continuous brush trail instead of a grid
// of stamped dots. The discrete cell grid (paintFight.ts) still exists, but
// only for scoring/sync — never for rendering.

import { CELL, xyOfCell, type PowerupKind } from "./paintFight";

export const PF_PALETTE = {
  bg: "#EBDFC7",       // app's sand-dune cream background
  bgShade: "#e2d5b8",
};

export const hueFill = (hue: number, alpha = 1) => `hsla(${hue}, 62%, 50%, ${alpha})`;
export const hueDark = (hue: number, alpha = 1) => `hsla(${hue}, 58%, 34%, ${alpha})`;

/** Resize a canvas to its CSS box at devicePixelRatio, matching dontLookDownRender's pattern. */
export const resizeCanvas = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
  if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
    canvas.width = cssW * dpr; canvas.height = cssH * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { cssW, cssH };
};

export const drawArenaBackground = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  ctx.fillStyle = PF_PALETTE.bg;
  ctx.fillRect(0, 0, w, h);
};

/** A persistent world-space bitmap that strokes accumulate onto — created once per match. */
export const createPaintLayer = (cols: number, rows: number): HTMLCanvasElement => {
  const layer = document.createElement("canvas");
  layer.width = cols * CELL;
  layer.height = rows * CELL;
  return layer;
};

/**
 * Stroke a round-cap/join segment from (x1,y1) to (x2,y2) onto the paint
 * layer in world-space units. Pass x1===x2 && y1===y2 for the very first
 * point of a stroke (draws a single round dot so a tap-without-moving still
 * shows up).
 */
export const strokeTo = (
  layer: HTMLCanvasElement, x1: number, y1: number, x2: number, y2: number,
  hue: number, width: number,
) => {
  const ctx = layer.getContext("2d");
  if (!ctx) return;
  ctx.strokeStyle = hueFill(hue);
  ctx.fillStyle = hueFill(hue);
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (x1 === x2 && y1 === y2) {
    ctx.beginPath();
    ctx.arc(x1, y1, width / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
};

/** Paint a filled circular burst directly onto the layer — for the splash power-up's instant one-off blot. */
export const fillSplash = (layer: HTMLCanvasElement, x: number, y: number, radius: number, hue: number) => {
  const ctx = layer.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = hueFill(hue);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
};

/** Blit the accumulated paint layer onto the visible, scaled/letterboxed canvas. */
export const blitPaintLayer = (
  ctx: CanvasRenderingContext2D, layer: HTMLCanvasElement,
  offX: number, offY: number, scale: number,
) => {
  ctx.drawImage(layer, offX, offY, layer.width * scale, layer.height * scale);
};

/**
 * Paint-roller player marker, rotated to face the movement heading. Same
 * silhouette as the exact reference artwork (PaintRollerIcon): a black
 * handle ring with a white slot, a connecting bar, and a black roller frame
 * — with the striped core recolored to the player's hue so players stay
 * visually distinct.
 */
export const drawPlayerRoller = (
  ctx: CanvasRenderingContext2D,
  x: number, y: number, angle: number, hue: number, size: number,
  opts: { frozen?: boolean; alpha?: number } = {},
) => {
  const s = size / 200; // matches the reference artwork's 200x200 viewBox
  const cx = 102, cy = 115; // artwork's approximate visual center — rotation pivot
  const ink = opts.frozen ? "#4b5563" : "#000000";

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

  // connecting bar
  ctx.fillStyle = ink;
  ctx.fillRect(80, 97, 58, 16);

  // handle ring
  ctx.fillStyle = ink;
  roundRect(ctx, 8, 90, 88, 30, 10);
  ctx.fill();

  // handle slot
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, 23, 100, 58, 10, 5);
  ctx.fill();

  // roller frame
  ctx.fillStyle = ink;
  roundRect(ctx, 132, 26, 64, 178, 6);
  ctx.fill();

  // striped core, recolored to the player's hue
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

// The roller's black frame (roundRect(132,26,64,178,...) below) is the part
// that visually reads as "the brush" — its width is 64 of the artwork's 200
// viewBox units. Size the drawn icon so that, once scaled to screen, this
// frame is exactly as wide as the world-space paint stroke it's laying down.
// Otherwise the icon looks small while paint balloons out past it.
const ROLLER_VIEWBOX = 200;
const ROLLER_FRAME_WIDTH = 64;
export const rollerIconSize = (brushWidth: number, scale: number) =>
  Math.max(20, Math.min(110, (brushWidth * ROLLER_VIEWBOX / ROLLER_FRAME_WIDTH) * scale));

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
  ctx.font = `${Math.round(11 * scale)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  const w = ctx.measureText(name).width + 10 * scale;
  ctx.fillStyle = "rgba(20,20,20,0.55)";
  roundRect(ctx, x - w / 2, y, w, 15 * scale, 6 * scale);
  ctx.fill();
  ctx.fillStyle = "white";
  ctx.fillText(name, x, y + 11 * scale);
};

/** Power-up markers: lightning bolt (speed), roller drum (giant roller), starburst (splash). */
export const drawPowerup = (ctx: CanvasRenderingContext2D, x: number, y: number, kind: PowerupKind, size: number, pulse: number) => {
  const s = (size / 24) * (1 + pulse * 0.06);
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = "white";
  ctx.strokeStyle = "rgba(20,20,20,0.85)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, 13 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#1f2937";
  if (kind === "speed") {
    ctx.beginPath();
    ctx.moveTo(1 * s, -8 * s); ctx.lineTo(-5 * s, 1 * s); ctx.lineTo(-0.5 * s, 1 * s);
    ctx.lineTo(-2 * s, 8 * s); ctx.lineTo(5 * s, -1 * s); ctx.lineTo(0.5 * s, -1 * s);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "roller") {
    roundRect(ctx, -6 * s, -5 * s, 12 * s, 6 * s, 1.4 * s);
    ctx.fill();
    ctx.fillRect(-1 * s, 1 * s, 2 * s, 6 * s);
  } else {
    // splash: eight-point starburst
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a1 = (Math.PI / 4) * i, a2 = a1 + Math.PI / 8;
      const rOuter = 9 * s, rInner = 3.5 * s;
      ctx.lineTo(Math.cos(a1) * rOuter, Math.sin(a1) * rOuter);
      ctx.lineTo(Math.cos(a2) * rInner, Math.sin(a2) * rInner);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
};

