// ── Humans vs Zombies — drawing ─────────────────────────────────────────────
// Top-down with a hint of depth: every wall shows its top and, where it faces
// the room, its front, so the building reads as walls rather than a floor plan.
// Players are their lobby avatar faces on a disc: a human on their own lobby
// color with a white rim and a stun gun, a zombie tinted sick green with its
// arms out. Darkness covers everything outside what you can actually see —
// walls block sight, so a zombie can be one door away and invisible.
//
// Everything is drawn in CSS px through a world → screen transform:
// screen = off + world * scale.

import { TILE, PLAYER_R, FLOOR, WALL, PROP, tileAt, type HvzMap } from "@/lib/humansVsZombies";

export const HVZ = {
  void: "#0B0F16",
  hall: "#565E6B",
  hallAlt: "#5D6573",
  wallTop: "#3A4458",
  wallFace: "#232A38",
  wallEdge: "#56627A",
  human: "#4EA3F2",
  zombie: "#6CC04A",
  zombieDeep: "#2F6B22",
  bullet: "#FFE066",
  ink: "#0B0F16",
};

export type View = { offX: number; offY: number; scale: number; cssW: number; cssH: number };

export const makeView = (cx: number, cy: number, cssW: number, cssH: number, scale: number): View => ({
  offX: cssW / 2 - cx * scale, offY: cssH / 2 - cy * scale, scale, cssW, cssH,
});

const rr = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
};

/** Floor, furniture and walls for the part of the building on screen. */
export const drawBuilding = (ctx: CanvasRenderingContext2D, m: HvzMap, v: View, ar: boolean) => {
  const { offX, offY, scale, cssW, cssH } = v;
  ctx.fillStyle = HVZ.void;
  ctx.fillRect(0, 0, cssW, cssH);
  const t = TILE * scale;
  const tx0 = Math.max(0, Math.floor(-offX / t) - 1), ty0 = Math.max(0, Math.floor(-offY / t) - 1);
  const tx1 = Math.min(m.cols - 1, Math.ceil((cssW - offX) / t) + 1), ty1 = Math.min(m.rows - 1, Math.ceil((cssH - offY) / t) + 1);
  const X = (tx: number) => offX + tx * t, Y = (ty: number) => offY + ty * t;

  // Floor, checkered per room so a room reads as one place.
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const k = m.tiles[ty * m.cols + tx];
    if (k === WALL) continue;
    const room = m.roomOf[ty * m.cols + tx];
    const alt = (tx + ty) & 1;
    ctx.fillStyle = room >= 0 ? (alt ? m.rooms[room].kind.tile : m.rooms[room].kind.floor) : (alt ? HVZ.hallAlt : HVZ.hall);
    ctx.fillRect(X(tx), Y(ty), t + 0.6, t + 0.6);
  }

  // Hallway center line: a dashed stripe down the middle of each three-wide run.
  ctx.fillStyle = "rgba(255,214,102,0.22)";
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const i = ty * m.cols + tx;
    if (m.tiles[i] !== FLOOR || m.roomOf[i] >= 0) continue;
    const h = tileAt(m, tx - 1, ty) === FLOOR && tileAt(m, tx + 1, ty) === FLOOR && tileAt(m, tx, ty - 1) !== FLOOR;
    const vv = tileAt(m, tx, ty - 1) === FLOOR && tileAt(m, tx, ty + 1) === FLOOR && tileAt(m, tx - 1, ty) !== FLOOR;
    if (h && tileAt(m, tx, ty + 2) !== FLOOR && tx % 2 === 0) ctx.fillRect(X(tx) + t * 0.2, Y(ty + 1) + t * 0.46, t * 0.6, t * 0.08);
    if (vv && tileAt(m, tx + 2, ty) !== FLOOR && ty % 2 === 0) ctx.fillRect(X(tx + 1) + t * 0.46, Y(ty) + t * 0.2, t * 0.08, t * 0.6);
  }

  // Room names painted on the floor.
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${Math.round(t * 0.62)}px 'Almarai', system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  for (const r of m.rooms) {
    const cx = X(r.x + r.w / 2), cy = Y(r.y + 1.1);
    if (cx < -200 || cx > cssW + 200 || cy < -60 || cy > cssH + 60) continue;
    ctx.fillText(ar ? r.kind.ar : r.kind.en, cx, cy);
  }
  ctx.restore();

  // Furniture.
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const i = ty * m.cols + tx;
    if (m.tiles[i] !== PROP) continue;
    const x = X(tx), y = Y(ty), kind = m.propKind[i];
    const p = t * 0.08;
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    rr(ctx, x + p + t * 0.06, y + p + t * 0.1, t - p * 2, t - p * 2, t * 0.12); ctx.fill();
    if (kind === 0) {           // crate
      ctx.fillStyle = "#A0713F"; rr(ctx, x + p, y + p, t - p * 2, t - p * 2, t * 0.08); ctx.fill();
      ctx.strokeStyle = "#6E4A24"; ctx.lineWidth = Math.max(1, t * 0.06);
      ctx.beginPath(); ctx.moveTo(x + p * 2, y + p * 2); ctx.lineTo(x + t - p * 2, y + t - p * 2);
      ctx.moveTo(x + t - p * 2, y + p * 2); ctx.lineTo(x + p * 2, y + t - p * 2); ctx.stroke();
      ctx.strokeRect(x + p * 1.5, y + p * 1.5, t - p * 3, t - p * 3);
    } else if (kind === 1) {    // table
      ctx.fillStyle = "#D9D4C7"; rr(ctx, x + p, y + p, t - p * 2, t - p * 2, t * 0.18); ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.08)"; rr(ctx, x + p * 2.5, y + p * 2.5, t - p * 5, t - p * 5, t * 0.12); ctx.fill();
    } else if (kind === 2) {    // plant
      ctx.fillStyle = "#8A5A3A"; ctx.beginPath(); ctx.arc(x + t / 2, y + t / 2, t * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#3F8F45";
      for (let k = 0; k < 5; k++) {
        const a = k * 1.256 + 0.3;
        ctx.beginPath(); ctx.arc(x + t / 2 + Math.cos(a) * t * 0.16, y + t / 2 + Math.sin(a) * t * 0.16, t * 0.2, 0, Math.PI * 2); ctx.fill();
      }
    } else {                    // shelf
      ctx.fillStyle = "#4A5568"; rr(ctx, x + p, y + p, t - p * 2, t - p * 2, t * 0.06); ctx.fill();
      const cols = ["#E07A5F", "#F2CC8F", "#81B29A", "#8AB6D6"];
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = cols[(tx + ty + k) % 4];
        ctx.fillRect(x + p * 1.6 + k * (t - p * 3.2) / 4, y + p * 1.8, (t - p * 3.2) / 4 - 1, t - p * 3.6);
      }
    }
  }

  // Walls: a top everywhere, and a front face where the wall looks into a room.
  const face = t * 0.5;
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    if (m.tiles[ty * m.cols + tx] !== WALL) continue;
    const x = X(tx), y = Y(ty);
    const open = tileAt(m, tx, ty + 1) !== WALL;
    ctx.fillStyle = HVZ.wallTop;
    ctx.fillRect(x, y, t + 0.6, (open ? t - face : t) + 0.6);
    if (open) {
      ctx.fillStyle = HVZ.wallFace;
      ctx.fillRect(x, y + t - face, t + 0.6, face + 0.6);
      ctx.fillStyle = HVZ.wallEdge;
      ctx.fillRect(x, y + t - face, t + 0.6, Math.max(1, t * 0.06));
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(x, y + t, t + 0.6, t * 0.12);   // shadow on the floor
    }
  }
  // Wall outlines against open ground, so the building's shape is crisp.
  ctx.strokeStyle = "#0E1219";
  ctx.lineWidth = Math.max(1, t * 0.05);
  ctx.beginPath();
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    if (m.tiles[ty * m.cols + tx] !== WALL) continue;
    const x = X(tx), y = Y(ty);
    if (tileAt(m, tx, ty - 1) !== WALL) { ctx.moveTo(x, y); ctx.lineTo(x + t, y); }
    if (tileAt(m, tx - 1, ty) !== WALL) { ctx.moveTo(x, y); ctx.lineTo(x, y + t); }
    if (tileAt(m, tx + 1, ty) !== WALL) { ctx.moveTo(x + t, y); ctx.lineTo(x + t, y + t); }
  }
  ctx.stroke();
};

let darkCanvas: HTMLCanvasElement | null = null;

/**
 * Darken everything outside the visibility polygon. Done on a second canvas so
 * the lit region can be cut out with a soft edge, then laid over the scene.
 */
export const drawDarkness = (
  ctx: CanvasRenderingContext2D, v: View, poly: number[], px: number, py: number, radius: number, tint: string,
) => {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(v.cssW * dpr), h = Math.round(v.cssH * dpr);
  if (!darkCanvas) darkCanvas = document.createElement("canvas");
  if (darkCanvas.width !== w || darkCanvas.height !== h) { darkCanvas.width = w; darkCanvas.height = h; }
  const d = darkCanvas.getContext("2d")!;
  d.setTransform(dpr, 0, 0, dpr, 0, 0);
  d.globalCompositeOperation = "source-over";
  d.clearRect(0, 0, v.cssW, v.cssH);
  d.fillStyle = tint;
  d.fillRect(0, 0, v.cssW, v.cssH);
  d.globalCompositeOperation = "destination-out";
  const cx = v.offX + px * v.scale, cy = v.offY + py * v.scale, R = radius * v.scale;
  const g = d.createRadialGradient(cx, cy, R * 0.55, cx, cy, R);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  d.fillStyle = g;
  d.beginPath();
  for (let i = 0; i < poly.length; i += 2) {
    const x = v.offX + poly[i] * v.scale, y = v.offY + poly[i + 1] * v.scale;
    if (i === 0) d.moveTo(x, y); else d.lineTo(x, y);
  }
  d.closePath();
  d.fill();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(darkCanvas, 0, 0);
  ctx.restore();
};

export type AgentLook = {
  face?: HTMLImageElement;
  color: string;
  zombie: boolean;
  /** Where the arms (zombie) or the gun (human) point. */
  angle: number;
  moving?: boolean;
  stunned?: boolean;
  shield?: boolean;
  sprint?: boolean;
  turning?: boolean;
  alpha?: number;
};

/** A player at screen (x, y); r is the body radius in screen px. */
export const drawAgent = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, look: AgentLook, t: number) => {
  ctx.save();
  ctx.globalAlpha = look.alpha ?? 1;
  const bob = look.moving && !look.stunned ? Math.abs(Math.sin(t * 0.014)) * r * 0.14 : 0;

  ctx.fillStyle = "rgba(0,0,0,0.30)";
  ctx.beginPath(); ctx.ellipse(x, y + r * 0.85, r * 0.95, r * 0.36, 0, 0, Math.PI * 2); ctx.fill();

  const by = y - bob;
  const ca = Math.cos(look.angle), sa = Math.sin(look.angle);

  if (look.sprint) {
    ctx.strokeStyle = look.zombie ? "rgba(108,192,74,0.55)" : "rgba(255,255,255,0.5)";
    ctx.lineWidth = Math.max(1.5, r * 0.14);
    ctx.lineCap = "round";
    for (let k = -1; k <= 1; k++) {
      const ox = -sa * k * r * 0.5, oy = ca * k * r * 0.5;
      ctx.beginPath();
      ctx.moveTo(x - ca * r * 1.2 + ox, by - sa * r * 1.2 + oy);
      ctx.lineTo(x - ca * r * (1.9 + (k === 0 ? 0.4 : 0)) + ox, by - sa * r * (1.9 + (k === 0 ? 0.4 : 0)) + oy);
      ctx.stroke();
    }
  }

  if (look.zombie) {
    // Arms out in front, the one universal zombie silhouette.
    ctx.strokeStyle = HVZ.zombieDeep;
    ctx.lineCap = "round";
    ctx.lineWidth = r * 0.42;
    const reach = look.stunned ? 0.9 : 1.55 + Math.sin(t * 0.01) * 0.08;
    for (const side of [-1, 1]) {
      const bx = x + -sa * side * r * 0.62, byy = by + ca * side * r * 0.62;
      ctx.beginPath(); ctx.moveTo(bx, byy); ctx.lineTo(bx + ca * r * reach, byy + sa * r * reach); ctx.stroke();
    }
    ctx.strokeStyle = HVZ.zombie;
    ctx.lineWidth = r * 0.26;
    for (const side of [-1, 1]) {
      const bx = x + -sa * side * r * 0.62, byy = by + ca * side * r * 0.62;
      ctx.beginPath(); ctx.moveTo(bx, byy); ctx.lineTo(bx + ca * r * reach, byy + sa * r * reach); ctx.stroke();
    }
  } else {
    // Stun gun.
    ctx.save();
    ctx.translate(x, by);
    ctx.rotate(look.angle);
    ctx.fillStyle = "#1F2633";
    rr(ctx, r * 0.55, -r * 0.2, r * 0.95, r * 0.4, r * 0.12); ctx.fill();
    ctx.fillStyle = HVZ.bullet;
    ctx.fillRect(r * 1.35, -r * 0.11, r * 0.16, r * 0.22);
    ctx.restore();
  }

  // Body.
  ctx.fillStyle = look.zombie ? HVZ.zombie : look.color;
  ctx.beginPath(); ctx.arc(x, by, r, 0, Math.PI * 2); ctx.fill();

  if (look.face?.complete && look.face.naturalWidth) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, by, r * 0.96, 0, Math.PI * 2); ctx.clip();
    const s = r * 1.78;
    ctx.drawImage(look.face, x - s / 2, by - s / 2, s, s);
    if (look.zombie) {
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = "rgba(120,200,90,0.65)";
      ctx.fillRect(x - r, by - r, r * 2, r * 2);
      ctx.globalCompositeOperation = "source-over";
      // A couple of wounds so a zombie never reads as a green human.
      ctx.fillStyle = "rgba(120,20,30,0.55)";
      ctx.beginPath(); ctx.arc(x + r * 0.45, by - r * 0.35, r * 0.16, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x - r * 0.5, by + r * 0.4, r * 0.11, 0, Math.PI * 2); ctx.fill();
    }
    if (look.stunned) {
      ctx.fillStyle = "rgba(140,200,255,0.45)";
      ctx.fillRect(x - r, by - r, r * 2, r * 2);
    }
    ctx.restore();
  }

  ctx.lineWidth = Math.max(2, r * 0.16);
  ctx.strokeStyle = look.zombie ? HVZ.zombieDeep : "#FFFFFF";
  ctx.beginPath(); ctx.arc(x, by, r, 0, Math.PI * 2); ctx.stroke();

  if (look.shield) {
    const pulse = 1.32 + Math.sin(t * 0.006) * 0.05;
    ctx.strokeStyle = "rgba(120,220,255,0.85)";
    ctx.lineWidth = Math.max(2, r * 0.12);
    ctx.beginPath(); ctx.arc(x, by, r * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "rgba(120,220,255,0.12)";
    ctx.fill();
  }

  if (look.stunned) {
    ctx.fillStyle = "#FFE066";
    for (let k = 0; k < 3; k++) {
      const a = t * 0.006 + k * 2.094;
      const sx = x + Math.cos(a) * r * 0.9, sy = by - r * 1.15 + Math.sin(a) * r * 0.3;
      star(ctx, sx, sy, r * 0.22);
    }
  }

  if (look.turning) {
    ctx.strokeStyle = "rgba(108,192,74,0.9)";
    ctx.lineWidth = Math.max(2, r * 0.14);
    ctx.setLineDash([r * 0.4, r * 0.3]);
    ctx.lineDashOffset = -t * 0.05;
    ctx.beginPath(); ctx.arc(x, by, r * 1.4, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
};

const star = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rad = i % 2 ? r * 0.45 : r;
    const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill();
};

export const drawTag = (ctx: CanvasRenderingContext2D, x: number, y: number, name: string, zombie: boolean, me: boolean, fontPx = 12) => {
  if (!name) return;
  ctx.save();
  ctx.font = `800 ${Math.round(fontPx)}px 'Almarai', system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(3, fontPx * 0.36);
  ctx.strokeStyle = "rgba(11,15,22,0.85)";
  ctx.strokeText(name, x, y);
  ctx.fillStyle = me ? "#FFE066" : zombie ? "#A6E88A" : "#FFFFFF";
  ctx.fillText(name, x, y);
  ctx.restore();
};

export type Bullet = { id: string; by: string; x: number; y: number; vx: number; vy: number; travelled: number };

export const drawBullets = (ctx: CanvasRenderingContext2D, bullets: Bullet[], v: View) => {
  ctx.save();
  ctx.lineCap = "round";
  for (const b of bullets) {
    const x = v.offX + b.x * v.scale, y = v.offY + b.y * v.scale;
    const tx = x - b.vx * 0.035 * v.scale, ty = y - b.vy * 0.035 * v.scale;
    ctx.strokeStyle = "rgba(255,224,102,0.35)";
    ctx.lineWidth = 9 * v.scale;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
    ctx.strokeStyle = HVZ.bullet;
    ctx.lineWidth = 4 * v.scale;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath(); ctx.arc(x, y, 2.6 * v.scale, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
};

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number };
type Ring = { x: number; y: number; born: number; color: string; max: number };

/** Short-lived world-space effects: bursts of bits and expanding rings. */
export class HvzFx {
  parts: Particle[] = [];
  rings: Ring[] = [];
  shakeUntil = 0;
  shakeAmp = 0;

  burst(x: number, y: number, color: string, n = 14, speed = 180) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 0.35 + Math.random() * 0.35, color, size: 2.5 + Math.random() * 3.5 });
    }
  }
  ring(x: number, y: number, color: string, max = 70) {
    this.rings.push({ x, y, born: performance.now(), color, max });
  }
  shake(amp: number, ms = 300) {
    this.shakeAmp = amp;
    this.shakeUntil = performance.now() + ms;
  }
  offset(now: number) {
    if (now > this.shakeUntil) return { x: 0, y: 0 };
    const k = (this.shakeUntil - now) / 300;
    return { x: (Math.random() - 0.5) * this.shakeAmp * k, y: (Math.random() - 0.5) * this.shakeAmp * k };
  }
  step(dt: number) {
    for (const p of this.parts) {
      p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 1 - dt * 4; p.vy *= 1 - dt * 4;
    }
    this.parts = this.parts.filter(p => p.life < p.max);
  }
  draw(ctx: CanvasRenderingContext2D, v: View, now: number) {
    ctx.save();
    for (const p of this.parts) {
      ctx.globalAlpha = 1 - p.life / p.max;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(v.offX + p.x * v.scale, v.offY + p.y * v.scale, p.size * v.scale, 0, Math.PI * 2); ctx.fill();
    }
    this.rings = this.rings.filter(r => now - r.born < 450);
    for (const r of this.rings) {
      const k = (now - r.born) / 450;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 4 * v.scale * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(v.offX + r.x * v.scale, v.offY + r.y * v.scale, (PLAYER_R + r.max * k) * v.scale, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
}

const miniCache = new WeakMap<HvzMap, HTMLCanvasElement>();

/** Overview of the whole building (rooms, halls) with you and, when sensing, the humans. */
export const drawMinimap = (
  ctx: CanvasRenderingContext2D, m: HvzMap, x: number, y: number, w: number,
  me: { x: number; y: number; zombie: boolean }, marks: { x: number; y: number; color: string }[],
) => {
  let img = miniCache.get(m);
  if (!img) {
    img = document.createElement("canvas");
    img.width = m.cols; img.height = m.rows;
    const c = img.getContext("2d")!;
    const data = c.createImageData(m.cols, m.rows);
    for (let i = 0; i < m.tiles.length; i++) {
      const open = m.tiles[i] !== WALL;
      const room = m.roomOf[i] >= 0;
      data.data[i * 4 + 0] = open ? (room ? 150 : 110) : 0;
      data.data[i * 4 + 1] = open ? (room ? 165 : 120) : 0;
      data.data[i * 4 + 2] = open ? (room ? 180 : 135) : 0;
      data.data[i * 4 + 3] = open ? 255 : 0;
    }
    c.putImageData(data, 0, 0);
    miniCache.set(m, img);
  }
  const s = w / m.cols, h = m.rows * s;
  ctx.save();
  ctx.fillStyle = "rgba(11,15,22,0.72)";
  rr(ctx, x - 6, y - 6, w + 12, h + 12, 10); ctx.fill();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 0.9;
  ctx.drawImage(img, x, y, w, h);
  ctx.globalAlpha = 1;
  for (const mk of marks) {
    ctx.fillStyle = mk.color;
    ctx.beginPath(); ctx.arc(x + (mk.x / TILE) * s, y + (mk.y / TILE) * s, 2.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = me.zombie ? HVZ.zombie : "#FFE066";
  ctx.strokeStyle = HVZ.ink; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x + (me.x / TILE) * s, y + (me.y / TILE) * s, 3.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
};

/** An arrow on the screen edge pointing at something off screen. */
export const drawEdgeArrow = (ctx: CanvasRenderingContext2D, v: View, wx: number, wy: number, color: string, label: string) => {
  const sx = v.offX + wx * v.scale, sy = v.offY + wy * v.scale;
  const m = 34;
  if (sx > m && sx < v.cssW - m && sy > m + 60 && sy < v.cssH - m - 120) return;
  const cx = v.cssW / 2, cy = v.cssH / 2;
  const a = Math.atan2(sy - cy, sx - cx);
  const kx = (v.cssW / 2 - m) / Math.max(1e-6, Math.abs(Math.cos(a)));
  const ky = (v.cssH / 2 - m - 70) / Math.max(1e-6, Math.abs(Math.sin(a)));
  const k = Math.min(kx, ky);
  const x = cx + Math.cos(a) * k, y = cy + Math.sin(a) * k;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.fillStyle = color;
  ctx.strokeStyle = HVZ.ink; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -10); ctx.lineTo(-3, 0); ctx.lineTo(-8, 10); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.font = "800 11px 'Almarai', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.lineWidth = 3; ctx.strokeStyle = HVZ.ink; ctx.strokeText(label, x - Math.cos(a) * 26, y - Math.sin(a) * 26 + 4);
  ctx.fillStyle = color; ctx.fillText(label, x - Math.cos(a) * 26, y - Math.sin(a) * 26 + 4);
  ctx.restore();
};
