// ── Don't Look Down — 2D parkour platformer ─────────────────────────────────
// World space: +X right, +Y UP (a platform at y=400 is higher than one at y=0).
// The renderer flips Y when drawing so world-up reads as screen-up.
//
// The climb itself is procedurally generated — see dontLookDownLevel.ts. This
// file only holds physics tuning and the bits shared with the rest of the app.

export const WORLD = {
  gravity: -2200,        // px/s²
  moveAccel: 4200,       // px/s² while a direction key is held
  moveDecel: 5200,       // px/s² when no direction key is held
  maxRunSpeed: 430,      // px/s horizontal cap
  jumpVelocity: 900,     // px/s applied on jump
  doubleJumpVelocity: 820, // everyone has the double jump — no unlock gate
  maxFallSpeed: -1600,   // terminal velocity (negative = falling)
  playerW: 34,
  playerH: 46,
  groundY: -260,         // solid floor below the start platform — you fall to it, never teleport
};

// ── Energy ────────────────────────────────────────────────────────────────
// No upper cap: a streak of correct answers can bank an arbitrarily large
// reserve. It still drains on movement/jumping and is still the only way to
// keep climbing — there's no shop, so answering questions is the whole loop.
export const ENERGY = {
  start: 100,
  moveDrainPerSec: 2,
  jumpCost: 15,
  rewardPerCorrect: 25,
};

export const PLAYER_COLORS = ["#38bdf8", "#4ade80", "#facc15", "#fb7185", "#a78bfa", "#22d3ee", "#fb923c", "#f472b6"];
export const colorFor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return PLAYER_COLORS[Math.abs(h) % PLAYER_COLORS.length];
};
