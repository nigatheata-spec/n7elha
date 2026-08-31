// ── Don't Look Down — pixel renderer ────────────────────────────────────────
// Everything here draws into a SMALL canvas (a few hundred pixels across) that
// the browser then scales up with nearest-neighbour via `image-rendering`.
// That is what makes the mode read as a real pixel game rather than pixel-art
// stickers pasted onto smooth vector art: the character, the sky, the clouds,
// the ground and the generated blocks all sit on one shared pixel grid.
//
// Two rules keep it honest, and breaking either is what makes pixel art look
// cheap:
//   1. Never scale a block. Each PNG is baked to its exact drawn size, so it
//      is blitted 1:1. No drawImage(...w,h) with a computed size, ever.
//   2. Snap every coordinate to whole buffer pixels. A sub-pixel camera makes
//      the whole scene shimmer as it scrolls.

import { BLOCKS, type BlockId } from "./dldArt";
import { PX, type Theme } from "./dldLevel";

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
  skin: "#f2c9a0", skinShade: "#d9a87d",
  pants: "#37406e", pantsShade: "#28305a",
  boot: "#2a2018",
  eye: "#12151f",
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
// 16×22, drawn from a string grid. Feet sit on the last row so the sprite can
// be planted exactly on the collision box's bottom edge.
const HEAD = [
  ".....oooooo.....",
  "...ooSSSSSSoo...",
  "..oSSSSSSSSSSo..",
  "..oSSSSSSSSSSo..",
  "..oSSEESSEESSo..",
  "..oSSEESSEESSo..",
  "..oSSSSSSSSSSo..",
  "..oSSSooooSSSo..",
  "...oSSSSSSSSo...",
  "....oooooooo....",
];
const TORSO = [
  "...oCCCCCCCCo...",
  "..oCCCCCCCCCCo..",
  ".oCCCCCCCCCCCCo.",
  ".oSCCCCCCCCCCSo.",
  ".oSCCCCCCCCCCSo.",
  ".ooCCCCCCCCCCoo.",
  "..oCCCCCCCCCCo..",
];
const LEGS = {
  stand: [
    "..oPPPPPPPPPPo..",
    "..oPPPPPPPPPPo..",
    "..oPPPooooPPPo..",
    "..oPPPo..oPPPo..",
    "..oBBBo..oBBBo..",
  ],
  run1: [
    "..oPPPPPPPPPPo..",
    "..oPPPPPPPPPPo..",
    ".oPPPPoooPPPo...",
    ".oPPPo...oPPPo..",
    ".oBBBo....oBBBo.",
  ],
  run2: [
    "..oPPPPPPPPPPo..",
    "..oPPPPPPPPPPo..",
    "...oPPPoooPPPPo.",
    "..oPPPo...oPPPo.",
    ".oBBBo....oBBBo.",
  ],
  jump: [
    "..oPPPPPPPPPPo..",
    ".oPPPPPPPPPPPPo.",
    ".oPPPo....oPPPo.",
    "oBBBo......oBBBo",
    "................",
  ],
};

export const SPRITE_W = 16;
export const SPRITE_H = 22;

/**
 * `feetX` is the LEFT edge of the collision box and `feetY` is the box's
 * standing surface (the game stores a player's y as the point their feet rest
 * on), so the sprite is grown upward from there.
 */
export const drawCharacter = (
  ctx: CanvasRenderingContext2D,
  feetX: number, feetY: number, boxW: number, _boxH: number,
  color: string, face: 1 | -1,
  opts: { t?: number; vx?: number; grounded?: boolean; alpha?: number; frozen?: boolean } = {},
) => {
  const { t = 0, vx = 0, grounded = true, alpha = 1, frozen = false } = opts;

  const moving = Math.abs(vx) > 20;
  const legs = !grounded
    ? LEGS.jump
    : moving
      ? (Math.floor(t * 11) % 2 === 0 ? LEGS.run1 : LEGS.run2)
      : LEGS.stand;

  // Idle bob — one pixel, on the grid.
  const bob = grounded && !moving ? (Math.floor(t * 2) % 2) : 0;

  const rows = [...HEAD, ...TORSO, ...legs];
  const shade = hexMix(color, "#000000", 0.28);

  // Plant the sprite's feet on the surface, centred on the box.
  const ox = Math.round(feetX + boxW / 2 - SPRITE_W / 2);
  const oy = Math.round(feetY - SPRITE_H) + bob;

  if (alpha < 1) ctx.globalAlpha = alpha;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === ".") continue;
      let fill: string;
      switch (ch) {
        case "o": fill = C.outline; break;
        case "S": fill = C.skin; break;
        case "E": fill = frozen ? "#8899aa" : C.eye; break;
        case "C": fill = color; break;
        case "P": fill = C.pants; break;
        case "B": fill = C.boot; break;
        default: continue;
      }
      // Mirror horizontally when facing left, still on whole pixels.
      const px = face === -1 ? ox + (SPRITE_W - 1 - c) : ox + c;
      ctx.fillStyle = fill;
      ctx.fillRect(px, oy + r, 1, 1);
    }
  }

  // A one-pixel shade down the trailing side gives the sprite a little volume.
  ctx.fillStyle = shade;
  const sx = face === -1 ? ox + 2 : ox + SPRITE_W - 3;
  ctx.fillRect(sx, oy + 11, 1, 5);

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
