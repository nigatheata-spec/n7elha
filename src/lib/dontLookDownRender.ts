// ── Don't Look Down — shared canvas painting ────────────────────────────────
// Bright daytime sky, pixel clouds, stone-brick platforms on pillars.
// Both the student view and the teacher tower view draw from here so the
// two never drift apart visually.

import { SUMMIT_Y } from "./dontLookDown";

export const PALETTE = {
  skyTop:    "#5fc5ef",
  skyMid:    "#8bd9f7",
  skyLow:    "#b6e8fb",
  cloud:     "#ffffff",
  cloudShade: "#dcf1fb",
  stoneLight: "#aeb7c4",   // top course
  stoneLip:   "#d3dae2",   // highlight line on the very top
  stoneBody:  "#39424f",   // main slab
  stoneMortar:"#4b5666",   // brick seams
  stoneDark:  "#2b323d",   // pillars
  cpLight:    "#7fe0a2",   // checkpoint variants
  cpBody:     "#2c6b47",
  tagBg:      "rgba(24,30,42,0.88)",
};

// ── Cloud field ─────────────────────────────────────────────────────────────
type Cloud = { x: number; y: number; s: number; depth: number };
export const CLOUDS: Cloud[] = (() => {
  let seed = 20260807;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const out: Cloud[] = [];
  for (let i = 0; i < 110; i++) {
    out.push({
      x: rnd() * 4200 - 1100,
      y: rnd() * (SUMMIT_Y + 900) - 300,
      s: 0.5 + rnd() * 1.1,
      depth: 0.25 + rnd() * 0.5,   // 0 = painted on the sky, 1 = moves with the world
    });
  }
  return out;
})();

/** One fluffy cloud built from overlapping blobs, drawn in screen space. */
export const drawCloud = (ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) => {
  const puff = (dx: number, dy: number, r: number) => {
    ctx.beginPath();
    ctx.arc(cx + dx * s, cy + dy * s, r * s, 0, Math.PI * 2);
    ctx.fill();
  };
  // soft underside first, then the bright body on top
  ctx.fillStyle = PALETTE.cloudShade;
  puff(-30, 8, 24); puff(0, 12, 30); puff(32, 8, 22); puff(14, 2, 26);
  ctx.fillStyle = PALETTE.cloud;
  puff(-30, 2, 23); puff(-8, -8, 29); puff(18, -4, 25); puff(38, 3, 19);
};

export const drawSky = (ctx: CanvasRenderingContext2D, w: number, h: number, altitude: number) => {
  // Slightly deeper blue the higher the camera is, but never night.
  const t = Math.max(0, Math.min(1, altitude));
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, `hsl(${199 + t * 6} ${78 - t * 10}% ${58 - t * 14}%)`);
  g.addColorStop(0.55, `hsl(${197 + t * 4} ${82 - t * 8}% ${70 - t * 12}%)`);
  g.addColorStop(1, `hsl(196 ${86 - t * 6}% ${82 - t * 12}%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // faint horizontal banding, like the reference's pixel sky
  ctx.fillStyle = "rgba(255,255,255,0.045)";
  for (let y = 0; y < h; y += 6) ctx.fillRect(0, y, w, 3);
};

// ── Platforms ───────────────────────────────────────────────────────────────
/**
 * A stone slab: bright top course, dark brick body, and two pillars dropping
 * out of the underside so platforms read as built structures, not floating bars.
 */
export const drawPlatform = (
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
  opts: { checkpoint?: boolean; scale?: number; pillars?: boolean } = {},
) => {
  const s = opts.scale ?? 1;
  const cp = !!opts.checkpoint;
  const topH = 11 * s;
  const bodyH = 15 * s;
  const block = 24 * s;

  // Pillars — drawn first so the slab overlaps their tops
  if (opts.pillars !== false) {
    const pw = Math.min(26 * s, w * 0.22);
    const ph = 120 * s;
    ctx.fillStyle = PALETTE.stoneDark;
    for (const px of [x + 5 * s, x + w - pw - 5 * s]) {
      if (w < 60 * s && px !== x + 5 * s) continue; // narrow ledges get one leg
      ctx.fillRect(px, y + topH, pw, ph);
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.fillRect(px, y + topH, 3 * s, ph);
      ctx.fillStyle = PALETTE.stoneDark;
      // brick seams down the pillar
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      for (let yy = y + topH; yy < y + topH + ph; yy += block * 0.7) {
        ctx.fillRect(px, yy, pw, Math.max(1, 1.5 * s));
      }
      ctx.fillStyle = PALETTE.stoneDark;
    }
  }

  // Dark body with a running-bond brick pattern
  ctx.fillStyle = cp ? PALETTE.cpBody : PALETTE.stoneBody;
  ctx.fillRect(x, y + topH, w, bodyH);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(x, y + topH + bodyH * 0.55, w, Math.max(1, 1.5 * s));
  for (let i = 0, bx = x; bx < x + w; i++, bx += block) {
    const off = i % 2 === 0 ? 0 : block / 2;
    const sx = bx + off;
    if (sx > x && sx < x + w) ctx.fillRect(sx, y + topH, Math.max(1, 1.5 * s), bodyH);
  }

  // Bright top course
  ctx.fillStyle = cp ? PALETTE.cpLight : PALETTE.stoneLight;
  ctx.fillRect(x, y, w, topH);
  ctx.fillStyle = cp ? "#b6f5cd" : PALETTE.stoneLip;
  ctx.fillRect(x, y, w, Math.max(1.5, 3 * s));
  // vertical seams in the top course
  ctx.fillStyle = "rgba(0,0,0,0.14)";
  for (let bx = x + block; bx < x + w; bx += block) {
    ctx.fillRect(bx, y, Math.max(1, 1.5 * s), topH);
  }

  if (cp) {
    // soft green glow so checkpoints are readable at a glance
    ctx.fillStyle = "rgba(74,222,128,0.20)";
    ctx.fillRect(x, y - 30 * s, w, 30 * s);
  }
};

// ── Character ───────────────────────────────────────────────────────────────
/**
 * Big-headed blob with oversized eyes, matching the reference's silhouette.
 * `x`,`y` is the bottom-left of the character's footprint.
 */
export const drawCharacter = (
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  color: string, face: number, opts: { frozen?: boolean; alpha?: number } = {},
) => {
  const a = opts.alpha ?? 1;
  ctx.save();
  ctx.globalAlpha = a;

  const body = opts.frozen ? "#94a3b8" : color;
  const cx = x + w / 2;
  const headR = w * 0.56;
  const headCy = y - h + headR * 0.92;

  // little feet/body stub under the head
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(cx - w * 0.30, headCy + headR * 0.45, w * 0.60, h - (headCy + headR * 0.45 - (y - h)) - 2, 4);
  ctx.fill();

  // head
  ctx.beginPath();
  ctx.ellipse(cx, headCy, headR, headR * 1.06, 0, 0, Math.PI * 2);
  ctx.fill();
  // darker rim for that sticker-like outline
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = Math.max(1.5, w * 0.07);
  ctx.stroke();

  // eyes — large, angled slightly, following the facing direction
  const eyeDX = w * 0.20 * (face >= 0 ? 1 : -1);
  const eyeW = w * 0.20, eyeH = w * 0.28;
  ctx.fillStyle = "#14181f";
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + eyeDX * 0.55 + s * w * 0.21, headCy - headR * 0.05, eyeW, eyeH, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // glints
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + eyeDX * 0.55 + s * w * 0.21 - eyeW * 0.28, headCy - headR * 0.28, eyeW * 0.30, eyeH * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

/** Rounded dark pill with the player's name, as seen under the reference character. */
export const drawNameTag = (
  ctx: CanvasRenderingContext2D,
  cx: number, y: number, name: string, scale = 1,
) => {
  if (!name) return;
  const fs = 12 * scale;
  ctx.font = `700 ${fs}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const padX = 7 * scale, h = fs + 8 * scale;
  const w = ctx.measureText(name).width + padX * 2;
  ctx.fillStyle = PALETTE.tagBg;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillText(name, cx, y + h / 2 + 0.5);
};
