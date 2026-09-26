// ── Humans vs Zombies — the rules and the map ───────────────────────────────
// A top-down infection game on a building of rooms and hallways, Among Us
// style. Every phone renders the map around its own player (the projector only
// keeps score). A few players start as zombies; a zombie that touches a human
// turns them. Humans carry a stun gun: each hit freezes a zombie and costs it a
// life, and a zombie out of lives is knocked back to the lab until it answers
// its way back in. Humans win if anyone is still human when the clock runs out.
//
// Questions are the only fuel. Walking drains an energy tank for both teams and
// only a correct answer refills it, so nobody gets far without answering. A
// correct answer also brings ammo (humans) or a sprint (zombies), and three in
// a row adds a perk: a shield for a human, a few seconds of sensing every human
// for a zombie. While a question is up you stand still, so where you answer is
// half the game.
//
// One room is the safe room: its entrances are secret hatches only humans can
// see or pass. A human gets SAFE_ROOM.stayMs inside, then is pushed out and the
// hatches stay shut to them for SAFE_ROOM.lockMs — somewhere to catch your
// breath and reload, not somewhere to wait out the match.
//
// Sync follows Paint Fight: positions are a cosmetic broadcast, and every
// client is authoritative over its own fate and nothing else. A human decides
// it was tagged (a zombie's broadcast position overlapped it), a zombie decides
// it was stunned (a broadcast bullet reached it). The only persistent write for
// the fight is your own `game_students.team` flipping to "zombie", which is
// what the projector counts.
//
// Everything in this file is pure: the map is a function of the session id and
// the room grid chosen at Start, so every phone builds the identical building
// without shipping it over the wire.

export type Team = "human" | "zombie";

/** World px per tile. */
export const TILE = 40;
export const PLAYER_R = 17;
export const HUMAN_SPEED = 170;
export const ZOMBIE_SPEED = 155;
export const SPRINT = { mult: 1.65, ms: 2600 };
export const STUN_MS = 3000;
/** Zombie touches a human can take; the last one turns them. */
export const HUMAN_LIVES = 3;
/** After losing a life a human can't be touched again for this long, and is shoved clear. */
export const BITE_GRACE_MS = 2000;
export const BITE_KNOCKBACK = 70;
/** Stuns a zombie can take; the last one knocks it out. */
export const ZOMBIE_LIVES = 3;
/** Correct answers a knocked-out zombie needs to get back up. */
export const KO_ANSWERS = 2;
/** A freshly turned zombie stands still for this long before it can hunt. */
export const TURNING_MS = 2000;
/** Zombies are held in the lab while the humans scatter. */
export const HEAD_START_MS = 10_000;
/** After a shield pops, a moment where the same zombie can't tag you again. */
export const SHIELD_GRACE_MS = 1500;
export const BULLET = { speed: 620, range: 420, radius: 5 };
export const AMMO = { start: 3, perCorrect: 2, max: 12 };
export const CHARGES = { start: 1, perCorrect: 1, max: 5 };
/** Walking burns energy; nothing but a correct answer puts it back. */
export const ENERGY = { max: 100, start: 100, drainPerSec: 4.5, perCorrect: 30, low: 25 };
export const SAFE_ROOM = { stayMs: 60_000, lockMs: 60_000 };
/** Correct answers in a row that earn the team perk. */
export const PERK_STREAK = 3;
export const SENSE_MS = 7000;
export const VISION = { human: 300, zombie: 270 };
/** Centre-to-centre distance at which a zombie has touched a human. */
export const TAG_DIST = PLAYER_R * 2 - 3;
export const POINTS = { infect: 100, bite: 30, stun: 25, knockout: 50, correct: 10, survive: 300 };

/**
 * Power-up boxes. Where they are is a pure function of the session and a time
 * slot (like Paint Fight's golden drops), so every phone agrees without a
 * server; a grab is broadcast. Whoever reaches one gets their team's power:
 * a human a Freeze (every zombie in range frozen, no life lost), a zombie a
 * Scream (every human in range slowed).
 */
export const POWER = { slotMs: 20_000, grabR: 30, radius: 300, freezeMs: 4000, screamMs: 4000, slowMult: 0.5 };
export type PowerBox = { id: string; x: number; y: number };
export const BROADCAST_MS = 70;
export const PEER_TIMEOUT_MS = 4000;

/** Room grid for a roster, fixed at Start: about two players a room. */
export const roomsFor = (players: number): [number, number] =>
  players <= 6 ? [3, 3] : players <= 12 ? [4, 3] : players <= 18 ? [4, 4]
    : players <= 26 ? [5, 4] : players <= 34 ? [5, 5] : [6, 5];

/** How many start as zombies. Always at least one human and, with company, one zombie. */
export const zeroCount = (players: number) =>
  players <= 1 ? 0 : Math.max(1, Math.min(players - 1, Math.round(players / 6)));

// ── Seeded randomness ───────────────────────────────────────────────────────

export const seedOf = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

export const mulberry32 = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ── The building ────────────────────────────────────────────────────────────

/** SECRET is a safe-room hatch: floor to a human, wall to a zombie. */
export const FLOOR = 0, WALL = 1, PROP = 2, SECRET = 3;

export type PropKind =
  | "crate" | "table" | "plant" | "shelf" | "desk" | "bed" | "couch" | "locker"
  | "barrel" | "rack" | "bench" | "piano" | "easel" | "mat";

/** A furniture piece and the footprints it comes in (w × h tiles). */
type PropSpec = { kind: PropKind; sizes: [number, number][] };

export type RoomKind = {
  key: string; en: string; ar: string; floor: string; tile: string;
  props: PropSpec[];
  /** A rug under the middle of the room, or none. */
  rug?: string;
  /** Lay desks out in rows instead of scattering (classrooms). */
  rows?: boolean;
};

const P = (kind: PropKind, ...sizes: [number, number][]): PropSpec => ({ kind, sizes });

/** Room 0 is always the lab, where the zombies come from. */
export const LAB: RoomKind = {
  key: "lab", en: "LAB", ar: "المختبر", floor: "#3E5C4A", tile: "#476B55",
  props: [P("bench", [2, 1], [1, 2], [3, 1]), P("barrel", [1, 1]), P("rack", [1, 2])],
};
export const SAFE: RoomKind = {
  key: "safe", en: "SAFE ROOM", ar: "الغرفة الآمنة", floor: "#2C5670", tile: "#325F7B", rug: "#3C7596",
  props: [P("couch", [2, 1], [1, 2]), P("bed", [1, 2]), P("crate", [1, 1]), P("locker", [1, 1])],
};
export const ROOM_KINDS: RoomKind[] = [
  { key: "cafeteria", en: "CAFETERIA", ar: "الكافتيريا", floor: "#8A6B4E", tile: "#957558",
    props: [P("table", [2, 2], [2, 1], [3, 1]), P("plant", [1, 1])] },
  { key: "library", en: "LIBRARY", ar: "المكتبة", floor: "#6B4F63", tile: "#76596D", rug: "#8A3F4F",
    props: [P("shelf", [3, 1], [2, 1], [1, 3]), P("table", [2, 1]), P("plant", [1, 1])] },
  { key: "gym", en: "GYM", ar: "الصالة", floor: "#A77B45", tile: "#B1854E",
    props: [P("mat", [2, 2], [3, 2]), P("locker", [1, 1], [2, 1]), P("barrel", [1, 1])] },
  { key: "classroom", en: "CLASSROOM", ar: "الفصل", floor: "#4F6A86", tile: "#587491", rows: true,
    props: [P("desk", [1, 1])] },
  { key: "storage", en: "STORAGE", ar: "المخزن", floor: "#5D5A55", tile: "#67645E",
    props: [P("crate", [1, 1], [2, 1], [2, 2]), P("barrel", [1, 1]), P("shelf", [2, 1], [1, 2])] },
  { key: "office", en: "OFFICE", ar: "المكتب", floor: "#546B6E", tile: "#5D7579", rug: "#6E5A3F",
    props: [P("desk", [2, 1]), P("couch", [2, 1]), P("plant", [1, 1]), P("shelf", [2, 1])] },
  { key: "clinic", en: "CLINIC", ar: "العيادة", floor: "#7E8E99", tile: "#8998A3",
    props: [P("bed", [1, 2]), P("locker", [1, 1]), P("plant", [1, 1])] },
  { key: "music", en: "MUSIC", ar: "الموسيقى", floor: "#7A4F4F", tile: "#855858", rug: "#4F3A6E",
    props: [P("piano", [2, 1]), P("couch", [2, 1]), P("plant", [1, 1]), P("shelf", [1, 2])] },
  { key: "art", en: "ART ROOM", ar: "الفنون", floor: "#8C7A4A", tile: "#968454",
    props: [P("easel", [1, 1]), P("table", [2, 1], [2, 2]), P("plant", [1, 1])] },
  { key: "server", en: "SERVERS", ar: "الخوادم", floor: "#3F4A63", tile: "#48546E",
    props: [P("rack", [1, 2], [1, 3], [2, 1])] },
];

export type Room = { x: number; y: number; w: number; h: number; cx: number; cy: number; kind: RoomKind };
export type Prop = { x: number; y: number; w: number; h: number; kind: PropKind; seed: number };

export type HvzMap = {
  cols: number; rows: number;
  /** FLOOR / WALL / PROP / SECRET per tile, row-major. */
  tiles: Uint8Array;
  /** Room index per tile, -1 for hallway and wall. */
  roomOf: Int16Array;
  rooms: Room[];
  props: Prop[];
  /** Index of the safe room, or -1 on a building too small for one. */
  safe: number;
  /** Hallway spots just outside each hatch: where a human is put when their time is up. */
  safeExits: { x: number; y: number }[];
};

const ROOM_BLOCK = 16;

/**
 * A building of rw × rh rooms joined by three-tile hallways: a random spanning
 * tree so every room is reachable, plus a third of the remaining links so there
 * are loops to run around — a building with dead ends only is a trap. The safe
 * room is kept out of the tree and joined to its neighbours by hatches only,
 * so zombies can still reach every other room without passing through it.
 */
export const buildMap = (seed: string, rw: number, rh: number): HvzMap => {
  const rnd = mulberry32(seedOf(seed));
  const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const cols = rw * ROOM_BLOCK + 1, rows = rh * ROOM_BLOCK + 1;
  const tiles = new Uint8Array(cols * rows).fill(WALL);
  const roomOf = new Int16Array(cols * rows).fill(-1);
  const set = (x: number, y: number, v: number) => {
    if (x > 0 && y > 0 && x < cols - 1 && y < rows - 1 && tiles[y * cols + x] !== FLOOR) tiles[y * cols + x] = v;
  };

  // The safe room: away from the lab, never on the lab's row or column edge.
  const n = rw * rh;
  let safe = -1;
  if (n >= 6) {
    const far = [];
    for (let i = 1; i < n; i++) if ((i % rw) + Math.floor(i / rw) >= Math.ceil((rw + rh) / 2) - 1) far.push(i);
    safe = far.length ? pick(far) : n - 1;
  }

  const kinds = [...ROOM_KINDS].sort(() => rnd() - 0.5);
  const rooms: Room[] = [];
  for (let j = 0; j < rh; j++) {
    for (let i = 0; i < rw; i++) {
      const idx = rooms.length;
      const ox = i * ROOM_BLOCK + 1, oy = j * ROOM_BLOCK + 1;
      const small = idx === safe;
      const w = small ? ri(8, 9) : ri(10, 13), h = small ? ri(7, 8) : ri(9, 12);
      const x = ox + ri(1, ROOM_BLOCK - 1 - w - 1), y = oy + ri(1, ROOM_BLOCK - 1 - h - 1);
      const kind = idx === 0 ? LAB : idx === safe ? SAFE : kinds[(idx - 1) % kinds.length];
      rooms.push({ x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2), kind });
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
        tiles[yy * cols + xx] = FLOOR;
        roomOf[yy * cols + xx] = idx;
      }
    }
  }

  // Links between grid neighbours, then Kruskal for the tree (safe room aside).
  const edges: [number, number][] = [];
  for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) {
    const a = j * rw + i;
    if (i + 1 < rw) edges.push([a, a + 1]);
    if (j + 1 < rh) edges.push([a, a + rw]);
  }
  edges.sort(() => rnd() - 0.5);
  const parent = rooms.map((_, i) => i);
  const find = (a: number): number => (parent[a] === a ? a : (parent[a] = find(parent[a])));
  const links: [number, number][] = [];
  const hatches: [number, number][] = [];
  for (const [a, b] of edges) {
    if (a === safe || b === safe) { hatches.push([a, b]); continue; }
    const ra = find(a), rb = find(b);
    if (ra !== rb) { parent[ra] = rb; links.push([a, b]); }
    else if (rnd() < 0.35) links.push([a, b]);
  }

  const carveH = (x0: number, x1: number, y: number) => {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let d = -1; d <= 1; d++) set(x, y + d, FLOOR);
  };
  const carveV = (y0: number, y1: number, x: number) => {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let d = -1; d <= 1; d++) set(x + d, y, FLOOR);
  };
  const corridor = (a: number, b: number) => {
    const A = rooms[a], B = rooms[b];
    if (b === a + 1) {
      const mid = Math.round((A.x + A.w + B.x) / 2);
      carveH(A.cx, mid, A.cy); carveV(A.cy, B.cy, mid); carveH(mid, B.cx, B.cy);
    } else {
      const mid = Math.round((A.y + A.h + B.y) / 2);
      carveV(A.cy, mid, A.cx); carveH(A.cx, B.cx, mid); carveV(mid, B.cy, B.cx);
    }
  };
  for (const [a, b] of links) corridor(a, b);

  // The safe room's own passages: carve them like any hallway, then turn the
  // stretch next to the room into hatches. Anything carved that isn't next to
  // the room joins the ordinary hallways, which is fine — it's only the last
  // step in that has to be secret.
  const safeExits: { x: number; y: number }[] = [];
  if (safe >= 0) {
    const before = new Uint8Array(tiles);
    for (const [a, b] of hatches) corridor(a, b);
    const S = rooms[safe];
    for (let y = S.y - 1; y <= S.y + S.h; y++) for (let x = S.x - 1; x <= S.x + S.w; x++) {
      const i = y * cols + x;
      if (roomOf[i] === safe || tiles[i] !== FLOOR) continue;
      // New floor right against the safe room: this is a hatch.
      if (before[i] === FLOOR) continue;
      tiles[i] = SECRET;
    }
    // Hallway carved for the hatches that now leads nowhere but a hatch is
    // still a fine alcove; the exit points are the floor tiles facing a hatch.
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i] !== SECRET) continue;
      for (const d of [1, -1, cols, -cols]) {
        const nb = i + d;
        if (tiles[nb] === FLOOR && roomOf[nb] !== safe) safeExits.push({ x: ((nb % cols) + 0.5) * TILE, y: (Math.floor(nb / cols) + 0.5) * TILE });
      }
    }
  }

  // Furniture. Kept two tiles off every room edge so a doorway can never be
  // blocked, and each piece is only kept if every open tile stays reachable.
  const props: Prop[] = [];
  const floorCount = () => { let c = 0; for (const t of tiles) if (t === FLOOR) c++; return c; };
  const reachable = () => {
    const seen = new Uint8Array(cols * rows);
    const start = rooms[0].cy * cols + rooms[0].cx;
    const stack = [start]; seen[start] = 1; let c = 1;
    while (stack.length) {
      const cur = stack.pop()!;
      for (const d of [1, -1, cols, -cols]) {
        const nb = cur + d;
        if (!seen[nb] && (tiles[nb] === FLOOR || tiles[nb] === SECRET)) { seen[nb] = 1; if (tiles[nb] === FLOOR) c++; stack.push(nb); }
      }
    }
    return c;
  };
  const place = (r: Room, kind: PropKind, px: number, py: number, pw: number, ph: number) => {
    if (px < r.x + 2 || py < r.y + 2 || px + pw > r.x + r.w - 2 || py + ph > r.y + r.h - 2) return false;
    const cells: number[] = [];
    for (let yy = py; yy < py + ph; yy++) for (let xx = px; xx < px + pw; xx++) cells.push(yy * cols + xx);
    if (cells.some(c => tiles[c] !== FLOOR)) return false;
    // Never on the room's centre: that's where the hallways arrive.
    if (cells.includes(r.cy * cols + r.cx)) return false;
    // Leave a one-tile gap around every piece so rooms stay walkable.
    for (let yy = py - 1; yy <= py + ph; yy++) for (let xx = px - 1; xx <= px + pw; xx++) {
      if (tiles[yy * cols + xx] === PROP) return false;
    }
    // Gym mats are painted on the floor: you walk over them.
    if (kind === "mat") { props.push({ x: px, y: py, w: pw, h: ph, kind, seed: Math.floor(rnd() * 1e6) }); return true; }
    const before = floorCount() - cells.length;
    for (const c of cells) tiles[c] = PROP;
    if (reachable() !== before) { for (const c of cells) tiles[c] = FLOOR; return false; }
    props.push({ x: px, y: py, w: pw, h: ph, kind, seed: Math.floor(rnd() * 1e6) });
    return true;
  };
  rooms.forEach(r => {
    if (r.kind.rows) {
      // Desks in rows facing a teacher's desk at the top.
      place(r, "desk", r.cx - 1, r.y + 2, 2, 1);
      for (let yy = r.y + 4; yy <= r.y + r.h - 3; yy += 2) for (let xx = r.x + 2; xx <= r.x + r.w - 3; xx += 2) place(r, "desk", xx, yy, 1, 1);
      return;
    }
    const target = Math.round(((r.w - 4) * (r.h - 4)) / 7);
    for (let k = 0, tries = 0; k < target && tries < target * 6; tries++) {
      const spec = pick(r.kind.props);
      const [pw, ph] = pick(spec.sizes);
      if (place(r, spec.kind, ri(r.x + 2, r.x + r.w - 2 - pw), ri(r.y + 2, r.y + r.h - 2 - ph), pw, ph)) k++;
    }
  });

  return { cols, rows, tiles, roomOf, rooms, props, safe, safeExits };
};

export const tileAt = (m: HvzMap, tx: number, ty: number) =>
  tx < 0 || ty < 0 || tx >= m.cols || ty >= m.rows ? WALL : m.tiles[ty * m.cols + tx];

/** Can a body stand on this tile? Hatches only for humans who aren't locked out. */
export const passable = (t: number, hatches: boolean) => t === FLOOR || (t === SECRET && hatches);

export const solidAt = (m: HvzMap, x: number, y: number, hatches = false) =>
  !passable(tileAt(m, Math.floor(x / TILE), Math.floor(y / TILE)), hatches);

/** Walls and hatches block sight, furniture doesn't: it is waist high. */
export const opaqueAt = (m: HvzMap, x: number, y: number) => {
  const t = tileAt(m, Math.floor(x / TILE), Math.floor(y / TILE));
  return t === WALL || t === SECRET;
};

const circleHits = (m: HvzMap, x: number, y: number, r: number, hatches: boolean, only?: number) => {
  const x0 = Math.floor((x - r) / TILE), x1 = Math.floor((x + r) / TILE);
  const y0 = Math.floor((y - r) / TILE), y1 = Math.floor((y + r) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const t = tileAt(m, tx, ty);
    if (only !== undefined ? t !== only : passable(t, hatches)) continue;
    const nx = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE));
    const ny = Math.max(ty * TILE, Math.min(y, ty * TILE + TILE));
    if ((nx - x) ** 2 + (ny - y) ** 2 < r * r) return true;
  }
  return false;
};

/** Is any part of this body over a hatch? */
export const touchesHatch = (m: HvzMap, x: number, y: number, r = PLAYER_R) => circleHits(m, x, y, r, false, SECRET);

/** Move a circle by (dx, dy), one axis at a time so it slides along walls. */
export const moveCircle = (m: HvzMap, x: number, y: number, dx: number, dy: number, hatches = false, r = PLAYER_R) => {
  // Sub-steps keep a fast move from tunnelling through a corner.
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / (r * 0.5)));
  // Already overlapping something we can't stand on (a human who turned while
  // in a hatch doorway): let them walk out through the hatch, never into a wall.
  if (circleHits(m, x, y, r, hatches)) hatches = true;
  for (let i = 0; i < steps; i++) {
    const sx = dx / steps, sy = dy / steps;
    if (!circleHits(m, x + sx, y, r, hatches)) x += sx;
    if (!circleHits(m, x, y + sy, r, hatches)) y += sy;
  }
  return { x, y };
};

/** Nothing opaque on the straight line between two points. */
export const lineOfSight = (m: HvzMap, x0: number, y0: number, x1: number, y1: number) => {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.ceil(d / 10);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (opaqueAt(m, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
  }
  return true;
};

/** The outline of what can be seen from (x, y) out to `radius`, as a polygon. */
export const visibilityPolygon = (m: HvzMap, x: number, y: number, radius: number, rays = 320) => {
  const pts: number[] = [];
  const step = 4;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2;
    const cx = Math.cos(a), cy = Math.sin(a);
    let d = step;
    while (d < radius && !opaqueAt(m, x + cx * d, y + cy * d)) d += step;
    // Push into the wall so its face is lit, not cut at the edge.
    d = Math.min(radius, d + TILE * 0.7);
    pts.push(x + cx * d, y + cy * d);
  }
  return pts;
};

/** A random open spot in a room, clear of furniture and walls. */
export const spawnIn = (m: HvzMap, room: number, rnd: () => number = Math.random) => {
  const r = m.rooms[room];
  for (let k = 0; k < 60; k++) {
    const x = (r.x + 1 + rnd() * (r.w - 2)) * TILE, y = (r.y + 1 + rnd() * (r.h - 2)) * TILE;
    if (!circleHits(m, x, y, PLAYER_R + 2, false)) return { x, y };
  }
  return { x: (r.cx + 0.5) * TILE, y: (r.cy + 0.5) * TILE };
};

/** Where a player starts: zombies in the lab, humans in any ordinary room. */
export const spawnFor = (m: HvzMap, team: Team, rnd: () => number = Math.random) => {
  if (team === "zombie") return spawnIn(m, 0, rnd);
  const open = m.rooms.map((_, i) => i).filter(i => i !== 0 && i !== m.safe);
  return spawnIn(m, open.length ? open[Math.floor(rnd() * open.length)] : 0, rnd);
};

/** In the safe room proper (not just its doorway). */
export const inSafeRoom = (m: HvzMap, x: number, y: number) =>
  m.safe >= 0 && m.roomOf[Math.floor(y / TILE) * m.cols + Math.floor(x / TILE)] === m.safe;

/**
 * Steps-to-target for every floor tile (breadth first, 4-way), -1 where it
 * can't be reached. Hatches don't count, so it's the zombies' view of the
 * building. The preview's bots walk down it.
 */
export const distanceField = (m: HvzMap, tx: number, ty: number) => {
  const dist = new Int32Array(m.cols * m.rows).fill(-1);
  const start = ty * m.cols + tx;
  if (m.tiles[start] !== FLOOR) return dist;
  const queue = new Int32Array(m.cols * m.rows);
  let head = 0, tail = 0;
  queue[tail++] = start; dist[start] = 0;
  while (head < tail) {
    const c = queue[head++];
    for (const d of [1, -1, m.cols, -m.cols]) {
      const nb = c + d;
      if (nb < 0 || nb >= dist.length || dist[nb] !== -1 || m.tiles[nb] !== FLOOR) continue;
      dist[nb] = dist[c] + 1;
      queue[tail++] = nb;
    }
  }
  return dist;
};

/** The heading that walks down a distance field from (x, y), or null at the goal / unreachable. */
export const headingDown = (m: HvzMap, dist: Int32Array, x: number, y: number) => {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  const here = dist[ty * m.cols + tx];
  if (here <= 0) return null;
  let best = here, bx = 0, by = 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const nx = tx + dx, ny = ty + dy;
    const v = dist[ny * m.cols + nx];
    if (v < 0 || v >= best) continue;
    // Diagonals only when both sides are open, or we'd cut a wall corner.
    if (dx && dy && (tileAt(m, tx + dx, ty) !== FLOOR || tileAt(m, tx, ty + dy) !== FLOOR)) continue;
    best = v; bx = dx; by = dy;
  }
  if (best === here) return null;
  return Math.atan2((ty + by + 0.5) * TILE - y, (tx + bx + 0.5) * TILE - x);
};

/** The power-up boxes standing at `now`. */
export const powerBoxesAt = (seed: string, now: number, m: HvzMap): PowerBox[] => {
  const slot = Math.floor(now / POWER.slotMs);
  const rnd = mulberry32(seedOf(`${seed}:power:${slot}`));
  const rooms = m.rooms.map((_, i) => i).filter(i => i !== m.safe);
  const count = Math.max(2, Math.round(m.rooms.length / 3));
  const boxes: PowerBox[] = [];
  for (let i = 0; i < count; i++) {
    const room = rooms[Math.floor(rnd() * rooms.length)];
    const { x, y } = spawnIn(m, room, rnd);
    boxes.push({ id: `${slot}-${i}`, x, y });
  }
  return boxes;
};
