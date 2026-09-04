// ── Shared avatar identity ───────────────────────────────────────────────────
// One name → one face + one color, everywhere in the app: the lobby roster,
// leaderboards, results, and the Don't Look Down platformer character all
// derive from this same hash, so a student's in-game character is visibly the
// same "them" as their avatar circle anywhere else.

// Circle fills, drawn from the brand palette and kept light enough that the
// black face ink stays legible on every one of them.
export const CIRCLE_COLORS = [
  "#8FC44A", // lime
  "#7FB3C4", // sky
  "#F08A8A", // coral
  "#F5C64E", // amber
  "#7FD4A8", // mint
  "#A99BE0", // lilac
  "#F2A468", // peach
];

// Faces are pre-normalised: each one is cropped to its ink and centred in an
// identical 200x200 canvas, so a single overlay rule fits all of them while
// keeping the size differences from the original sheet.
const modules = import.meta.glob("../assets/faces/*.png", { eager: true, import: "default" });
export const FACES: string[] = Object.keys(modules)
  .sort()
  .map((k) => modules[k] as string);

// FNV-1a plus a murmur3 finaliser. The plain `h * 31` hash used elsewhere in the
// app leaves its low bits correlated, which visibly clumps the colours once you
// take it modulo 7 — the avalanche step is what spreads them evenly. Two seeds so
// colour and face are drawn independently of each other.
const hash = (name: string, seed: number) => {
  let h = seed;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
};

// Seeds chosen by measuring bucket spread over realistic Arabic name sets as
// well as random strings; both land comfortably under their expected chi-square.
export const colorIndexForName = (name: string) => hash(name, 0x85ebca6b) % CIRCLE_COLORS.length;
export const faceIndexForName = (name: string) => hash(name, 0x1b873593) % FACES.length;
export const colorForName = (name: string) => CIRCLE_COLORS[colorIndexForName(name)];
export const faceForName = (name: string) => FACES[faceIndexForName(name)];

// A student can override their hashed color/face on the join screen (stored as
// `avatar_color`/`avatar_face` on their game_students row). Everywhere else in
// the app resolves the avatar through these two functions so a stored choice
// and the hashed default are interchangeable to every caller — nobody else
// needs to know which one a given player has.
export const resolveColor = (name: string, colorIndex?: number | null) =>
  colorIndex != null ? CIRCLE_COLORS[colorIndex] : colorForName(name);
export const resolveFace = (name: string, faceIndex?: number | null) =>
  faceIndex != null ? FACES[faceIndex] : faceForName(name);
