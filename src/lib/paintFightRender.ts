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

/**
 * Stamp a single grid cell as an independent filled dot, sized to overlap its
 * neighbors (radius > half the cell's diagonal) so a solid block of claimed
 * cells reads as one seamless area with no gaps. Used only to reconstruct
 * ownership from the append-only log (initial history load + realtime
 * INSERT echoes) — never for live movement. That distinction matters: a
 * single flush can carry a whole disc of cells claimed this tick in
 * grid-scan order, and connecting those centers with strokeTo lines (like
 * live movement does) draws chaotic lines criss-crossing the disc — visually
 * a "circle that keeps expanding" every flush. Independent dots have no
 * order to get wrong.
 */
export const stampCell = (layer: HTMLCanvasElement, x: number, y: number, hue: number, cellSize: number) => {
  const ctx = layer.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = hueFill(hue);
  ctx.beginPath();
  ctx.arc(x, y, cellSize * 0.62, 0, Math.PI * 2);
  ctx.fill();
};

/**
 * Deterministic pseudo-random generator seeded from a world position, so the
 * same splash always renders the same jagged silhouette (useful if a client
 * needs to redraw/replay it) without needing to store the shape.
 */
const seededRandom = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Paint an irregular ink-splatter blot directly onto the layer — for the
 * splash power-up's instant one-off burst. A real splash isn't a disc: it's
 * a ragged central blob with a scatter of separate droplets flung outward.
 * Permanent (painted straight onto the persistent layer), so it stays part
 * of the player's territory exactly like a stroke does.
 */
export const fillSplash = (layer: HTMLCanvasElement, x: number, y: number, radius: number, hue: number) => {
  const ctx = layer.getContext("2d");
  if (!ctx) return;
  const rand = seededRandom((x * 73856093) ^ (y * 19349663));
  ctx.fillStyle = hueFill(hue);

  // Ragged central blob: a closed loop of points at varying radii, smoothed
  // through their midpoints so the outline is organic rather than starry.
  const spikes = 12;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2;
    const r = radius * (0.55 + rand() * 0.55);
    pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
  }
  ctx.beginPath();
  const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const start = mid(pts[pts.length - 1], pts[0]);
  ctx.moveTo(start.x, start.y);
  for (let i = 0; i < pts.length; i++) {
    const next = pts[(i + 1) % pts.length];
    const m = mid(pts[i], next);
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y);
  }
  ctx.closePath();
  ctx.fill();

  // Flung droplets, scattered around the outside of the main blob.
  const dropletCount = 7;
  for (let i = 0; i < dropletCount; i++) {
    const a = rand() * Math.PI * 2;
    const dist = radius * (0.85 + rand() * 0.55);
    const dr = radius * (0.07 + rand() * 0.12);
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * dist, y + Math.sin(a) * dist, dr, 0, Math.PI * 2);
    ctx.fill();
  }
};

export interface SplashFx { x: number; y: number; radius: number; startedAt: number; }
const SPLASH_FX_DURATION_MS = 260;

/** Brief transient flash on the overlay (not the paint layer) that reads as the moment of impact — separate from the permanent blot painted by fillSplash. Returns false once expired so callers can drop it. */
export const drawSplashFx = (
  ctx: CanvasRenderingContext2D, fx: SplashFx, scale: number, offX: number, offY: number,
): boolean => {
  const elapsed = Date.now() - fx.startedAt;
  if (elapsed > SPLASH_FX_DURATION_MS) return false;
  const t = elapsed / SPLASH_FX_DURATION_MS;
  const ease = 1 - Math.pow(1 - t, 3);
  const x = offX + fx.x * scale, y = offY + fx.y * scale;
  ctx.save();
  ctx.globalAlpha = (1 - t) * 0.5;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x, y, fx.radius * scale * (0.25 + ease * 0.85), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  return true;
};

/** Blit the accumulated paint layer onto the visible, scaled/letterboxed canvas — the whole arena, used by the teacher overview. */
export const blitPaintLayer = (
  ctx: CanvasRenderingContext2D, layer: HTMLCanvasElement,
  offX: number, offY: number, scale: number,
) => {
  ctx.drawImage(layer, offX, offY, layer.width * scale, layer.height * scale);
};

export interface Camera { x: number; y: number; halfW: number; halfH: number; }

/**
 * A player's on-screen camera, centered on them at a fixed zoom rather than
 * shrinking the whole arena to fit — the paper.io-style "local view", not a
 * bird's-eye map. Clamped so the visible window never shows past the arena
 * edge (unless the arena itself is smaller than the window, an edge case for
 * tiny lobbies).
 */
export const computeCamera = (
  px: number, py: number, cssW: number, cssH: number, scale: number, worldW: number, worldH: number,
): Camera => {
  const halfW = cssW / scale / 2, halfH = cssH / scale / 2;
  const clampAxis = (v: number, half: number, worldLen: number) =>
    worldLen <= half * 2 ? worldLen / 2 : Math.max(half, Math.min(worldLen - half, v));
  return { x: clampAxis(px, halfW, worldW), y: clampAxis(py, halfH, worldH), halfW, halfH };
};

/** Blit only the camera's visible slice of the paint layer, at a fixed zoom — the student's local view. */
export const blitPaintLayerCamera = (
  ctx: CanvasRenderingContext2D, layer: HTMLCanvasElement, cam: Camera, cssW: number, cssH: number, scale: number,
) => {
  const srcX = Math.max(0, cam.x - cam.halfW), srcY = Math.max(0, cam.y - cam.halfH);
  const srcW = Math.min(layer.width - srcX, cam.halfW * 2), srcH = Math.min(layer.height - srcY, cam.halfH * 2);
  if (srcW <= 0 || srcH <= 0) return;
  const destX = (srcX - (cam.x - cam.halfW)) * scale, destY = (srcY - (cam.y - cam.halfH)) * scale;
  ctx.drawImage(layer, srcX, srcY, srcW, srcH, destX, destY, srcW * scale, srcH * scale);
};

/**
 * Small corner overview of the whole arena — the shrunk full-map paper.io
 * keeps onscreen so a zoomed-in local camera doesn't leave players lost.
 * Draws the painted territory at a glance, every player as a dot, and a
 * rectangle marking the current camera's visible window.
 */
export const drawMinimap = (
  ctx: CanvasRenderingContext2D, layer: HTMLCanvasElement, cam: Camera,
  worldW: number, worldH: number,
  players: { x: number; y: number; hue: number }[],
  box: { x: number; y: number; w: number; h: number },
) => {
  ctx.save();
  ctx.fillStyle = "rgba(20,16,10,0.55)";
  roundRect(ctx, box.x, box.y, box.w, box.h, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, box.x, box.y, box.w, box.h, 8);
  ctx.stroke();

  ctx.beginPath();
  roundRect(ctx, box.x + 3, box.y + 3, box.w - 6, box.h - 6, 6);
  ctx.clip();
  const mScale = Math.min((box.w - 6) / worldW, (box.h - 6) / worldH);
  const mOffX = box.x + 3 + ((box.w - 6) - worldW * mScale) / 2;
  const mOffY = box.y + 3 + ((box.h - 6) - worldH * mScale) / 2;
  ctx.fillStyle = PF_PALETTE.bg;
  ctx.fillRect(mOffX, mOffY, worldW * mScale, worldH * mScale);
  ctx.drawImage(layer, mOffX, mOffY, worldW * mScale, worldH * mScale);

  // camera viewport rectangle
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 1.2;
  ctx.strokeRect(
    mOffX + (cam.x - cam.halfW) * mScale, mOffY + (cam.y - cam.halfH) * mScale,
    cam.halfW * 2 * mScale, cam.halfH * 2 * mScale,
  );

  // player dots
  for (const p of players) {
    ctx.fillStyle = hueFill(p.hue);
    ctx.beginPath();
    ctx.arc(mOffX + p.x * mScale, mOffY + p.y * mScale, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
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
  // Pivot on the striped core's center (x:150-178 → mid 164, y:44-186 → mid
  // 115) — the part that's actually colored and lays down paint — not the
  // handle. (x,y) is always exactly where paint is being stroked, so the
  // pivot has to be the drum, otherwise the drum renders ~62 viewBox units
  // away from the point it's supposedly painting, and the trail visibly
  // trails off from underneath the handle instead of the roller head.
  const cx = 164, cy = 115;
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

// A stroke's "width" (BRUSH_WIDTH/strokeTo's lineWidth) is measured
// PERPENDICULAR to the direction of travel. Local +x in this function is the
// travel direction (that's the axis `angle` rotates onto), so the drum
// dimension that corresponds to stroke width is its LOCAL-Y extent — the
// core's height (roundRect(150,44,28,142,...) above spans y:44..186, a
// 142-unit run crosswise to travel), not its local-x width (28, the drum's
// depth/thickness viewed from the side, irrelevant to stroke width). Size
// the icon so that, once scaled to screen, this crosswise extent is exactly
// as wide as the world-space paint stroke — anchoring on the depth instead
// (an easy axis mixup) leaves the drum looking 2-3x wider than the trail no
// matter how "correctly" the depth is matched. No upper cap: the camera
// runs at a fixed zoom (not a shrink-to-fit scale that could blow up), so
// this must stay free to grow — the giant roller power-up doubles
// brushWidth and needs the icon to visibly double with it.
const ROLLER_VIEWBOX = 200;
const ROLLER_CORE_LENGTH = 142;
export const rollerIconSize = (brushWidth: number, scale: number) =>
  Math.max(20, (brushWidth * ROLLER_VIEWBOX / ROLLER_CORE_LENGTH) * scale);

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

