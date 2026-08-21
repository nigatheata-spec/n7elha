// ── Humans vs Zombies — battle scene painting ───────────────────────────────
// A painted battlefield plate with two live armies on the road between the two
// keeps. Two things are load-bearing rather than decorative:
//
//  • every soldier is a real player, drawn with their name over their head, so
//    a student watching the projector can find themselves in the line;
//  • the front line sits wherever the two teams' health says it should, so the
//    picture and the health bars always tell the same story.
//
// All geometry is in the SOURCE plate's pixel space (1407×768) and mapped to
// the canvas last, so the anchors below stay meaningful at any projector size.

const SRC_W = 1407;
const SRC_H = 768;

/**
 * Where each army's road begins, in source-image pixels.
 *
 * Hand-read off the plate: the human anchor sits at the far end of the castle's
 * stone bridge, the zombie anchor at its gatehouse. The march path is the
 * straight segment between them, which tracks the painted road closely enough
 * that units read as walking on it.
 */
const HUMAN_ANCHOR = { x: 466, y: 384 };
const ZOMBIE_ANCHOR = { x: 1118, y: 583 };

/** Sprite height in source pixels, at depth 1. */
const UNIT_H = 76;

/** Layout: lanes run across the road, ranks run back from the front line. */
const LANES = 3;
const LANE_GAP = 46;      // perpendicular spacing, source px
const RANK_GAP = 0.078;   // spacing back along the path, in path-t units

/**
 * Half-width of no-man's-land, in path-t units.
 *
 * The two front ranks stop this far short of the line from either side. Without
 * it the armies walk through each other and the melee reads as one mixed blob
 * instead of two sides meeting.
 */
const CLASH_GAP = 0.062;

/** One attack every this many ms, per soldier, offset so they never sync up. */
const ATTACK_MS = 1500;

export type Fighter = { id: string; name: string };

export type BattleState = {
  /** The real rosters. One soldier is drawn per player. */
  humans: Fighter[];
  zombies: Fighter[];
  /** 0..1 share of max health remaining — drives the front line only. */
  humanPct: number;
  zombiePct: number;
  /** Milliseconds, for the march and attack animation. */
  t: number;
};

export type BattleSprites = {
  field: HTMLImageElement;
  knight: HTMLImageElement;
  zombie: HTMLImageElement;
};

/** Deterministic per-unit jitter — a real RNG would make the army shimmer. */
const hash = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};
/** Stable 0..1 from a player id, so a given student always stands in the same
 *  spot and swings on the same beat between frames. */
const hashStr = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return hash(Math.abs(h) % 9973);
};

/**
 * Front-line position along the path, 0 = human gate, 1 = zombie gate.
 *
 * Driven by the health *difference*, so an even fight holds the middle and a
 * rout pushes the loser back toward their own wall. Clamped short of the gates
 * so an army never renders inside a keep.
 */
export const frontLineT = (humanPct: number, zombiePct: number) =>
  Math.max(0.18, Math.min(0.82, 0.5 + (humanPct - zombiePct) * 0.32));

/**
 * One attack cycle: wind up, strike, recover, rest.
 *
 * Returns forward offset in source px plus whether this frame is the moment of
 * impact. A sine wave was the old approach and read as bobbing rather than
 * fighting — the asymmetry here (slow pull back, fast strike, slower recovery)
 * is what makes it look like effort.
 */
const attack = (u: number): { push: number; hit: boolean } => {
  if (u < 0.22) return { push: -3 * (u / 0.22), hit: false };            // wind up
  if (u < 0.32) {                                                        // strike
    const k = (u - 0.22) / 0.10;
    return { push: -3 + 21 * k * k, hit: k > 0.82 };                     // accelerates
  }
  if (u < 0.62) {                                                        // recover
    const k = (u - 0.32) / 0.30;
    return { push: 18 * (1 - k), hit: false };
  }
  return { push: 0, hit: false };                                        // rest
};

type Placed = {
  x: number; y: number; scale: number; push: number; hit: boolean; name: string;
};

/**
 * Lay one army out behind its side of the front line.
 *
 * `dir` is -1 for the humans (ranks trail back toward t=0) and +1 for the
 * zombies. Units further along the path sit lower on screen and are drawn
 * larger, which is what sells the isometric depth.
 */
const placeArmy = (
  fighters: Fighter[], frontT: number, dir: -1 | 1, t: number,
): Placed[] => {
  const dx = ZOMBIE_ANCHOR.x - HUMAN_ANCHOR.x;
  const dy = ZOMBIE_ANCHOR.y - HUMAN_ANCHOR.y;
  const len = Math.hypot(dx, dy);
  const px = -dy / len, py = dx / len; // perpendicular to the road

  const out: Placed[] = [];
  for (let i = 0; i < fighters.length; i++) {
    const f = fighters[i];
    const j = hashStr(f.id || String(i));
    const lane = (i % LANES) - (LANES - 1) / 2;
    const rank = Math.floor(i / LANES);

    // Ranks step back from the line, starting outside no-man's-land.
    const ut = frontT + dir * (CLASH_GAP + rank * RANK_GAP) + (j - 0.5) * 0.008;
    const bx = HUMAN_ANCHOR.x + dx * ut;
    const by = HUMAN_ANCHOR.y + dy * ut;

    const spread = (lane + (j - 0.5) * 0.45) * LANE_GAP;
    const x = bx + px * spread;
    const y = by + py * spread;

    // Only the front rank is in reach; those behind press forward on the spot.
    const phase = j;
    const u = ((t / ATTACK_MS) + phase) % 1;
    const a = rank === 0 ? attack(u) : { push: 0, hit: false };
    const bob = rank === 0 ? 0 : Math.sin(t / 420 + phase * 6.283) * 1.5;

    const depth = (y - HUMAN_ANCHOR.y) / (ZOMBIE_ANCHOR.y - HUMAN_ANCHOR.y);
    const scale = 0.88 + Math.max(0, Math.min(1, depth)) * 0.24;

    out.push({ x, y: y + bob, scale, push: a.push, hit: a.hit, name: f.name });
  }
  // Painter's order: further back first, so near units overlap far ones.
  return out.sort((a, b) => a.y - b.y);
};

/** A burst of sparks where a blow actually lands. */
const drawImpact = (ctx: CanvasRenderingContext2D, cx: number, cy: number, seed: number) => {
  for (let i = 0; i < 7; i++) {
    const j = hash(seed + i * 2.3);
    const ang = j * Math.PI * 2;
    const r = 3 + j * 11;
    const x = cx + Math.cos(ang) * r;
    const y = cy + Math.sin(ang) * r * 0.5;
    ctx.fillStyle = i % 2 === 0 ? "rgba(255,240,180,0.95)" : "rgba(255,190,90,0.8)";
    ctx.fillRect(Math.round(x), Math.round(y), 2.5, 2.5);
  }
};

/** Name plate over a soldier's head, so players can find themselves. */
const drawName = (
  ctx: CanvasRenderingContext2D, cx: number, topY: number, name: string, s: number,
) => {
  if (!name) return;
  const fs = Math.max(8, 11 * s);
  ctx.font = `700 ${fs}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const label = name.length > 9 ? name.slice(0, 8) + "…" : name;
  const w = ctx.measureText(label).width + 8 * s;
  const h = fs + 5 * s;
  ctx.fillStyle = "rgba(12,18,14,0.78)";
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, topY - h - 3 * s, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillText(label, cx, topY - h / 2 - 3 * s);
};

/**
 * Paint the whole scene.
 *
 * The plate is drawn "contain": the entire battlefield is always visible, never
 * cropped. Unit coordinates go through the same transform, so they stay glued
 * to the road at any panel size.
 */
export const drawBattle = (
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  sprites: BattleSprites,
  state: BattleState,
) => {
  const { field, knight, zombie } = sprites;

  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false; // keep the pixel art crisp when upscaled

  const scale = Math.min(w / SRC_W, h / SRC_H);
  const offX = (w - SRC_W * scale) / 2;
  const offY = (h - SRC_H * scale) / 2;
  const S = (v: number) => v * scale;
  const X = (v: number) => offX + v * scale;
  const Y = (v: number) => offY + v * scale;

  if (field.complete && field.naturalWidth) {
    ctx.drawImage(field, offX, offY, SRC_W * scale, SRC_H * scale);
  } else {
    ctx.fillStyle = "#6aa84f";
    ctx.fillRect(offX, offY, SRC_W * scale, SRC_H * scale);
  }

  const frontT = frontLineT(state.humanPct, state.zombiePct);
  const humans = placeArmy(state.humans, frontT, -1, state.t);
  const zombies = placeArmy(state.zombies, frontT, 1, state.t);

  const impacts: { x: number; y: number; seed: number }[] = [];

  const blit = (img: HTMLImageElement, p: Placed, toward: 1 | -1) => {
    if (!img.complete || !img.naturalWidth) return;
    const hgt = S(UNIT_H * p.scale);
    const wid = hgt * (img.naturalWidth / img.naturalHeight);
    const footX = X(p.x) + S(p.push) * toward;
    const footY = Y(p.y);

    // contact shadow, so units sit on the ground rather than float over it
    ctx.fillStyle = "rgba(20,30,16,0.30)";
    ctx.beginPath();
    ctx.ellipse(footX, footY, wid * 0.28, hgt * 0.065, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.drawImage(img, footX - wid / 2, footY - hgt, wid, hgt);
    drawName(ctx, footX, footY - hgt, p.name, scale);

    // Weapon reach is roughly half a body ahead of the sprite.
    if (p.hit) impacts.push({ x: footX + toward * wid * 0.5, y: footY - hgt * 0.45, seed: p.x });
  };

  // Interleave both armies by depth so the line reads as one melee front.
  const all: { p: Placed; img: HTMLImageElement; toward: 1 | -1 }[] = [
    ...humans.map(p => ({ p, img: knight, toward: 1 as const })),
    ...zombies.map(p => ({ p, img: zombie, toward: -1 as const })),
  ].sort((a, b) => a.p.y - b.p.y);

  for (const u of all) blit(u.img, u.p, u.toward);
  for (const im of impacts) drawImpact(ctx, im.x, im.y, im.seed);
};
