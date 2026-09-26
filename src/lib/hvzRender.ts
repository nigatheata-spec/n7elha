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

import { TILE, PLAYER_R, FLOOR, WALL, SECRET, tileAt, type HvzMap, type Prop } from "@/lib/humansVsZombies";

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

/**
 * Floor, furniture and walls for the part of the building on screen.
 * `seesHatches` is false for zombies: the safe room and its hatches are drawn
 * as solid wall, so even the dim map under the darkness gives nothing away.
 */
export const drawBuilding = (ctx: CanvasRenderingContext2D, m: HvzMap, v: View, ar: boolean, seesHatches: boolean) => {
  const { offX, offY, scale, cssW, cssH } = v;
  ctx.fillStyle = HVZ.void;
  ctx.fillRect(0, 0, cssW, cssH);
  const t = TILE * scale;
  const tx0 = Math.max(0, Math.floor(-offX / t) - 1), ty0 = Math.max(0, Math.floor(-offY / t) - 1);
  const tx1 = Math.min(m.cols - 1, Math.ceil((cssW - offX) / t) + 1), ty1 = Math.min(m.rows - 1, Math.ceil((cssH - offY) / t) + 1);
  const X = (tx: number) => offX + tx * t, Y = (ty: number) => offY + ty * t;
  const hidden = (i: number) => !seesHatches && (m.tiles[i] === SECRET || (m.safe >= 0 && m.roomOf[i] === m.safe));
  const isWall = (tx: number, ty: number) => {
    if (tx < 0 || ty < 0 || tx >= m.cols || ty >= m.rows) return true;
    const i = ty * m.cols + tx;
    return m.tiles[i] === WALL || hidden(i);
  };
  const inView = (x: number, y: number, w: number, h: number) =>
    x + w >= tx0 && x <= tx1 && y + h >= ty0 && y <= ty1;

  // Floor, checkered per room so a room reads as one place.
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const i = ty * m.cols + tx;
    if (isWall(tx, ty)) continue;
    const room = m.roomOf[i];
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

  // Rugs.
  m.rooms.forEach((r, idx) => {
    if (!r.kind.rug || (idx === m.safe && !seesHatches) || !inView(r.x, r.y, r.w, r.h)) return;
    const x = X(r.x + 1.6), y = Y(r.y + 2.2), w = (r.w - 3.2) * t, h = (r.h - 3.6) * t;
    ctx.fillStyle = r.kind.rug;
    rr(ctx, x, y, w, h, t * 0.25); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = Math.max(1, t * 0.06);
    rr(ctx, x + t * 0.25, y + t * 0.25, w - t * 0.5, h - t * 0.5, t * 0.15); ctx.stroke();
  });

  // Room names painted on the floor.
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${Math.round(t * 0.62)}px 'Almarai', system-ui, sans-serif`;
  m.rooms.forEach((r, idx) => {
    if (idx === m.safe && !seesHatches) return;
    const cx = X(r.x + r.w / 2), cy = Y(r.y + 1.1);
    if (cx < -200 || cx > cssW + 200 || cy < -60 || cy > cssH + 60) return;
    ctx.fillStyle = idx === m.safe ? "rgba(140,220,255,0.35)" : "rgba(255,255,255,0.10)";
    ctx.fillText(ar ? r.kind.ar : r.kind.en, cx, cy);
  });
  ctx.restore();

  // Furniture, mats first so they sit under everything else.
  const pieces = m.props.filter(p => inView(p.x, p.y, p.w, p.h) && (seesHatches || m.roomOf[p.y * m.cols + p.x] !== m.safe));
  for (const p of pieces) if (p.kind === "mat") drawProp(ctx, p, X(p.x), Y(p.y), t);
  for (const p of pieces) if (p.kind !== "mat") drawProp(ctx, p, X(p.x), Y(p.y), t);

  // Hatches: a vent grate with a glow, only for those who can use them.
  if (seesHatches) {
    const glow = 0.55 + Math.sin(performance.now() * 0.004) * 0.2;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (m.tiles[ty * m.cols + tx] !== SECRET) continue;
      const x = X(tx), y = Y(ty);
      ctx.fillStyle = "#26303D";
      ctx.fillRect(x, y, t + 0.6, t + 0.6);
      ctx.fillStyle = "#3B4A5C";
      for (let k = 0; k < 4; k++) ctx.fillRect(x + t * 0.12, y + t * (0.14 + k * 0.2), t * 0.76, t * 0.1);
      ctx.strokeStyle = `rgba(120,220,255,${glow})`;
      ctx.lineWidth = Math.max(1.5, t * 0.07);
      ctx.strokeRect(x + t * 0.05, y + t * 0.05, t * 0.9, t * 0.9);
    }
  }

  // Walls: a top everywhere, and a front face where the wall looks into a room.
  const face = t * 0.5;
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    if (!isWall(tx, ty)) continue;
    const x = X(tx), y = Y(ty);
    const open = !isWall(tx, ty + 1);
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
    if (!isWall(tx, ty)) continue;
    const x = X(tx), y = Y(ty);
    if (!isWall(tx, ty - 1)) { ctx.moveTo(x, y); ctx.lineTo(x + t, y); }
    if (!isWall(tx - 1, ty)) { ctx.moveTo(x, y); ctx.lineTo(x, y + t); }
    if (!isWall(tx + 1, ty)) { ctx.moveTo(x + t, y); ctx.lineTo(x + t, y + t); }
  }
  ctx.stroke();
};

const BOOKS = ["#E07A5F", "#F2CC8F", "#81B29A", "#8AB6D6", "#C08BD6", "#E8E1CF"];

/** One piece of furniture over its whole footprint, at screen (x, y); t is a tile in px. */
const drawProp = (ctx: CanvasRenderingContext2D, p: Prop, x: number, y: number, t: number) => {
  const W = p.w * t, H = p.h * t, pad = t * 0.08;
  const each = (fn: (cx: number, cy: number) => void) => {
    for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) fn(x + i * t, y + j * t);
  };
  if (p.kind !== "mat") {
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    rr(ctx, x + pad + t * 0.07, y + pad + t * 0.12, W - pad * 2, H - pad * 2, t * 0.14); ctx.fill();
  }
  const vertical = p.h > p.w;
  switch (p.kind) {
    case "crate":
      each((cx, cy) => {
        ctx.fillStyle = "#A0713F"; rr(ctx, cx + pad, cy + pad, t - pad * 2, t - pad * 2, t * 0.06); ctx.fill();
        ctx.strokeStyle = "#6E4A24"; ctx.lineWidth = Math.max(1, t * 0.06);
        ctx.strokeRect(cx + pad * 1.8, cy + pad * 1.8, t - pad * 3.6, t - pad * 3.6);
        ctx.beginPath(); ctx.moveTo(cx + pad * 1.8, cy + pad * 1.8); ctx.lineTo(cx + t - pad * 1.8, cy + t - pad * 1.8); ctx.stroke();
      });
      break;
    case "barrel":
      each((cx, cy) => {
        ctx.fillStyle = p.seed % 2 ? "#3D6FA3" : "#B0463A";
        ctx.beginPath(); ctx.arc(cx + t / 2, cy + t / 2, t * 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = Math.max(1, t * 0.06);
        ctx.beginPath(); ctx.arc(cx + t / 2, cy + t / 2, t * 0.27, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath(); ctx.arc(cx + t * 0.4, cy + t * 0.38, t * 0.07, 0, Math.PI * 2); ctx.fill();
      });
      break;
    case "table": {
      // Chairs tucked around it, then the top.
      ctx.fillStyle = "#6B5A48";
      const seats = Math.max(2, (p.w + p.h) * 2 - 2);
      for (let k = 0; k < seats; k++) {
        const a = (k / seats) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(x + W / 2 + Math.cos(a) * (W / 2 - t * 0.05), y + H / 2 + Math.sin(a) * (H / 2 - t * 0.05), t * 0.13, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#E4DFD2"; rr(ctx, x + pad * 2, y + pad * 2, W - pad * 4, H - pad * 4, t * 0.2); ctx.fill();
      ctx.fillStyle = BOOKS[p.seed % BOOKS.length];
      ctx.beginPath(); ctx.arc(x + W * 0.35, y + H * 0.45, t * 0.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath(); ctx.arc(x + W * 0.62, y + H * 0.55, t * 0.12, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case "plant":
      each((cx, cy) => {
        ctx.fillStyle = "#8A5A3A"; ctx.beginPath(); ctx.arc(cx + t / 2, cy + t / 2, t * 0.28, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = p.seed % 2 ? "#3F8F45" : "#4FA35A";
        for (let k = 0; k < 6; k++) {
          const a = k * 1.047 + p.seed;
          ctx.beginPath(); ctx.arc(cx + t / 2 + Math.cos(a) * t * 0.17, cy + t / 2 + Math.sin(a) * t * 0.17, t * 0.19, 0, Math.PI * 2); ctx.fill();
        }
      });
      break;
    case "shelf": {
      ctx.fillStyle = "#5A4332"; rr(ctx, x + pad, y + pad, W - pad * 2, H - pad * 2, t * 0.05); ctx.fill();
      const n = Math.round((vertical ? H : W) / (t * 0.2));
      for (let k = 0; k < n; k++) {
        ctx.fillStyle = BOOKS[(p.seed + k * 7) % BOOKS.length];
        if (vertical) ctx.fillRect(x + pad * 1.8, y + pad * 1.8 + k * ((H - pad * 3.6) / n), W - pad * 3.6, (H - pad * 3.6) / n - 1);
        else ctx.fillRect(x + pad * 1.8 + k * ((W - pad * 3.6) / n), y + pad * 1.8, (W - pad * 3.6) / n - 1, H - pad * 3.6);
      }
      break;
    }
    case "desk":
      ctx.fillStyle = "#B08556"; rr(ctx, x + pad, y + pad * 1.5, W - pad * 2, H - pad * 3, t * 0.08); ctx.fill();
      ctx.fillStyle = "#F4F1EA"; ctx.fillRect(x + W * 0.18, y + H * 0.3, t * 0.3, t * 0.36);
      if (p.w > 1) {
        ctx.fillStyle = "#1F2633"; rr(ctx, x + W * 0.55, y + H * 0.22, t * 0.62, t * 0.4, t * 0.05); ctx.fill();
        ctx.fillStyle = "#5AB0E0"; ctx.fillRect(x + W * 0.55 + t * 0.05, y + H * 0.22 + t * 0.05, t * 0.52, t * 0.3);
      }
      break;
    case "bed":
      ctx.fillStyle = "#EDEFF3"; rr(ctx, x + pad, y + pad, W - pad * 2, H - pad * 2, t * 0.12); ctx.fill();
      ctx.fillStyle = "#FFFFFF"; rr(ctx, x + pad * 2, y + pad * 2, W - pad * 4, t * 0.38, t * 0.1); ctx.fill();
      ctx.fillStyle = ["#7FB3C4", "#A99BE0", "#F08A8A"][p.seed % 3];
      rr(ctx, x + pad, y + H * 0.42, W - pad * 2, H * 0.58 - pad, t * 0.1); ctx.fill();
      break;
    case "couch": {
      const c = ["#8A4F7D", "#4F7D8A", "#7D6A4F"][p.seed % 3];
      ctx.fillStyle = c; rr(ctx, x + pad, y + pad, W - pad * 2, H - pad * 2, t * 0.2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      const n = Math.max(p.w, p.h);
      for (let k = 0; k < n; k++) {
        if (vertical) { rr(ctx, x + t * 0.3, y + t * (0.2 + k), W - t * 0.45, t * 0.62, t * 0.12); ctx.fill(); }
        else { rr(ctx, x + t * (0.2 + k), y + t * 0.3, t * 0.62, H - t * 0.45, t * 0.12); ctx.fill(); }
      }
      break;
    }
    case "locker":
      each((cx, cy) => {
        ctx.fillStyle = "#5C7A99"; rr(ctx, cx + pad, cy + pad, t - pad * 2, t - pad * 2, t * 0.04); ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        for (let k = 0; k < 3; k++) ctx.fillRect(cx + t * 0.28, cy + t * (0.22 + k * 0.1), t * 0.44, t * 0.04);
        ctx.fillStyle = "#D8DEE6"; ctx.fillRect(cx + t * 0.7, cy + t * 0.55, t * 0.08, t * 0.14);
      });
      break;
    case "rack":
      ctx.fillStyle = "#151A22"; rr(ctx, x + pad, y + pad, W - pad * 2, H - pad * 2, t * 0.05); ctx.fill();
      each((cx, cy) => {
        for (let k = 0; k < 4; k++) {
          ctx.fillStyle = "#2A3240"; ctx.fillRect(cx + t * 0.16, cy + t * (0.14 + k * 0.19), t * 0.68, t * 0.12);
          const on = Math.sin(performance.now() * 0.004 + p.seed + k * 1.7 + cx) > 0;
          ctx.fillStyle = on ? "#5CE08A" : "#2E6B45";
          ctx.fillRect(cx + t * 0.7, cy + t * (0.16 + k * 0.19), t * 0.08, t * 0.08);
        }
      });
      break;
    case "bench": {
      ctx.fillStyle = "#C9CED6"; rr(ctx, x + pad, y + pad, W - pad * 2, H - pad * 2, t * 0.08); ctx.fill();
      const tubes = ["#6CC04A", "#E05D5D", "#5AB0E0", "#E0A93A"];
      each((cx, cy) => {
        for (let k = 0; k < 2; k++) {
          ctx.fillStyle = tubes[(p.seed + k + Math.round(cx)) % 4];
          ctx.beginPath(); ctx.arc(cx + t * (0.32 + k * 0.36), cy + t * 0.5, t * 0.12, 0, Math.PI * 2); ctx.fill();
        }
      });
      break;
    }
    case "piano":
      ctx.fillStyle = "#15171C"; rr(ctx, x + pad, y + pad, W - pad * 2, H - pad * 2, t * 0.1); ctx.fill();
      ctx.fillStyle = "#F4F1EA"; ctx.fillRect(x + pad * 2, y + H - pad * 2 - t * 0.28, W - pad * 4, t * 0.28);
      ctx.fillStyle = "#15171C";
      for (let k = 1; k < 12; k++) if (k % 3) ctx.fillRect(x + pad * 2 + k * ((W - pad * 4) / 12) - 1, y + H - pad * 2 - t * 0.28, 2, t * 0.16);
      break;
    case "easel":
      ctx.strokeStyle = "#7A5230"; ctx.lineWidth = Math.max(1.5, t * 0.07);
      ctx.beginPath(); ctx.moveTo(x + t * 0.2, y + t * 0.9); ctx.lineTo(x + t * 0.5, y + t * 0.1); ctx.lineTo(x + t * 0.8, y + t * 0.9); ctx.stroke();
      ctx.fillStyle = "#FFFFFF"; ctx.fillRect(x + t * 0.22, y + t * 0.22, t * 0.56, t * 0.44);
      ctx.fillStyle = BOOKS[p.seed % BOOKS.length];
      ctx.beginPath(); ctx.arc(x + t * 0.45, y + t * 0.42, t * 0.12, 0, Math.PI * 2); ctx.fill();
      break;
    case "mat":
      ctx.fillStyle = "#2F6FB0"; rr(ctx, x + pad, y + pad, W - pad * 2, H - pad * 2, t * 0.12); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = Math.max(1, t * 0.04);
      ctx.setLineDash([t * 0.12, t * 0.1]);
      rr(ctx, x + pad * 2.5, y + pad * 2.5, W - pad * 5, H - pad * 5, t * 0.08); ctx.stroke();
      ctx.setLineDash([]);
      break;
  }
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
  /** Caught in a Freeze: an ice block around the body. */
  frozen?: boolean;
  /** Caught in a Scream: green sound rings. */
  slowed?: boolean;
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

  if (look.frozen) {
    ctx.fillStyle = "rgba(190,235,255,0.55)";
    rr(ctx, x - r * 1.25, by - r * 1.25, r * 2.5, r * 2.5, r * 0.45); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = Math.max(1.5, r * 0.1);
    rr(ctx, x - r * 1.25, by - r * 1.25, r * 2.5, r * 2.5, r * 0.45); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - r * 0.9, by - r * 0.6); ctx.lineTo(x - r * 0.4, by - r * 1.0);
    ctx.moveTo(x + r * 0.5, by + r * 0.9); ctx.lineTo(x + r * 0.95, by + r * 0.4);
    ctx.stroke();
  }

  if (look.slowed) {
    ctx.strokeStyle = "rgba(108,192,74,0.7)";
    ctx.lineWidth = Math.max(1.5, r * 0.1);
    for (let k = 0; k < 2; k++) {
      const ph = ((t * 0.002 + k * 0.5) % 1);
      ctx.globalAlpha = (look.alpha ?? 1) * (1 - ph);
      ctx.beginPath(); ctx.arc(x, by, r * (1.1 + ph * 0.9), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = look.alpha ?? 1;
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

const miniCache = new WeakMap<HvzMap, { human?: HTMLCanvasElement; zombie?: HTMLCanvasElement }>();

/** Overview of the whole building (rooms, halls) with you and, when sensing, the humans. */
export const drawMinimap = (
  ctx: CanvasRenderingContext2D, m: HvzMap, x: number, y: number, w: number,
  me: { x: number; y: number; zombie: boolean }, marks: { x: number; y: number; color: string }[],
) => {
  const cache = miniCache.get(m) ?? {};
  miniCache.set(m, cache);
  const key = me.zombie ? "zombie" : "human";
  let img = cache[key];
  if (!img) {
    img = document.createElement("canvas");
    img.width = m.cols; img.height = m.rows;
    const c = img.getContext("2d")!;
    const data = c.createImageData(m.cols, m.rows);
    for (let i = 0; i < m.tiles.length; i++) {
      const safe = m.safe >= 0 && (m.roomOf[i] === m.safe || m.tiles[i] === SECRET);
      const open = m.tiles[i] !== WALL && !(safe && me.zombie);
      const room = m.roomOf[i] >= 0;
      const [r, g, b] = safe ? [110, 200, 240] : room ? [150, 165, 180] : [110, 120, 135];
      data.data[i * 4 + 0] = r;
      data.data[i * 4 + 1] = g;
      data.data[i * 4 + 2] = b;
      data.data[i * 4 + 3] = open ? 255 : 0;
    }
    c.putImageData(data, 0, 0);
    cache[key] = img;
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

/** A power-up box on the floor: a glowing, bobbing crate with a bolt on it. */
export const drawPowerBox = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, t: number) => {
  const bob = Math.sin(t * 0.004) * size * 0.12;
  const h = size;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath(); ctx.ellipse(x, y + h * 0.55, h * 0.5, h * 0.18, 0, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createRadialGradient(x, y + bob, 0, x, y + bob, h * 1.3);
  g.addColorStop(0, "rgba(255,224,102,0.55)");
  g.addColorStop(1, "rgba(255,224,102,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y + bob, h * 1.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#7C4DDB";
  rr(ctx, x - h / 2, y - h / 2 + bob, h, h, h * 0.2); ctx.fill();
  ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = Math.max(1.5, h * 0.08);
  rr(ctx, x - h / 2, y - h / 2 + bob, h, h, h * 0.2); ctx.stroke();
  ctx.fillStyle = "#FFE066";
  ctx.beginPath();
  ctx.moveTo(x + h * 0.08, y - h * 0.34 + bob);
  ctx.lineTo(x - h * 0.2, y + h * 0.06 + bob);
  ctx.lineTo(x - h * 0.01, y + h * 0.06 + bob);
  ctx.lineTo(x - h * 0.08, y + h * 0.34 + bob);
  ctx.lineTo(x + h * 0.2, y - h * 0.06 + bob);
  ctx.lineTo(x + h * 0.01, y - h * 0.06 + bob);
  ctx.closePath(); ctx.fill();
  ctx.restore();
};
