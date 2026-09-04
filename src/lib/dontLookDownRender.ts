// ── Don't Look Down — pixel renderer ────────────────────────────────────────
// Everything here draws into a SMALL canvas (a few hundred pixels across) that
// the browser then scales up with nearest-neighbour via `image-rendering`.
// That is what makes the world read as a real pixel game rather than pixel-art
// stickers pasted onto smooth vector art: the sky, the clouds, the ground and
// the generated blocks all sit on one shared pixel grid.
//
// Two rules keep the world honest, and breaking either is what makes pixel art
// look cheap:
//   1. Never scale a block. Each PNG is baked to its exact drawn size, so it
//      is blitted 1:1. No drawImage(...w,h) with a computed size, ever.
//   2. Snap every coordinate to whole buffer pixels. A sub-pixel camera makes
//      the whole scene shimmer as it scrolls.
//
// The character is the one deliberate exception — see the comment at
// `drawCharacter` for why it's a real circle instead of another pixel grid.

import { BLOCKS, type BlockId } from "./dldArt";
import { PX, type Theme } from "./dldLevel";
import { resolveColor, resolveFace } from "./avatarIdentity";

// ── Pixel canvas ────────────────────────────────────────────────────────────
/** Target width of the pixel buffer. Zoom is chosen to land near this. */
const TARGET_BUF_W = 430;

/**
 * Size the canvas backing store to the pixel buffer and let CSS blow it up.
 * The caller must set `image-rendering: pixelated` on the element.
 */
export const setupPixelCanvas = (canvas: HTMLCanvasElement) => {
  const cssW = canvas.clientWidth || 1, cssH = canvas.clientHeight || 1;
  const zoom = Math.max(2, Math.min(6, Math.round(cssW / TARGET_BUF_W))) || 2;
  const bw = Math.max(160, Math.ceil(cssW / zoom));
  const bh = Math.max(120, Math.ceil(cssH / zoom));
  if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
  const ctx = canvas.getContext("2d");
  if (ctx) { ctx.imageSmoothingEnabled = false; ctx.setTransform(1, 0, 0, 1, 0, 0); }
  return { ctx, bw, bh, zoom };
};

// ── Block images ────────────────────────────────────────────────────────────
const images = new Map<BlockId, HTMLImageElement>();
let loaded = 0;
(Object.keys(BLOCKS) as BlockId[]).forEach(id => {
  const img = new Image();
  img.onload = () => { loaded++; };
  img.src = BLOCKS[id].src;
  images.set(id, img);
});
export const blocksLoaded = () => loaded;

// ── Palette ─────────────────────────────────────────────────────────────────
const C = {
  outline: "#12151f",
  cloud: "#ffffff", cloudShade: "#d9ecf7",
  grass: "#5fa84a", grassDark: "#41823a",
  dirt: "#6b4a32", dirtDark: "#503726", dirtDeep: "#3b2819",
  tagBg: "rgba(12,16,26,0.85)", tagFg: "#ffffff",
  star: "#ffffff", starDim: "#9fb0d8",
};

/** 4×4 ordered dither — the classic way to blend two flat colours on a grid. */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const hexMix = (a: string, b: string, t: number) => {
  const p = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${m(r1, r2)},${m(g1, g2)},${m(b1, b2)})`;
};

// ── Sky ─────────────────────────────────────────────────────────────────────
/**
 * A banded, dithered sky. Instead of a smooth CSS gradient (which produces
 * thousands of colours and instantly breaks the pixel look) the ramp is drawn
 * as a handful of flat bands with a dithered seam between each pair.
 */
export const drawSky = (
  ctx: CanvasRenderingContext2D, bw: number, bh: number,
  blend: { from: Theme; to: Theme; t: number },
) => {
  const ramp = blend.from.sky.map((c, i) => hexMix(c, blend.to.sky[i] ?? c, blend.t));
  const steps = ramp.length;
  const bandH = bh / steps;

  for (let i = 0; i < steps; i++) {
    ctx.fillStyle = ramp[i];
    ctx.fillRect(0, Math.floor(i * bandH), bw, Math.ceil(bandH) + 1);
  }

  // Dither the seams so the bands read as one sky, still on the pixel grid.
  for (let i = 0; i < steps - 1; i++) {
    const seam = Math.floor((i + 1) * bandH);
    const span = Math.max(3, Math.floor(bandH * 0.45));
    ctx.fillStyle = ramp[i];
    for (let y = seam; y < seam + span && y < bh; y++) {
      const frac = 1 - (y - seam) / span;            // 1 at the seam → 0 below
      const thr = Math.round(frac * 16);
      for (let x = 0; x < bw; x++) {
        if (BAYER[y & 3][x & 3] < thr) ctx.fillRect(x, y, 1, 1);
      }
    }
  }
};

// ── Stars ───────────────────────────────────────────────────────────────────
type Star = { x: number; y: number; bright: boolean };
const STARS: Star[] = (() => {
  let s = 1337;
  const r = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  return Array.from({ length: 520 }, () => ({ x: r() * 3000, y: r() * 2600, bright: r() < 0.35 }));
})();

export const drawStars = (
  ctx: CanvasRenderingContext2D, bw: number, bh: number,
  camX: number, camY: number, alpha: number,
) => {
  if (alpha <= 0.01) return;
  ctx.globalAlpha = Math.min(1, alpha);
  for (const st of STARS) {
    // Very slow parallax so the field feels distant but not nailed to the screen.
    const x = Math.round(((st.x - camX * 0.06) % 3000 + 3000) % 3000);
    const y = Math.round(bh - ((st.y - camY * 0.06) % 2600));
    if (x < 0 || x > bw || y < 0 || y > bh) continue;
    ctx.fillStyle = st.bright ? C.star : C.starDim;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;
};

// ── Clouds ──────────────────────────────────────────────────────────────────
export type Cloud = { x: number; y: number; s: number; depth: number };
export const CLOUDS: Cloud[] = (() => {
  let seed = 20260807;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  return Array.from({ length: 120 }, () => ({
    x: rnd() * 5200 - 1400,
    y: rnd() * 4400 - 300,
    s: rnd() < 0.4 ? 1 : 2,
    depth: 0.2 + rnd() * 0.5,
  }));
})();

/** A chunky pixel cloud: stacked rectangles, no curves, no anti-aliasing. */
export const drawCloud = (ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) => {
  const x = Math.round(cx), y = Math.round(cy);
  const R = (dx: number, dy: number, w: number, h: number) =>
    ctx.fillRect(x + dx * s, y + dy * s, w * s, h * s);
  ctx.fillStyle = C.cloudShade;
  R(-9, 1, 22, 3);
  ctx.fillStyle = C.cloud;
  R(-7, -2, 16, 3);
  R(-9, -4, 8, 3);
  R(-2, -6, 8, 3);
  R(4, -4, 7, 3);
  R(-9, 1, 20, 2);
};

// ── Ground ──────────────────────────────────────────────────────────────────
export const drawGround = (ctx: CanvasRenderingContext2D, topY: number, bw: number, bh: number) => {
  const y = Math.round(topY);
  if (y > bh) return;
  ctx.fillStyle = C.dirt;
  ctx.fillRect(0, y, bw, bh - y);
  ctx.fillStyle = C.dirtDark;
  ctx.fillRect(0, y + 7, bw, bh - y - 7);
  ctx.fillStyle = C.dirtDeep;
  ctx.fillRect(0, y + 18, bw, Math.max(0, bh - y - 18));
  // grass cap
  ctx.fillStyle = C.grassDark;
  ctx.fillRect(0, y, bw, 4);
  ctx.fillStyle = C.grass;
  ctx.fillRect(0, y, bw, 2);
  // a broken lower edge so the grass doesn't read as a ruler line
  for (let x = 0; x < bw; x += 2) {
    if (((x >> 1) * 2654435761) % 3 === 0) ctx.fillRect(x, y + 2, 2, 1);
  }
  // scattered pebbles
  ctx.fillStyle = C.dirtDeep;
  for (let x = 0; x < bw; x += 7) {
    const h = ((x * 2654435761) >>> 3) % 11;
    ctx.fillRect(x + (h % 4), y + 8 + (h % 9), 1, 1);
  }
};

// ── Platforms ───────────────────────────────────────────────────────────────
/**
 * Blit a block 1:1 at its baked size. `x`/`y` are the top-left of the block's
 * box in buffer pixels, already snapped by the caller.
 */
export const drawBlock = (ctx: CanvasRenderingContext2D, x: number, y: number, id: BlockId) => {
  const img = images.get(id);
  const b = BLOCKS[id];
  if (!img || !img.complete || img.naturalWidth === 0) {
    ctx.fillStyle = "#6b7280";
    ctx.fillRect(Math.round(x), Math.round(y), b.w, b.h);
    return;
  }
  ctx.drawImage(img, Math.round(x), Math.round(y));
};

// ── Character ───────────────────────────────────────────────────────────────
// The character IS the player's avatar — same hashed face + color as their
// circle everywhere else in the app (lobby roster, leaderboards, results) —
// with two stubby legs added so it can stand on a platform. Drawn as a real
// circle rather than on the blocky ASCII grid the rest of this file uses:
// nearest-neighbour upscaling (the canvas's own `image-rendering: pixelated`)
// still chunks its edges at final size, which is enough to keep it feeling
// like it belongs in the pixel world without losing what makes it recognizable
// as "their" avatar.

export const SPRITE_W = 22;
export const SPRITE_H = 28;

const faceImageCache = new Map<string, HTMLImageElement>();
const getFaceImage = (src: string) => {
  let img = faceImageCache.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    faceImageCache.set(src, img);
  }
  return img;
};

const CIRCLE_D = 20;
const LEG_W = 4;
const LEG_H = 8;
const LEG_GAP = 3;
const LEG_TUCK = 4; // legs start this far above the circle's bottom edge

/**
 * `feetX` is the LEFT edge of the collision box and `feetY` is the box's
 * standing surface (the game stores a player's y as the point their feet rest
 * on), so the sprite is grown upward from there.
 */
export const drawCharacter = (
  ctx: CanvasRenderingContext2D,
  feetX: number, feetY: number, boxW: number, _boxH: number,
  name: string, _face: 1 | -1,
  opts: { t?: number; vx?: number; grounded?: boolean; alpha?: number; frozen?: boolean; colorIndex?: number | null; faceIndex?: number | null } = {},
) => {
  const { t = 0, vx = 0, grounded = true, alpha = 1, frozen = false, colorIndex, faceIndex } = opts;
  const color = resolveColor(name, colorIndex);

  const moving = Math.abs(vx) > 20;
  // A simple alternating stride: one leg a little longer, one a little shorter.
  const stride = !grounded ? 0 : moving ? (Math.floor(t * 11) % 2 === 0 ? 1 : -1) : 0;
  const legHL = LEG_H + (stride > 0 ? 2 : stride < 0 ? -2 : 0);
  const legHR = LEG_H + (stride < 0 ? 2 : stride > 0 ? -2 : 0);
  const legH = Math.max(legHL, legHR);

  // Idle bob — one pixel, on the grid.
  const bob = grounded && !moving ? (Math.floor(t * 2) % 2) : 0;

  const totalH = CIRCLE_D + legH - LEG_TUCK;
  const ox = Math.round(feetX + boxW / 2 - SPRITE_W / 2);
  const oy = Math.round(feetY - totalH) + bob;
  const cx = ox + SPRITE_W / 2;
  const cyTop = oy;

  if (alpha < 1) ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = true;

  // Legs, drawn first so the circle covers where they tuck in underneath it.
  const legsTopY = cyTop + CIRCLE_D - LEG_TUCK;
  const lx = cx - LEG_GAP / 2 - LEG_W;
  const rx = cx + LEG_GAP / 2;
  ctx.fillStyle = C.outline;
  ctx.fillRect(Math.round(lx) - 1, Math.round(legsTopY) - 1, LEG_W + 2, legHL + 1);
  ctx.fillRect(Math.round(rx) - 1, Math.round(legsTopY) - 1, LEG_W + 2, legHR + 1);
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(lx), Math.round(legsTopY), LEG_W, legHL);
  ctx.fillRect(Math.round(rx), Math.round(legsTopY), LEG_W, legHR);

  // The circle itself — outline ring, then the fill, then the face on top.
  const r = CIRCLE_D / 2;
  ctx.beginPath();
  ctx.arc(cx, cyTop + r, r + 1, 0, Math.PI * 2);
  ctx.fillStyle = C.outline;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cyTop + r, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  const img = getFaceImage(resolveFace(name, faceIndex));
  if (img.complete && img.naturalWidth > 0) {
    const fd = CIRCLE_D * 1.15;
    ctx.drawImage(img, cx - fd / 2, cyTop + r - fd / 2, fd, fd);
  }

  if (frozen) {
    ctx.beginPath();
    ctx.arc(cx, cyTop + r, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(150,200,255,0.45)";
    ctx.fill();
  }

  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;
};

// ── Name tags ───────────────────────────────────────────────────────────────
export const drawNameTag = (
  ctx: CanvasRenderingContext2D, cx: number, topY: number, name: string,
) => {
  if (!name) return;
  const label = name.length > 9 ? name.slice(0, 9) : name;
  ctx.font = "6px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const w = Math.ceil(ctx.measureText(label).width) + 4;
  const x = Math.round(cx - w / 2), y = Math.round(topY) - 9;
  ctx.fillStyle = C.tagBg;
  ctx.fillRect(x, y, w, 8);
  ctx.fillStyle = C.tagFg;
  ctx.fillText(label, Math.round(cx), y + 1);
  ctx.textAlign = "left";
};

// ── Atmosphere ──────────────────────────────────────────────────────────────
/**
 * Dithered haze along the top edge so blocks fade in as they scroll on instead
 * of popping at a hard cull line. Dithered rather than alpha-blended to stay
 * on the palette.
 */
export const drawTopFog = (
  ctx: CanvasRenderingContext2D, bw: number, _bh: number, blend: { from: Theme; to: Theme; t: number },
) => {
  const top = hexMix(blend.from.sky[0], blend.to.sky[0] ?? blend.from.sky[0], blend.t);
  ctx.fillStyle = top;
  const span = 16;
  for (let y = 0; y < span; y++) {
    const thr = Math.round((1 - y / span) * 16);
    for (let x = 0; x < bw; x++) {
      if (BAYER[y & 3][x & 3] < thr) ctx.fillRect(x, y, 1, 1);
    }
  }
};

export { PX };
