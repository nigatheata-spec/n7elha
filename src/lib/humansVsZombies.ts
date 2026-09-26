// ── Humans vs Zombies — the rules and the map ───────────────────────────────
// A top-down infection game on a building of rooms and hallways, Among Us
// style. Every phone renders the map around its own player (the projector only
// keeps score). A few players start as zombies; a zombie that touches a human
// turns them. Humans carry a stun gun: a hit freezes a zombie for a few
// seconds, it never kills, so the horde can't be wiped out. Humans win if
// anyone is still human when the clock runs out.
//
// Questions are the only source of power. A human's correct answer is ammo, a
// zombie's is a sprint charge, and three in a row adds a perk (a shield for a
// human, a few seconds of sensing every human for a zombie). Answering takes
// you out of the game while the question is up, you stand still, so where you
// choose to answer is half the game.
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
/** A freshly turned zombie stands still for this long before it can hunt. */
export const TURNING_MS = 2000;
/** Zombies are held in the lab while the humans scatter. */
export const HEAD_START_MS = 10_000;
/** After a shield pops, a moment where the same zombie can't tag you again. */
export const SHIELD_GRACE_MS = 1500;
export const BULLET = { speed: 620, range: 420, radius: 5 };
export const AMMO = { start: 3, perCorrect: 2, max: 12 };
export const CHARGES = { start: 1, perCorrect: 1, max: 5 };
/** Correct answers in a row that earn the team perk. */
export const PERK_STREAK = 3;
export const SENSE_MS = 7000;
export const VISION = { human: 300, zombie: 270 };
/** Centre-to-centre distance at which a zombie has touched a human. */
export const TAG_DIST = PLAYER_R * 2 - 3;
export const POINTS = { infect: 100, stun: 25, correct: 10, survive: 300 };
export const BROADCAST_MS = 70;
export const PEER_TIMEOUT_MS = 4000;

/** Room grid for a roster, fixed at Start. */
export const roomsFor = (players: number): [number, number] =>
  players <= 8 ? [3, 3] : players <= 16 ? [4, 3] : players <= 26 ? [4, 4] : [5, 4];

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

export const FLOOR = 0, WALL = 1, PROP = 2;

export type RoomKind = { key: string; en: string; ar: string; floor: string; tile: string };

/** Room 0 is always the lab, where the zombies come from. */
export const LAB: RoomKind = { key: "lab", en: "LAB", ar: "المختبر", floor: "#3E5C4A", tile: "#476B55" };
export const ROOM_KINDS: RoomKind[] = [
  { key: "cafeteria", en: "CAFETERIA", ar: "الكافتيريا", floor: "#8A6B4E", tile: "#957558" },
  { key: "library",   en: "LIBRARY",   ar: "المكتبة",   floor: "#6B4F63", tile: "#76596D" },
  { key: "gym",       en: "GYM",       ar: "الصالة",    floor: "#A77B45", tile: "#B1854E" },
  { key: "classroom", en: "CLASSROOM", ar: "الفصل",     floor: "#4F6A86", tile: "#587491" },
  { key: "storage",   en: "STORAGE",   ar: "المخزن",    floor: "#5D5A55", tile: "#67645E" },
  { key: "office",    en: "OFFICE",    ar: "المكتب",    floor: "#546B6E", tile: "#5D7579" },
  { key: "clinic",    en: "CLINIC",    ar: "العيادة",   floor: "#7E8E99", tile: "#8998A3" },
  { key: "music",     en: "MUSIC",     ar: "الموسيقى",  floor: "#7A4F4F", tile: "#855858" },
  { key: "art",       en: "ART ROOM",  ar: "الفنون",    floor: "#8C7A4A", tile: "#968454" },
  { key: "server",    en: "SERVERS",   ar: "الخوادم",   floor: "#3F4A63", tile: "#48546E" },
];

export type Room = { x: number; y: number; w: number; h: number; cx: number; cy: number; kind: RoomKind };

export type HvzMap = {
  cols: number; rows: number;
  /** FLOOR / WALL / PROP per tile, row-major. */
  tiles: Uint8Array;
  /** Room index per tile, -1 for hallway and wall. */
  roomOf: Int16Array;
  rooms: Room[];
  /** Prop look per tile (0 crate, 1 table, 2 plant, 3 shelf), for the renderer. */
  propKind: Uint8Array;
};

const ROOM_BLOCK = 13;

/**
 * A building of rw × rh rooms joined by three-tile hallways: a random spanning
 * tree so every room is reachable, plus a third of the remaining links so there
 * are loops to run around — a building with dead ends only is a trap.
 */
export const buildMap = (seed: string, rw: number, rh: number): HvzMap => {
  const rnd = mulberry32(seedOf(seed));
  const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
  const cols = rw * ROOM_BLOCK + 1, rows = rh * ROOM_BLOCK + 1;
  const tiles = new Uint8Array(cols * rows).fill(WALL);
  const roomOf = new Int16Array(cols * rows).fill(-1);
  const propKind = new Uint8Array(cols * rows);
  const set = (x: number, y: number, v: number) => {
    if (x > 0 && y > 0 && x < cols - 1 && y < rows - 1) tiles[y * cols + x] = v;
  };

  const kinds = [...ROOM_KINDS].sort(() => rnd() - 0.5);
  const rooms: Room[] = [];
  for (let j = 0; j < rh; j++) {
    for (let i = 0; i < rw; i++) {
      const ox = i * ROOM_BLOCK + 1, oy = j * ROOM_BLOCK + 1;
      const w = ri(8, 10), h = ri(7, 10);
      const x = ox + ri(1, ROOM_BLOCK - 1 - w - 1), y = oy + ri(1, ROOM_BLOCK - 1 - h - 1);
      const idx = rooms.length;
      const kind = idx === 0 ? LAB : kinds[(idx - 1) % kinds.length];
      rooms.push({ x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2), kind });
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
        set(xx, yy, FLOOR);
        roomOf[yy * cols + xx] = idx;
      }
    }
  }

  // Links between grid neighbours, then Kruskal for the tree.
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
  for (const [a, b] of edges) {
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
  for (const [a, b] of links) {
    const A = rooms[a], B = rooms[b];
    if (b === a + 1) {
      // Side by side: across, bend in the gap between the rooms, across again.
      const mid = Math.round((A.x + A.w + B.x) / 2);
      carveH(A.cx, mid, A.cy); carveV(A.cy, B.cy, mid); carveH(mid, B.cx, B.cy);
    } else {
      const mid = Math.round((A.y + A.h + B.y) / 2);
      carveV(A.cy, mid, A.cx); carveH(A.cx, B.cx, mid); carveV(mid, B.cy, B.cx);
    }
  }

  // Furniture: kept two tiles off every room edge so a doorway can never be
  // blocked, and each piece is only kept if the building stays connected.
  const floorCount = () => { let n = 0; for (const t of tiles) if (t === FLOOR) n++; return n; };
  const reachable = () => {
    const seen = new Uint8Array(cols * rows);
    const start = rooms[0].cy * cols + rooms[0].cx;
    const stack = [start]; seen[start] = 1; let n = 1;
    while (stack.length) {
      const c = stack.pop()!;
      for (const d of [1, -1, cols, -cols]) {
        const nb = c + d;
        if (!seen[nb] && tiles[nb] === FLOOR) { seen[nb] = 1; n++; stack.push(nb); }
      }
    }
    return n;
  };
  rooms.forEach((r, idx) => {
    const pieces = ri(2, 4);
    for (let k = 0; k < pieces; k++) {
      const pw = ri(1, 2), ph = rnd() < 0.3 ? 2 : 1;
      const px = ri(r.x + 2, r.x + r.w - 2 - pw), py = ri(r.y + 2, r.y + r.h - 2 - ph);
      if (px < r.x + 2 || py < r.y + 2) continue;
      const cells: number[] = [];
      for (let yy = py; yy < py + ph; yy++) for (let xx = px; xx < px + pw; xx++) cells.push(yy * cols + xx);
      if (cells.some(c => tiles[c] !== FLOOR)) continue;
      // Never on the room's own centre: that's where hallways arrive.
      if (cells.includes(r.cy * cols + r.cx)) continue;
      const before = floorCount() - cells.length;
      const look = idx === 0 ? 0 : ri(0, 3);
      for (const c of cells) { tiles[c] = PROP; propKind[c] = look; }
      if (reachable() !== before) for (const c of cells) tiles[c] = FLOOR;
    }
  });

  return { cols, rows, tiles, roomOf, rooms, propKind };
};

export const tileAt = (m: HvzMap, tx: number, ty: number) =>
  tx < 0 || ty < 0 || tx >= m.cols || ty >= m.rows ? WALL : m.tiles[ty * m.cols + tx];

export const solidAt = (m: HvzMap, x: number, y: number) =>
  tileAt(m, Math.floor(x / TILE), Math.floor(y / TILE)) !== FLOOR;

/** Walls block sight, furniture doesn't: it is waist high. */
export const opaqueAt = (m: HvzMap, x: number, y: number) =>
  tileAt(m, Math.floor(x / TILE), Math.floor(y / TILE)) === WALL;

const circleHits = (m: HvzMap, x: number, y: number, r: number) => {
  const x0 = Math.floor((x - r) / TILE), x1 = Math.floor((x + r) / TILE);
  const y0 = Math.floor((y - r) / TILE), y1 = Math.floor((y + r) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (tileAt(m, tx, ty) === FLOOR) continue;
    const nx = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE));
    const ny = Math.max(ty * TILE, Math.min(y, ty * TILE + TILE));
    if ((nx - x) ** 2 + (ny - y) ** 2 < r * r) return true;
  }
  return false;
};

/** Move a circle by (dx, dy), one axis at a time so it slides along walls. */
export const moveCircle = (m: HvzMap, x: number, y: number, dx: number, dy: number, r = PLAYER_R) => {
  // Sub-steps keep a fast move from tunnelling through a corner.
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / (r * 0.5)));
  for (let i = 0; i < steps; i++) {
    const sx = dx / steps, sy = dy / steps;
    if (!circleHits(m, x + sx, y, r)) x += sx;
    if (!circleHits(m, x, y + sy, r)) y += sy;
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
    // Push slightly into the wall so its face is lit, not cut at the edge.
    d = Math.min(radius, d + TILE * 0.7);
    pts.push(x + cx * d, y + cy * d);
  }
  return pts;
};

/** A random open spot in a room, clear of furniture and walls. */
export const spawnIn = (m: HvzMap, room: number, rnd: () => number = Math.random) => {
  const r = m.rooms[room];
  for (let k = 0; k < 40; k++) {
    const x = (r.x + 1 + rnd() * (r.w - 2)) * TILE, y = (r.y + 1 + rnd() * (r.h - 2)) * TILE;
    if (!circleHits(m, x, y, PLAYER_R + 2)) return { x, y };
  }
  return { x: (r.cx + 0.5) * TILE, y: (r.cy + 0.5) * TILE };
};

/** Where a player starts: zombies in the lab, humans anywhere else. */
export const spawnFor = (m: HvzMap, team: Team, rnd: () => number = Math.random) =>
  spawnIn(m, team === "zombie" || m.rooms.length < 2 ? 0 : 1 + Math.floor(rnd() * (m.rooms.length - 1)), rnd);

/**
 * Steps-to-target for every floor tile (breadth first, 4-way), -1 where it
 * can't be reached. The preview's bots walk down it; it's also what makes a
 * zombie's sense point along the hallways rather than through walls.
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
