// ── Don't Look Down — shared canvas painting ────────────────────────────────
// Plain sky, stone-brick platforms, simple hazards — placeholder art until
// real assets are dropped in for the platforms/biomes (they're still
// objects, not animated sprites, so a static image per material/biome is
// low-risk to swap in later). The character is the one piece that stays
// fully custom-drawn. Both the student view and the teacher spotlight draw
// from here so the two never drift apart visually. See dontLookDownLevel.ts
// for the level generator that produces the Platform/Hazard/Biome data.

import { mulberry32 } from "./dontLookDownLevel";

const TAG_BG = "rgba(24,30,42,0.88)";

const PALETTE = {
  skyTop: 199, skySat: 80,
  stoneLight: "#aeb7c4", stoneLip: "#d3dae2", stoneBody: "#39424f", stoneDark: "#2b323d",
};

// ── Sky ───────────────────────────────────────────────────────────────────
export const drawSky = (ctx: CanvasRenderingContext2D, w: number, h: number, y: number) => {
  const shade = 1 - 1 / (1 + Math.max(0, y) / 5000);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, `hsl(${PALETTE.skyTop} ${PALETTE.skySat}% ${58 - shade * 16}%)`);
  g.addColorStop(0.55, `hsl(${PALETTE.skyTop + 3} ${PALETTE.skySat - 4}% ${68 - shade * 14}%)`);
  g.addColorStop(1, `hsl(${PALETTE.skyTop - 2} ${PALETTE.skySat + 2}% ${80 - shade * 10}%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.045)";
  for (let yy = 0; yy < h; yy += 6) ctx.fillRect(0, yy, w, 3);
};

export const drawTopFog = (ctx: CanvasRenderingContext2D, w: number, h: number, y: number) => {
  const shade = 1 - 1 / (1 + Math.max(0, y) / 5000);
  const lig = 58 - shade * 16;
  const band = Math.max(90, h * 0.22);
  const g = ctx.createLinearGradient(0, 0, 0, band);
  g.addColorStop(0, `hsl(${PALETTE.skyTop} ${PALETTE.skySat}% ${lig}% / 0.92)`);
  g.addColorStop(0.45, `hsl(${PALETTE.skyTop} ${PALETTE.skySat}% ${lig}% / 0.45)`);
  g.addColorStop(1, `hsl(${PALETTE.skyTop} ${PALETTE.skySat}% ${lig}% / 0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, band);
};

// ── Clouds ────────────────────────────────────────────────────────────────
export const drawCloud = (ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) => {
  const puff = (dx: number, dy: number, r: number) => {
    ctx.beginPath();
    ctx.arc(cx + dx * s, cy + dy * s, r * s, 0, Math.PI * 2);
    ctx.fill();
  };
  ctx.fillStyle = "#dcf1fb";
  puff(-30, 8, 24); puff(0, 12, 30); puff(32, 8, 22); puff(14, 2, 26);
  ctx.fillStyle = "#ffffff";
  puff(-30, 2, 23); puff(-8, -8, 29); puff(18, -4, 25); puff(38, 3, 19);
};

type AmbientParticle = { x: number; y: number; s: number; depth: number };
const ambientCache = new Map<number, AmbientParticle[]>();
/** Deterministic per-band cloud field — generated on demand, cached forever, no unbounded global array. */
export const ambientFor = (band: { startY: number; endY: number }): AmbientParticle[] => {
  let arr = ambientCache.get(band.startY);
  if (arr) return arr;
  const rng = mulberry32(Math.floor(band.startY) * 7919 + 13);
  arr = [];
  for (let i = 0; i < 14; i++) {
    arr.push({
      x: rng() * 1500 - 380,
      y: band.startY + rng() * (band.endY - band.startY),
      s: 0.5 + rng() * 1.0,
      depth: 0.22 + rng() * 0.55,
    });
  }
  ambientCache.set(band.startY, arr);
  return arr;
};

// ── Ground floor ──────────────────────────────────────────────────────────
/** The solid floor at the base of the climb — spans the full screen width so it always reaches, unlike a normal platform. `y` is its screen-space top edge. */
export const drawGround = (ctx: CanvasRenderingContext2D, y: number, screenW: number, screenH: number) => {
  const topH = 14;
  const bodyH = Math.max(0, screenH - y);
  const grad = ctx.createLinearGradient(0, y, 0, y + bodyH);
  grad.addColorStop(0, PALETTE.stoneBody);
  grad.addColorStop(1, "#1c2128");
  ctx.fillStyle = grad;
  ctx.fillRect(0, y, screenW, bodyH);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  for (let x = 0; x < screenW; x += 48) ctx.fillRect(x, y + topH, 1.5, bodyH - topH);
  ctx.fillStyle = PALETTE.stoneLight;
  ctx.fillRect(0, y, screenW, topH);
  ctx.fillStyle = PALETTE.stoneLip;
  ctx.fillRect(0, y, screenW, 3);
  ctx.fillStyle = "rgba(0,0,0,0.14)";
  for (let x = 0; x < screenW; x += 24) ctx.fillRect(x, y, 1.5, topH);
};

// ── Platforms ───────────────────────────────────────────────────────────────
export const PLATFORM_DRAW_ABOVE = 30;
export const PLATFORM_DRAW_BELOW = 11 + 120;

export const drawPlatform = (
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
  opts: { scale?: number; pillars?: boolean; crumbleT?: number; bounceT?: number; t?: number } = {},
) => {
  const s = opts.scale ?? 1;
  const topH = 11 * s, bodyH = 15 * s, block = 24 * s;
  const crumbleT = opts.crumbleT ?? 0;
  const t = opts.t ?? 0;
  const shakeX = crumbleT > 0 ? Math.sin(t * 60) * crumbleT * 3 : 0;

  ctx.save();
  ctx.globalAlpha *= (1 - crumbleT);
  ctx.translate(shakeX, 0);

  if (opts.pillars !== false) {
    const pw = Math.min(26 * s, w * 0.22), ph = 120 * s;
    for (const px of [x + 5 * s, x + w - pw - 5 * s]) {
      if (w < 60 * s && px !== x + 5 * s) continue;
      ctx.fillStyle = PALETTE.stoneDark;
      ctx.fillRect(px, y + topH, pw, ph);
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.fillRect(px, y + topH, 3 * s, ph);
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      for (let yy = y + topH; yy < y + topH + ph; yy += block * 0.7) ctx.fillRect(px, yy, pw, Math.max(1, 1.5 * s));
    }
  }

  ctx.fillStyle = PALETTE.stoneBody;
  ctx.fillRect(x, y + topH, w, bodyH);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(x, y + topH + bodyH * 0.55, w, Math.max(1, 1.5 * s));
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  for (let i = 0, bx = x; bx < x + w; i++, bx += block) {
    const off = i % 2 === 0 ? 0 : block / 2;
    const sx = bx + off;
    if (sx > x && sx < x + w) ctx.fillRect(sx, y + topH, Math.max(1, 1.5 * s), bodyH);
  }

  ctx.fillStyle = PALETTE.stoneLight;
  ctx.fillRect(x, y, w, topH);
  ctx.fillStyle = PALETTE.stoneLip;
  ctx.fillRect(x, y, w, Math.max(1.5, 3 * s));
  ctx.fillStyle = "rgba(0,0,0,0.14)";
  for (let bx = x + block; bx < x + w; bx += block) ctx.fillRect(bx, y, Math.max(1, 1.5 * s), topH);

  if (crumbleT > 0.01) {
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = Math.max(1, 1.4 * s);
    ctx.beginPath();
    ctx.moveTo(x + w * 0.3, y); ctx.lineTo(x + w * 0.42, y + topH + bodyH * 0.5);
    ctx.moveTo(x + w * 0.65, y); ctx.lineTo(x + w * 0.55, y + topH + bodyH * 0.6);
    ctx.stroke();
  }

  if (opts.bounceT && opts.bounceT > 0) {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y - 4 * s, w * 0.32 * (1 + opts.bounceT * 0.4), 6 * s * (1 - opts.bounceT), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
};

// ── Hazards ───────────────────────────────────────────────────────────────
export const drawSpikes = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number) => {
  const n = Math.max(3, Math.round(w / 16));
  const spikeW = w / n;
  ctx.fillStyle = "#dc2626";
  for (let i = 0; i < n; i++) {
    const sx = x + i * spikeW;
    ctx.beginPath();
    ctx.moveTo(sx, y);
    ctx.lineTo(sx + spikeW / 2, y - 18);
    ctx.lineTo(sx + spikeW, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(x, y, w, 4);
};

export const drawLaser = (
  ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, active: boolean, t: number,
) => {
  const pulse = 0.7 + Math.sin(t * 10) * 0.3;
  ctx.save();
  ctx.fillStyle = active ? "#ef4444" : "#7f1d1d";
  ctx.beginPath(); ctx.arc(x1, y1, 6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x2, y2, 6, 0, Math.PI * 2); ctx.fill();
  if (active) {
    ctx.strokeStyle = `rgba(239,68,68,${0.85 * pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = `rgba(254,202,202,${0.5 * pulse})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  } else {
    ctx.strokeStyle = "rgba(127,29,29,0.35)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
};

// ── Character ───────────────────────────────────────────────────────────────
const strokeCheerBrow = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) => {
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.4, r, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
};
const strokeSquint = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, dir: number) => {
  ctx.beginPath();
  ctx.moveTo(cx - r * dir, cy - r * 0.55);
  ctx.lineTo(cx + r * dir, cy);
  ctx.lineTo(cx - r * dir, cy + r * 0.55);
  ctx.stroke();
};

export type CharAnim = {
  grounded?: boolean; vx?: number; vy?: number; t?: number; landPulse?: number;
  blinkSeed?: number; frozen?: boolean; alpha?: number;
};

/**
 * The capsule-bot: a tall rounded body with two leaf nubs and two leg stubs,
 * tinted per-player. Fully procedural, and genuinely animated — idle blink,
 * a leg run-cycle while grounded and moving, legs splayed mid-air, and a
 * one-shot landing squash triggered by the caller on grounded flipping true.
 */
export const drawCharacter = (
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  color: string, face: number, anim: CharAnim = {},
) => {
  const a = anim.alpha ?? 1;
  const t = anim.t ?? 0;
  const grounded = anim.grounded ?? true;
  const vx = anim.vx ?? 0;
  const vy = anim.vy ?? 0;
  const landPulse = Math.max(0, Math.min(1, anim.landPulse ?? 0));
  const moving = grounded && Math.abs(vx) > 40;
  const seed = anim.blinkSeed ?? 0;

  ctx.save();
  ctx.globalAlpha = a;

  const body = anim.frozen ? "#94a3b8" : color;
  const cx = x + w / 2;
  const legH = h * 0.24;
  const squashY = 1 - landPulse * 0.24, squashX = 1 + landPulse * 0.18;
  const capW = w * 0.88 * squashX;
  const capH = (h - legH) * squashY;
  const capTop = y - legH - capH;
  const capCx = cx;

  // ── Legs ──
  const legW = w * 0.24;
  const airborne = !grounded;
  const splayAmt = airborne ? w * (vy > 0 ? 0.10 : 0.18) : 0;
  const runPhase = t * 11;
  ctx.fillStyle = body;
  for (const side of [-1, 1] as const) {
    const stepPhase = side < 0 ? runPhase : runPhase + Math.PI;
    const runWiggle = moving ? Math.sin(stepPhase) * w * 0.05 : 0;
    const legLift = moving ? Math.max(0, Math.sin(stepPhase)) * legH * 0.35 : 0;
    const lx = capCx + side * (w * 0.17 + splayAmt) + runWiggle;
    const legTopY = y - legH + legLift;
    ctx.beginPath();
    ctx.roundRect(lx - legW / 2, legTopY, legW, Math.max(4, y - legTopY), legW * 0.4);
    ctx.fill();
  }

  // ── Body capsule ──
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(capCx - capW / 2, capTop, capW, capH, capW * 0.46);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.26)";
  ctx.lineWidth = Math.max(1.5, w * 0.06);
  ctx.stroke();
  // soft top highlight so the capsule reads as glossy, not flat
  const sheen = ctx.createLinearGradient(0, capTop, 0, capTop + capH * 0.55);
  sheen.addColorStop(0, "rgba(255,255,255,0.30)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.beginPath();
  ctx.roundRect(capCx - capW / 2, capTop, capW, capH * 0.55, capW * 0.46);
  ctx.fill();

  // ── Leaf nubs ──
  ctx.save();
  ctx.translate(capCx - capW * 0.18, capTop + capH * 0.02);
  ctx.rotate(Math.sin(t * 1.6 + seed) * 0.06 - 0.15);
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(0, -6, 5, 10, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(7, -2, 4.5, 8.5, 0.35, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // ── Face ──
  const eyeDX = w * 0.14 * (face >= 0 ? 1 : -1);
  const eyeY = capTop + capH * 0.46;
  const eyeGap = w * 0.19;
  const eyeR = Math.max(2.4, w * 0.10);
  const blinkCycle = ((t * 1000 + seed * 971) % 3400 + 3400) % 3400;
  const blinking = blinkCycle < 130 && landPulse < 0.5;
  const squinting = landPulse >= 0.5;

  ctx.strokeStyle = "#14181f";
  ctx.lineWidth = Math.max(1.7, w * 0.075);
  ctx.lineCap = "round";
  for (const side of [-1, 1]) {
    const ex = capCx + eyeDX * 0.5 + side * eyeGap;
    if (squinting) {
      strokeSquint(ctx, ex, eyeY, eyeR * 0.85, side);
    } else if (blinking) {
      ctx.beginPath();
      ctx.moveTo(ex - eyeR * 0.7, eyeY); ctx.lineTo(ex + eyeR * 0.7, eyeY);
      ctx.stroke();
    } else {
      strokeCheerBrow(ctx, ex, eyeY - eyeR * 0.3, eyeR * 0.85);
    }
  }

  ctx.restore();
};

/** Rounded dark pill with the player's name, floating under the character. */
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
  ctx.fillStyle = TAG_BG;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillText(name, cx, y + h / 2 + 0.5);
};
