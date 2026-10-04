// ── Lava Floor (towers) — projector renderer ─────────────────────────────────
// Everything on the board is drawn here on one canvas, in world meters: one
// block is one meter, the lava level is in meters too, so "is my top above the
// lava" is literally what the picture shows.
//
// Draw order is what sells the depth: sky, far ridges, volcano, glow, the back
// lava sheet, the towers and the players standing on them, then the front lava
// sheet over everything it has swallowed, then embers and labels.

import { FACES, resolveColor, resolveFace } from "@/lib/avatarIdentity";
import { climbNeed, towerHeight, partialCourse, towerColor, towerName, type LfMode, type Tower } from "@/lib/lavaFloor";

export type Member = {
  id: string;
  name: string;
  color: string;        // avatar circle color
  face: number;         // index into FACES
  landAt: number;       // ms of the last brick they laid, for the hop
};

/** One tower as the board draws it. See lavaFloor.ts for what the numbers mean. */
export type BoardTower = {
  id: string;
  width: number;        // bricks per course
  courses: number;      // completed courses (meters above the floor)
  partial: number;      // bricks in the unfinished course
  color: string;        // top course + label
  label?: string;       // team / class name, drawn above the crowd
  dunked: boolean;
  climb: number;
  need: number;
  members: Member[];
};

export type Camera = { bottom: number; top: number; ppm: number };

const SKY_TOP = "#160C22";
const SKY_MID = "#2A1233";
const RIDGE_FAR = "#2E1636";
const RIDGE_NEAR = "#221029";
const STONE = ["#E6D4AF", "#DCC69B", "#D1B98C"];
const STONE_SHADE = "#A08862";
const STONE_LIGHT = "#F5EBD2";
const INK = "#140A14";

// ── assets ────────────────────────────────────────────────────────────────────
const faceImgs: HTMLImageElement[] = [];
export const faceImage = (i: number) => {
  if (!faceImgs[i]) {
    const img = new Image();
    img.src = FACES[i % FACES.length];
    faceImgs[i] = img;
  }
  return faceImgs[i];
};

// ── helpers ───────────────────────────────────────────────────────────────────
const hash = (a: number, b: number) => {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
};

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
};

/** Surface offset in px at screen x: a few slow sines, never the same twice. */
const wave = (x: number, t: number, phase: number) =>
  Math.sin(x * 0.011 + t * 1.1 + phase) * 5 +
  Math.sin(x * 0.027 - t * 1.7 + phase * 2) * 2.6 +
  Math.sin(x * 0.0047 + t * 0.45) * 7;

// ── camera ────────────────────────────────────────────────────────────────────
/** Frame the lava and every standing player; ease toward it so it never jumps. */
export const fitCamera = (prev: Camera | null, towers: BoardTower[], lava: number, h: number, padTop: number, maxPpm = 46): Camera => {
  const tallest = towers.reduce((m, t) => Math.max(m, t.courses + (t.partial ? 1 : 0)), lava);
  const bottom = Math.min(lava - 3.5, -1);
  const top = Math.max(tallest + 3.2, lava + 9);
  const ppm = Math.min(maxPpm, (h - padTop) / (top - bottom));
  const want = { bottom, top: bottom + (h - padTop) / ppm + padTop / ppm, ppm };
  if (!prev) return want;
  const k = 0.06;
  return {
    bottom: prev.bottom + (want.bottom - prev.bottom) * k,
    top: prev.top + (want.top - prev.top) * k,
    ppm: prev.ppm + (want.ppm - prev.ppm) * k,
  };
};

const sy = (cam: Camera, h: number, m: number) => h - (m - cam.bottom) * cam.ppm;

// ── background ────────────────────────────────────────────────────────────────
const drawSky = (ctx: CanvasRenderingContext2D, w: number, h: number, lavaY: number, heat: number) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, SKY_TOP);
  g.addColorStop(0.55, SKY_MID);
  g.addColorStop(1, "#4A1528");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // heat rising off the surface
  const glowH = h * (0.45 + heat * 0.25);
  const glow = ctx.createLinearGradient(0, lavaY, 0, lavaY - glowH);
  glow.addColorStop(0, `rgba(255,110,40,${0.42 + heat * 0.2})`);
  glow.addColorStop(0.35, `rgba(220,60,40,${0.16 + heat * 0.1})`);
  glow.addColorStop(1, "rgba(220,60,40,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, lavaY - glowH, w, glowH + 4);
};

const ridge = (ctx: CanvasRenderingContext2D, w: number, base: number, amp: number, seed: number, color: string) => {
  ctx.beginPath();
  ctx.moveTo(0, base + amp);
  const steps = 9;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * w;
    const y = base - hash(seed, i) * amp;
    const px = ((i - 0.5) / steps) * w;
    if (i === 0) ctx.lineTo(x, y); else ctx.quadraticCurveTo(px, base - hash(seed, i + 50) * amp * 1.1, x, y);
  }
  ctx.lineTo(w, base + amp * 4);
  ctx.lineTo(0, base + amp * 4);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
};

const drawVolcano = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, erupting: number) => {
  const cx = w * 0.72, baseY = h * 0.78, peakY = h * 0.34, half = w * 0.26, mouth = w * 0.035;
  ctx.beginPath();
  ctx.moveTo(cx - half, baseY);
  ctx.bezierCurveTo(cx - half * 0.45, baseY - (baseY - peakY) * 0.55, cx - mouth * 1.6, peakY + 20, cx - mouth, peakY);
  ctx.quadraticCurveTo(cx, peakY + 10, cx + mouth, peakY);
  ctx.bezierCurveTo(cx + mouth * 1.6, peakY + 20, cx + half * 0.45, baseY - (baseY - peakY) * 0.55, cx + half, baseY);
  ctx.closePath();
  const cone = ctx.createLinearGradient(cx - half, 0, cx + half, 0);
  cone.addColorStop(0, "#4A2148");
  cone.addColorStop(0.5, "#3B1A3D");
  cone.addColorStop(1, "#2C1330");
  ctx.fillStyle = cone;
  ctx.fill();
  // lava runnels down the cone
  ctx.strokeStyle = `rgba(255,120,50,${0.35 + erupting * 0.5})`;
  ctx.lineCap = "round";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - mouth * 0.4, peakY + 4);
  ctx.bezierCurveTo(cx - mouth * 1.2, peakY + 60, cx + mouth * 0.6, peakY + 110, cx - mouth * 0.8, peakY + 170);
  ctx.moveTo(cx + mouth * 0.5, peakY + 4);
  ctx.bezierCurveTo(cx + mouth * 1.4, peakY + 50, cx + mouth * 2.6, peakY + 90, cx + mouth * 2.2, peakY + 130);
  ctx.stroke();
  // crater glow
  const g = ctx.createRadialGradient(cx, peakY, 2, cx, peakY, 90 + erupting * 120);
  g.addColorStop(0, `rgba(255,190,80,${0.75 + erupting * 0.25})`);
  g.addColorStop(0.3, `rgba(255,90,40,${0.3 + erupting * 0.3})`);
  g.addColorStop(1, "rgba(255,90,40,0)");
  ctx.fillStyle = g;
  ctx.fillRect(cx - 220, peakY - 220, 440, 440);
  // smoke
  for (let i = 0; i < 6; i++) {
    const life = ((t * 0.07 + i / 6) % 1);
    const r = 18 + life * 70;
    ctx.fillStyle = `rgba(90,60,95,${(1 - life) * 0.35})`;
    ctx.beginPath();
    ctx.arc(cx + Math.sin(i * 2.1 + t * 0.3) * 20 + life * 60, peakY - 20 - life * h * 0.28, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return { cx, peakY };
};

// ── lava ──────────────────────────────────────────────────────────────────────
const lavaPath = (ctx: CanvasRenderingContext2D, w: number, h: number, y: number, t: number, phase: number) => {
  ctx.beginPath();
  ctx.moveTo(0, h + 10);
  for (let x = 0; x <= w + 12; x += 12) ctx.lineTo(x, y + wave(x, t, phase));
  ctx.lineTo(w, h + 10);
  ctx.closePath();
};

/** The cave floor the towers start on; the lava climbs over it. */
const drawFloor = (ctx: CanvasRenderingContext2D, w: number, h: number, y: number) => {
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, y + 6);
  for (let x = 0; x <= w + 40; x += 40) ctx.lineTo(x, y + (hash(x, 21) - 0.5) * 6);
  ctx.lineTo(w, h);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, y, 0, y + 120);
  g.addColorStop(0, "#4A2A40");
  g.addColorStop(1, "#24121F");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "#6A4058";
  ctx.lineWidth = 2;
  ctx.stroke();
};

const drawLavaBack = (ctx: CanvasRenderingContext2D, w: number, h: number, y: number, t: number) => {
  lavaPath(ctx, w, h, y - 10, t * 0.8, 2.4);
  ctx.fillStyle = "#B72A1E";
  ctx.fill();
};

const drawLavaFront = (ctx: CanvasRenderingContext2D, w: number, h: number, y: number, t: number) => {
  lavaPath(ctx, w, h, y, t, 0);
  const g = ctx.createLinearGradient(0, y - 12, 0, Math.max(y + 260, h));
  g.addColorStop(0, "#FF8A1F");
  g.addColorStop(0.1, "#F2561C");
  g.addColorStop(0.45, "#C9261B");
  g.addColorStop(1, "#6E0E16");
  ctx.fillStyle = g;
  ctx.fill();

  ctx.save();
  ctx.clip();
  // cooling crust plates drifting on the surface
  for (let i = 0; i < 14; i++) {
    const speed = 8 + hash(i, 3) * 14;
    const x = ((hash(i, 1) * (w + 300) + t * speed) % (w + 300)) - 150;
    const depth = 18 + hash(i, 2) * 140;
    const rw = 40 + hash(i, 4) * 90, rh = 7 + hash(i, 5) * 9;
    ctx.fillStyle = `rgba(110,18,24,${0.32 + hash(i, 6) * 0.25})`;
    ctx.beginPath();
    ctx.ellipse(x, y + depth + Math.sin(t + i) * 3, rw, rh, Math.sin(i) * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
  // bright veins
  ctx.strokeStyle = "rgba(255,200,90,0.35)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const depth = 30 + i * 34;
    ctx.beginPath();
    for (let x = -20; x <= w + 20; x += 24) {
      const yy = y + depth + Math.sin(x * 0.008 + t * 0.6 + i * 1.7) * 9;
      if (x === -20) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.globalAlpha = 0.5 - i * 0.07;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // the hot lip of the surface
  ctx.beginPath();
  for (let x = 0; x <= w + 12; x += 12) {
    const yy = y + wave(x, t, 0);
    if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
  }
  ctx.strokeStyle = "#FFD04A";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,240,180,0.7)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
};

const drawBubbles = (ctx: CanvasRenderingContext2D, w: number, y: number, t: number) => {
  for (let i = 0; i < 18; i++) {
    const period = 2.2 + hash(i, 9) * 2.5;
    const life = ((t + hash(i, 8) * period) % period) / period;
    const x = hash(i, 7) * w + Math.floor((t + hash(i, 8) * period) / period) * 97 % w;
    const xx = x % w;
    const surf = y + wave(xx, t, 0);
    if (life < 0.75) {
      const r = 3 + life * 9 * (0.6 + hash(i, 10));
      ctx.fillStyle = "rgba(255,190,70,0.85)";
      ctx.beginPath();
      ctx.arc(xx, surf - r * 0.4, r, Math.PI, 0);
      ctx.fill();
    } else {
      const p = (life - 0.75) / 0.25;
      ctx.strokeStyle = `rgba(255,210,110,${1 - p})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(xx, surf - 2, 6 + p * 16, 2 + p * 4, 0, Math.PI, 0);
      ctx.stroke();
    }
  }
};

const drawEmbers = (ctx: CanvasRenderingContext2D, w: number, y: number, t: number, heat: number) => {
  const n = 26 + Math.round(heat * 30);
  for (let i = 0; i < n; i++) {
    const period = 3 + hash(i, 11) * 4;
    const life = ((t + hash(i, 12) * period) % period) / period;
    const x = hash(i, 13) * w + Math.sin(t * 1.3 + i) * 14;
    const yy = y - life * (220 + hash(i, 14) * 260);
    const r = 1.4 + hash(i, 15) * 2.2;
    ctx.fillStyle = `rgba(255,${150 + Math.round(hash(i, 16) * 80)},60,${(1 - life) * 0.9})`;
    ctx.beginPath();
    ctx.arc(x, yy, r, 0, Math.PI * 2);
    ctx.fill();
  }
};

// ── layout ────────────────────────────────────────────────────────────────────
// Towers sit side by side, each as wide as its member count in "slots". A lone
// student's tower is a slim pillar in the middle of its slot; a group tower is
// a wall across all of its slots, with a gap between neighboring walls.
export type TowerPos = { x0: number; x1: number; brickW: number; slotX: (k: number) => number; center: number };

export const layoutTowers = (towers: BoardTower[], w: number, padX: number, minSlot = 0, focus?: { tower: number; slot: number }) => {
  const slots = towers.reduce((a, t) => a + Math.max(1, t.width), 0);
  const grouped = towers.some(t => t.width > 1);
  const gap = grouped ? 0.9 : 0;
  const span = slots + gap * Math.max(0, towers.length - 1);
  const slotW = Math.max(minSlot, Math.min(120, (w - padX * 2) / Math.max(1, span)));
  const total = slotW * span;

  const place = (start: number) => {
    let cursor = start;
    return towers.map(t => {
      const width = Math.max(1, t.width);
      const center = cursor + (width * slotW) / 2;
      const body = width === 1 ? Math.max(14, Math.min(64, slotW * 0.56)) : width * slotW * 0.96;
      const x0 = center - body / 2;
      const brickW = body / width;
      cursor += width * slotW + gap * slotW;
      return { x0, x1: x0 + body, brickW, center, slotX: (k: number) => x0 + brickW * (k + 0.5) };
    });
  };

  let start = (w - total) / 2;
  if (total > w && focus) {
    // Wider than the screen (a phone looking at a whole-class wall): keep the
    // player's own slot in the middle and let the rest run off the edges.
    const at = place(0)[focus.tower]?.slotX(focus.slot) ?? total / 2;
    start = Math.min(padX, Math.max(w - total - padX, w / 2 - at));
  }
  return { slotW, pos: place(start) };
};

// ── towers ────────────────────────────────────────────────────────────────────
const brick = (ctx: CanvasRenderingContext2D, x: number, y: number, bw: number, bh: number, fill: string, top: boolean) => {
  const r = Math.min(5, bh * 0.22, bw * 0.25);
  roundRect(ctx, x, y, bw, bh, r);
  ctx.fillStyle = fill;
  ctx.fill();
  // underside shade + top highlight give each brick its thickness
  ctx.fillStyle = top ? "rgba(0,0,0,0.16)" : STONE_SHADE;
  ctx.fillRect(x + 1, y + bh * 0.74, bw - 2, bh * 0.26 - 1);
  ctx.fillStyle = top ? "rgba(255,255,255,0.35)" : STONE_LIGHT;
  ctx.fillRect(x + r * 0.7, y + 1, Math.max(0, bw - r * 1.4), Math.max(1.5, bh * 0.12));
  ctx.strokeStyle = "rgba(20,10,20,0.55)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, bw, bh, r);
  ctx.stroke();
};

const drawTower = (ctx: CanvasRenderingContext2D, tw: BoardTower, idx: number, p: TowerPos, cam: Camera, h: number) => {
  const bh = cam.ppm;
  const width = Math.max(1, tw.width);
  const first = Math.max(0, Math.floor(cam.bottom));
  const last = tw.courses + (tw.partial ? 1 : 0);

  for (let c = first; c < last; c++) {
    const y = sy(cam, h, c + 1);
    const isPartial = c === tw.courses;
    const isTop = isPartial || (c === tw.courses - 1 && !tw.partial);
    if (bh < 7 && !isPartial) {
      // too thin for brick detail: one band per course
      ctx.fillStyle = isTop ? tw.color : STONE[c % 3];
      ctx.fillRect(p.x0, y, p.x1 - p.x0, bh - (bh > 3 ? 1 : 0));
      continue;
    }
    const n = isPartial ? tw.partial : width;
    // running bond: odd courses shift half a brick on walls, so it reads as masonry
    const shift = width > 1 && c % 2 && !isPartial ? 0.5 : 0;
    const jitter = width === 1 ? (hash(idx, c) - 0.5) * p.brickW * 0.08 : 0;
    for (let k = shift ? -1 : 0; k < n; k++) {
      let x = p.x0 + (k + shift) * p.brickW + jitter;
      let bw = p.brickW;
      if (x < p.x0 - 0.5) { bw -= p.x0 - x; x = p.x0; }
      if (x + bw > p.x1 + 0.5) bw = p.x1 - x;
      if (bw < 3) continue;
      const fill = isTop ? tw.color : STONE[Math.floor(hash(idx * 7919 + c, k + 99) * 3)];
      brick(ctx, x + 0.75, y, bw - 1.5, bh - 1.5, fill, isTop);
    }
  }
};

const HOP_MS = 380;

const drawPlayer = (ctx: CanvasRenderingContext2D, m: Member, cx: number, footY: number, r: number, now: number, dunked: boolean, me: boolean) => {
  // a new brick goes in under your feet, so you pop up and land on it
  const p = (now - m.landAt) / HOP_MS;
  const hop = !dunked && p >= 0 && p < 1 ? -Math.sin(p * Math.PI) * r * 0.9 : 0;
  const bob = dunked ? Math.sin(now / 260 + cx) * 3 : hop;
  const y = footY - r + bob + (dunked ? r * 0.55 : 0);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, y, r, 0, Math.PI * 2);
  ctx.fillStyle = m.color;
  ctx.fill();
  ctx.clip();
  const img = faceImage(m.face);
  if (img.complete && img.naturalWidth) {
    const s = r * 2 * 1.28;
    ctx.drawImage(img, cx - s / 2, y - s / 2, s, s);
  }
  ctx.restore();
  ctx.lineWidth = Math.max(2, r * 0.12);
  ctx.strokeStyle = dunked ? "#FF5A3C" : me ? "#FFFFFF" : INK;
  ctx.beginPath();
  ctx.arc(cx, y, r, 0, Math.PI * 2);
  ctx.stroke();
  return y;
};

const drawLabel = (ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, maxW: number, bg: string, fg: string, size: number) => {
  ctx.font = `700 ${size}px Almarai, Outfit, system-ui, sans-serif`;
  let s = text;
  while (s.length > 1 && ctx.measureText(s).width > maxW - 12) s = s.slice(0, -1);
  if (s !== text) s = s.slice(0, -1) + "…";
  const tw = ctx.measureText(s).width + size * 1.1;
  roundRect(ctx, cx - tw / 2, y - size * 0.8, tw, size * 1.6, size * 0.8);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(s, cx, y + 0.5);
};

const drawMeMarker = (ctx: CanvasRenderingContext2D, cx: number, y: number, size: number) => {
  ctx.beginPath();
  ctx.moveTo(cx - size, y - size * 1.4);
  ctx.lineTo(cx + size, y - size * 1.4);
  ctx.lineTo(cx, y);
  ctx.closePath();
  ctx.fillStyle = "#C6F04A";
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.stroke();
};

// ── ruler ─────────────────────────────────────────────────────────────────────
const drawRuler = (ctx: CanvasRenderingContext2D, cam: Camera, h: number, lava: number, ar: boolean, topPad: number) => {
  const step = cam.ppm > 26 ? 2 : cam.ppm > 12 ? 5 : 10;
  ctx.font = "600 12px Outfit, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (let m = Math.ceil(cam.bottom / step) * step; m < cam.top; m += step) {
    if (m < 0) continue;
    const y = sy(cam, h, m);
    if (y < topPad || m < lava + 0.6) continue;
    ctx.fillStyle = "rgba(245,235,210,0.28)";
    ctx.fillRect(14, y, 10, 1.5);
    ctx.fillStyle = "rgba(245,235,210,0.45)";
    ctx.fillText(ar ? `${m}م` : `${m}m`, 28, y);
  }
};

// ── one frame ─────────────────────────────────────────────────────────────────
export type Frame = {
  towers: BoardTower[];
  lava: number;            // meters
  cam: Camera;
  t: number;               // seconds, for waves
  now: number;             // ms
  erupting: number;        // 0..1 strength of a running eruption
  shake: number;           // px
  ar: boolean;
  meId?: string;           // phone: mark this player and keep them on screen
  padX?: number;
  minSlot?: number;
  rulerTop?: number;       // px kept clear of ruler labels (under the HUD)
  scenery?: boolean;       // the volcano and far ridges; off on a small phone strip
};

export const drawBoard = (ctx: CanvasRenderingContext2D, w: number, h: number, f: Frame) => {
  const { cam, t, now } = f;
  ctx.save();
  if (f.shake > 0) ctx.translate((Math.random() - 0.5) * f.shake, (Math.random() - 0.5) * f.shake);
  const lavaY = sy(cam, h, f.lava);
  const heat = Math.max(0, Math.min(1, 1 - (lavaY / h)));
  const hot = Math.max(heat, f.erupting);

  drawSky(ctx, w, h, lavaY, hot);
  if (f.scenery !== false) {
    ridge(ctx, w, h * 0.62, h * 0.12, 3, RIDGE_FAR);
    drawVolcano(ctx, w, h, t, f.erupting);
    ridge(ctx, w, h * 0.8, h * 0.09, 7, RIDGE_NEAR);
  }
  drawRuler(ctx, cam, h, f.lava, f.ar, f.rulerTop ?? 70);
  drawFloor(ctx, w, h, sy(cam, h, 0));
  drawLavaBack(ctx, w, h, lavaY, t);

  let focus: { tower: number; slot: number } | undefined;
  if (f.meId) f.towers.forEach((tw, i) => {
    const j = tw.members.findIndex(m => m.id === f.meId);
    if (j >= 0) focus = { tower: i, slot: j % Math.max(1, tw.width) };
  });
  const { slotW, pos } = layoutTowers(f.towers, w, f.padX ?? 70, f.minSlot ?? 0, focus);
  const r = Math.max(9, Math.min(26, slotW * 0.3));

  f.towers.forEach((tw, i) => drawTower(ctx, tw, i, pos[i], cam, h));

  type Head = { tw: BoardTower; m: Member; cx: number; headY: number };
  const standing: Head[] = [], floating: Head[] = [];
  const memberX = (tw: BoardTower, p: TowerPos, j: number) => {
    const width = Math.max(1, tw.width);
    // anyone past the tower's width (joined late) stands slightly off their slot
    return p.slotX(j % width) + Math.floor(j / width) * r * 0.55;
  };
  f.towers.forEach((tw, i) => {
    if (tw.dunked) return;
    tw.members.forEach((m, j) => {
      const slot = j % Math.max(1, tw.width);
      const foot = sy(cam, h, tw.courses + (slot < tw.partial ? 1 : 0));
      const cx = memberX(tw, pos[i], j);
      standing.push({ tw, m, cx, headY: drawPlayer(ctx, m, cx, foot, r, now, false, m.id === f.meId) });
    });
  });
  // dunked players float in the surface, so they go between the two sheets
  f.towers.forEach((tw, i) => {
    if (!tw.dunked) return;
    tw.members.forEach((m, j) => {
      const cx = memberX(tw, pos[i], j);
      floating.push({ tw, m, cx, headY: drawPlayer(ctx, m, cx, lavaY + wave(cx, t, 0) + 2, r, now, true, m.id === f.meId) });
    });
  });

  drawLavaFront(ctx, w, h, lavaY, t);
  drawBubbles(ctx, w, lavaY, t);
  drawEmbers(ctx, w, lavaY, t, hot);

  // labels last so the lava never covers a name
  const size = Math.max(10, Math.min(15, slotW * 0.16));
  const bigSize = Math.max(13, Math.min(20, slotW * 0.5));
  f.towers.forEach((tw, i) => {
    const heads = (tw.dunked ? floating : standing).filter(hd => hd.tw === tw);
    if (!heads.length) return;
    const p = pos[i];
    if (tw.label) {
      const topY = Math.min(...heads.map(hd => hd.headY)) - r - bigSize * 1.3;
      const text = tw.dunked ? `${tw.label}  ${tw.climb}/${tw.need}` : `${tw.label}  ${tw.courses}${f.ar ? "م" : "m"}`;
      drawLabel(ctx, text, p.center, topY, Math.max(140, p.x1 - p.x0 + 40), tw.dunked ? "#FF5A3C" : "rgba(20,10,20,0.85)", tw.dunked ? "#fff" : tw.color, bigSize);
    } else {
      heads.forEach(({ m, cx, headY }) => drawLabel(ctx, tw.dunked ? `${tw.climb}/${tw.need}` : m.name, cx, headY - r - size * 1.1,
        slotW - 4, tw.dunked ? "#FF5A3C" : "rgba(20,10,20,0.78)", tw.dunked ? "#fff" : "#F5EBD2", size));
    }
  });
  const me = [...standing, ...floating].find(hd => hd.m.id === f.meId);
  if (me) drawMeMarker(ctx, me.cx, me.headY - r - (me.tw.label ? 4 : size * 2.2), Math.max(6, r * 0.45));

  ctx.restore();
};

// ── from database rows ────────────────────────────────────────────────────────
export type LfStudent = { id: string; name: string; avatar_color: number | null; avatar_face: number | null; lf_tower: string | null; crypto: number | null };

/** Towers + who stands on them, in the shape the renderer draws. */
export const toBoard = (towers: Tower[], students: LfStudent[], land: Map<string, number>, mode: LfMode, ar: boolean): BoardTower[] =>
  towers.map(t => {
    const members: Member[] = students.filter(s => s.lf_tower === t.id).map(s => ({
      id: s.id, name: s.name,
      color: resolveColor(s.name, s.avatar_color),
      face: Math.max(0, FACES.indexOf(resolveFace(s.name, s.avatar_face))),
      landAt: land.get(s.id) ?? 0,
    }));
    return {
      id: t.id, width: t.width, courses: towerHeight(t), partial: partialCourse(t),
      color: towerColor(mode, t, members[0]?.color),
      label: mode === "solo" ? undefined : towerName(mode, t, ar),
      dunked: t.dunked, climb: t.climb, need: climbNeed(t.width), members,
    };
  });

