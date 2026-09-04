// ── Don't Look Down — bands and sky ─────────────────────────────────────────
// The climb is generated in dontLookDown.ts, sized to the session's length.
// This file is what it LOOKS like: the six themed bands it passes through, the
// sky ramp for each, and the crossfade between them.

import type { Climb, BandId } from "./dontLookDown";

/**
 * World units → buffer pixels. The game renders into a small pixel buffer that
 * the browser scales up with nearest-neighbour, so one buffer pixel is one
 * visible "pixel-art pixel". At 0.5 the 34×46 player box is 17×23 px.
 */
export const PX = 0.5;

export const toBuf = (world: number) => world * PX;
export const toWorld = (buf: number) => buf / PX;

export type Theme = {
  id: BandId;
  nameEn: string;
  nameAr: string;
  /** Sky ramp, top of screen → horizon. Discrete steps: this is a pixel sky. */
  sky: string[];
  stars: boolean;
};

export const THEMES: Theme[] = [
  {
    id: "school", nameEn: "Schoolyard", nameAr: "فناء المدرسة",
    sky: ["#4aa8e0", "#63b9ea", "#7ecbf2", "#9adcf7", "#bfeafb"], stars: false,
  },
  {
    id: "aqua", nameEn: "The Shallows", nameAr: "المياه الضحلة",
    sky: ["#1c7fa8", "#2e9bbd", "#4fb8cd", "#7fd4d6", "#b8ecdf"], stars: false,
  },
  {
    id: "farm", nameEn: "Harvest Fields", nameAr: "حقول الحصاد",
    sky: ["#3f9ad8", "#71b8dd", "#a6cfcf", "#d7d2a4", "#f2d98a"], stars: false,
  },
  {
    id: "desert", nameEn: "The Mesas", nameAr: "الهضاب",
    sky: ["#2d6ea8", "#6a7fae", "#a8859f", "#d99a7e", "#f0bc74"], stars: false,
  },
  {
    id: "city", nameEn: "Uptown", nameAr: "المدينة",
    sky: ["#1d2a5e", "#3a3f83", "#6a4d95", "#a4629a", "#e08a7d"], stars: true,
  },
  {
    id: "space", nameEn: "Low Orbit", nameAr: "المدار",
    sky: ["#05060f", "#0a0c1d", "#11142f", "#191d44", "#232a5c"], stars: true,
  },
];

const BY_ID = Object.fromEntries(THEMES.map(t => [t.id, t])) as Record<BandId, Theme>;

/** Which band a height sits in. Stars belong to the last two. */
export const themeIndexAt = (climb: Climb, y: number) => {
  const v = Math.max(0, y);
  const i = climb.bandEdges.findIndex(e => v < e.upto);
  return i === -1 ? climb.bandEdges.length - 1 : i;
};

export const themeAt = (climb: Climb, y: number) => BY_ID[climb.bandEdges[themeIndexAt(climb, y)].band];

/** Index at and above which the sky is dark enough to show stars. */
export const STARRY_FROM = THEMES.findIndex(t => t.stars);

/**
 * How far (0..1) a height sits into the fade toward the next theme. The sky
 * cross-fades over the last stretch of a band so themes don't snap over.
 */
const FADE = 420;
export const themeBlendAt = (climb: Climb, y: number): { from: Theme; to: Theme; t: number } => {
  const i = themeIndexAt(climb, y);
  const edges = climb.bandEdges;
  const from = BY_ID[edges[i].band];
  const to = BY_ID[edges[Math.min(edges.length - 1, i + 1)].band];
  const distToEnd = edges[i].upto - Math.max(0, y);
  if (distToEnd < FADE) return { from, to, t: 1 - Math.max(0, distToEnd) / FADE };
  return { from, to: from, t: 0 };
};

/** How bright the star field is at a height, as the sky darkens toward orbit. */
export const starAlphaAt = (climb: Climb, y: number) => {
  const i = themeIndexAt(climb, y);
  if (i > STARRY_FROM) return 1;
  if (i < STARRY_FROM) return 0;
  return 0.35 + themeBlendAt(climb, y).t * 0.65;
};
