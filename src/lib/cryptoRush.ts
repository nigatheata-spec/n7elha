// ── Crypto Rush (Cyber War) ─────────────────────────────────────────────────
// Shared by the join screen (first password), the reward cards and the
// password-change card. Balances are only ever changed through the
// crypto_rush_* RPCs so no phone writes a number it read earlier.

// English pool: trendy internet-slang flavored, keeps the "hacker handle" feel
export const PASSWORD_POOL_EN = [
  "skibidi_toilet", "sigma_grindset", "rizz_god_67", "gyatt_alert", "no_cap_frfr",
  "ohio_rizz", "goated_67", "npc_moment", "brainrot_king", "aura_100k",
  "delulu_mode", "mewing_maxx", "sigma_67", "chad_energy", "labubu_army",
  "z3r0_c00l", "matrix_42", "quantum_leap", "cyber_punk_77", "hyper_drive_8",
];
// Arabic pool: ~70% Arabic slang, ~30% trendy English mixed in
export const PASSWORD_POOL_AR = [
  "زعيم_67", "فشخ_99", "أسطورة_42", "وحش_الشبكة", "نار_تجنن",
  "جامد_قوي", "ملك_البيانات", "خطير_بزيادة", "طاقة_زعيم", "هكر_شبح",
  "sigma_67", "gyatt_alert", "labubu_67", "goated_af",
];

export const passwordChoices = (ar: boolean, n = 5, except: string[] = []) =>
  [...(ar ? PASSWORD_POOL_AR : PASSWORD_POOL_EN)]
    .filter(p => !except.includes(p))
    .sort(() => Math.random() - 0.5)
    .slice(0, n);

export type OutputResult =
  | { kind: "flat"; value: number }
  | { kind: "mult"; value: number }
  | { kind: "hack" }
  | { kind: "dud" }
  | { kind: "password" };

// Equal-probability pool for the ordinary cards.
const POOL: OutputResult[] = [
  { kind: "flat", value: 10 },
  { kind: "flat", value: 20 },
  { kind: "flat", value: 30 },
  { kind: "flat", value: 50 },
  { kind: "mult", value: 2 },
  { kind: "mult", value: 3 },
  { kind: "hack" },
  { kind: "dud" },
];

/** Chance any one card is the rare "change your password" card. */
export const PASSWORD_CARD_CHANCE = 0.05;

export const drawCard = (rand: () => number = Math.random): OutputResult =>
  rand() < PASSWORD_CARD_CHANCE ? { kind: "password" } : POOL[Math.floor(rand() * POOL.length)];

export const buildDeck = (rand: () => number = Math.random): OutputResult[] => [drawCard(rand), drawCard(rand), drawCard(rand)];

/** Share of the target's balance a successful hack takes. */
export const hackPct = (rand: () => number = Math.random) => 0.3 + rand() * 0.4;
