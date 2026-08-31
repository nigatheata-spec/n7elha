// ── Don't Look Down — procedural climb generator ────────────────────────────
// The climb is infinite: nothing is precomputed or held in memory beyond what
// a player has actually reached. A LevelGenerator is a deterministic sequence
// driven by a seeded PRNG — every student and the teacher's spotlight view
// build one from the SAME seed (derived from the session id), so they all
// produce bit-identical platform/hazard/biome layouts for a given height
// without ever synchronizing the level itself over the network.
//
// Direction is "generally up and to the right": each step's gap trends
// rightward with local wiggle, never a straight diagonal line. Difficulty
// (gap size, platform width, hazard odds) rises with height and asymptotes
// rather than hitting a hard ceiling, since there's no summit anymore.

export type MaterialId =
  | "stone" | "wood" | "cloud"
  | "metal" | "obsidian" | "ember"
  | "vine" | "mossstone" | "leaf"
  | "ice" | "snowstone" | "crystal"
  | "glowcrystal" | "glowvine";

export type HazardKind = "spikes" | "laser";

export type Platform = {
  id: string;
  x: number; y: number; w: number;
  material: MaterialId;
  motion?: { axis: "x" | "y"; amp: number; period: number; phase: number };
  crumble?: boolean;
  bounce?: boolean;
};

export type SpikeHazard = { id: string; kind: "spikes"; x: number; y: number; w: number };
export type LaserHazard = {
  id: string; kind: "laser";
  x1: number; y1: number; x2: number; y2: number;
  period: number; phase: number; onFrac: number;
};
export type Hazard = SpikeHazard | LaserHazard;

export type Biome = {
  id: string;
  nameEn: string; nameAr: string;
  hue: number; sat: number;          // base sky hue/sat — lightness still ramps with altitude like before
  ambient: "clouds" | "embers" | "leaves" | "snow" | "motes";
  ambientColor: string;
  materials: MaterialId[];
  hazards: HazardKind[];
  allowMotion: boolean;
  allowCrumble: boolean;
  allowBounce: boolean;
};

export const BIOMES: Biome[] = [
  {
    id: "sky", nameEn: "Open Sky", nameAr: "السماء المفتوحة", hue: 199, sat: 80,
    ambient: "clouds", ambientColor: "#ffffff",
    materials: ["stone", "wood", "cloud"], hazards: ["spikes"],
    allowMotion: true, allowCrumble: false, allowBounce: true,
  },
  {
    id: "forge", nameEn: "The Forge", nameAr: "الأتون", hue: 18, sat: 74,
    ambient: "embers", ambientColor: "#fb923c",
    materials: ["metal", "obsidian", "ember"], hazards: ["laser", "spikes"],
    allowMotion: true, allowCrumble: true, allowBounce: false,
  },
  {
    id: "canopy", nameEn: "The Canopy", nameAr: "المظلة الخضراء", hue: 132, sat: 52,
    ambient: "leaves", ambientColor: "#4ade80",
    materials: ["vine", "mossstone", "leaf"], hazards: ["spikes"],
    allowMotion: true, allowCrumble: false, allowBounce: true,
  },
  {
    id: "glacier", nameEn: "The Glacier", nameAr: "النهر الجليدي", hue: 198, sat: 40,
    ambient: "snow", ambientColor: "#ffffff",
    materials: ["ice", "snowstone", "crystal"], hazards: ["laser"],
    allowMotion: false, allowCrumble: true, allowBounce: false,
  },
  {
    id: "hollow", nameEn: "The Hollow", nameAr: "الكهف المضيء", hue: 268, sat: 58,
    ambient: "motes", ambientColor: "#c084fc",
    materials: ["glowcrystal", "glowvine", "obsidian"], hazards: ["laser", "spikes"],
    allowMotion: true, allowCrumble: false, allowBounce: true,
  },
];

// ── Seeded PRNG (mulberry32) ─────────────────────────────────────────────────
export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const seedFromString = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h) || 1;
};

// ── Generator ────────────────────────────────────────────────────────────────
type Band = { biome: Biome; startY: number; endY: number };

export class LevelGenerator {
  platforms: Platform[] = [];
  hazards: Hazard[] = [];
  bands: Band[] = [];

  private rng: () => number;
  private cursorX = 0;
  private cursorY = 0;
  private idx = 0;

  constructor(seed: number) {
    this.rng = mulberry32(seed);
    const first = this.pickBiome();
    this.bands.push({ biome: first, startY: -80, endY: 420 });
    const p0: Platform = { id: "p0", x: -120, y: 0, w: 460, material: first.materials[0] };
    this.platforms.push(p0);
    this.cursorX = p0.x + p0.w / 2;
    this.cursorY = p0.y;
  }

  private pickBiome(excludeId?: string): Biome {
    const pool = excludeId ? BIOMES.filter(b => b.id !== excludeId) : BIOMES;
    return pool[Math.floor(this.rng() * pool.length)];
  }

  private bandAt(y: number): Band {
    let last = this.bands[this.bands.length - 1];
    while (y > last.endY) {
      const biome = this.pickBiome(last.biome.id);
      const len = 420 + this.rng() * 320;
      last = { biome, startY: last.endY, endY: last.endY + len };
      this.bands.push(last);
    }
    for (let i = this.bands.length - 1; i >= 0; i--) {
      if (y >= this.bands[i].startY) return this.bands[i];
    }
    return this.bands[0];
  }

  /** Which biome a given height sits in, plus a 0..1 blend toward the next band near a transition. */
  biomeBlendAt(y: number): { biome: Biome; next: Biome; t: number } {
    const band = this.bandAt(y + 260); // stay ahead so blending has generated the next band already
    const blendZone = 160;
    const distToEnd = band.endY - y;
    if (distToEnd < blendZone) {
      const nextBand = this.bandAt(band.endY + 1);
      return { biome: band.biome, next: nextBand.biome, t: 1 - Math.max(0, distToEnd) / blendZone };
    }
    return { biome: band.biome, next: band.biome, t: 0 };
  }

  private difficultyAt(y: number): number {
    return 1 - 1 / (1 + Math.max(0, y) / 2600);
  }

  ensureGeneratedTo(targetY: number) {
    const lookahead = 900;
    while (this.cursorY < targetY + lookahead) {
      this.idx++;
      const band = this.bandAt(this.cursorY);
      const d = this.difficultyAt(this.cursorY);

      const gapX = 140 + d * 240 + this.rng() * (90 + d * 130);
      const gapY = 85 + d * 65 + this.rng() * 40;
      const w = Math.max(70, 190 - d * 115 + this.rng() * 30);

      const dir = this.rng() < 0.16 ? -1 : 1;
      const nx = this.cursorX + (dir < 0 ? -gapX * 0.45 : gapX);
      const ny = this.cursorY + gapY;

      const material = band.biome.materials[Math.floor(this.rng() * band.biome.materials.length)];
      const p: Platform = { id: `p${this.idx}`, x: nx - w / 2, y: ny, w, material };

      const roll = this.rng();
      if (band.biome.allowMotion && d > 0.22 && roll < 0.16) {
        p.motion = {
          axis: this.rng() < 0.5 ? "x" : "y",
          amp: 55 + this.rng() * 65, period: 2.2 + this.rng() * 1.6, phase: this.rng() * Math.PI * 2,
        };
      } else if (band.biome.allowCrumble && d > 0.32 && roll < 0.30) {
        p.crumble = true;
      } else if (band.biome.allowBounce && roll < 0.42) {
        p.bounce = true;
      }
      this.platforms.push(p);

      if (band.biome.hazards.length && d > 0.18 && this.rng() < 0.30) {
        const kind = band.biome.hazards[Math.floor(this.rng() * band.biome.hazards.length)];
        if (kind === "spikes") {
          this.hazards.push({
            id: `h${this.idx}`, kind: "spikes",
            x: this.cursorX + gapX * (0.35 + this.rng() * 0.2), y: this.cursorY + gapY * 0.1, w: 32,
          });
        } else {
          this.hazards.push({
            id: `h${this.idx}`, kind: "laser",
            x1: this.cursorX + 18, y1: this.cursorY + 26, x2: nx - 18, y2: ny + 22,
            period: 2.0 + this.rng() * 1.4, phase: this.rng() * Math.PI * 2, onFrac: 0.42,
          });
        }
      }

      this.cursorX = nx; this.cursorY = ny;
    }
  }
}

// ── Live position of a (possibly moving) platform, at wall-clock time `t` seconds ──
export const platformWorldPos = (pl: Platform, t: number): { x: number; y: number } => {
  if (!pl.motion) return { x: pl.x, y: pl.y };
  const off = Math.sin((t / pl.motion.period) * Math.PI * 2 + pl.motion.phase) * pl.motion.amp;
  return pl.motion.axis === "x" ? { x: pl.x + off, y: pl.y } : { x: pl.x, y: pl.y + off };
};

export const laserActiveAt = (hz: LaserHazard, t: number): boolean => {
  const phaseT = (((t + hz.phase) % hz.period) + hz.period) % hz.period;
  return phaseT < hz.period * hz.onFrac;
};

/** Distance from a point to the laser's segment, for hit-testing. */
export const distToLaser = (hz: LaserHazard, px: number, py: number): number => {
  const dx = hz.x2 - hz.x1, dy = hz.y2 - hz.y1;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - hz.x1) * dx + (py - hz.y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = hz.x1 + dx * t, cy = hz.y1 + dy * t;
  return Math.hypot(px - cx, py - cy);
};

// ── One shared generator instance per session, reused across re-renders ─────
const generators = new Map<string, LevelGenerator>();
export const getGenerator = (sessionId: string): LevelGenerator => {
  let g = generators.get(sessionId);
  if (!g) { g = new LevelGenerator(seedFromString(sessionId)); generators.set(sessionId, g); }
  return g;
};

export const initialSpawn = (playerW: number) => ({ x: -120 + 460 / 2 - playerW / 2, y: 4 });
