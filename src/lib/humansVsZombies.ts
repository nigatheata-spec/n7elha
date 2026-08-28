export type Team = "human" | "zombie";

export const INCOME_TIERS: {
  level: 1 | 2 | 3 | 4 | 5;
  cost: number;
  payout: number;
  nameEn: string;
  nameAr: string;
}[] = [
  { level: 1, cost: 0,     payout: 1,   nameEn: "Bare Hands",       nameAr: "بدون أداة" },
  { level: 2, cost: 10,    payout: 5,   nameEn: "Scavenger Tool",   nameAr: "أداة البحث" },
  { level: 3, cost: 100,   payout: 20,  nameEn: "Supply Drop",      nameAr: "إمدادات جوية" },
  { level: 4, cost: 1000,  payout: 100, nameEn: "High-Tech Lab",    nameAr: "مختبر متطور" },
  { level: 5, cost: 10000, payout: 500, nameEn: "Quantum Core",     nameAr: "نواة الكم" },
];

export const ZOMBIE_INCOME_NAMES: Record<number, { nameEn: string; nameAr: string }> = {
  1: { nameEn: "Bare Hands",      nameAr: "بدون أداة" },
  2: { nameEn: "Bite Efficiency", nameAr: "كفاءة العضة" },
  3: { nameEn: "Viral Bloom",     nameAr: "ازدهار فيروسي" },
  4: { nameEn: "Apex Evolution",  nameAr: "تطور القمة" },
  5: { nameEn: "Genetic Masterpiece", nameAr: "تحفة وراثية" },
};

/** Wrong-answer streak protection. Level 1 = hard reset to 0; higher levels drop by less. */
export const STREAK_DRAIN_TIERS: {
  level: 1 | 2 | 3 | 4;
  cost: number;
  dropBy: number | null; // null = full reset to 0
  nameEn: string;
  nameAr: string;
}[] = [
  { level: 1, cost: 0,    dropBy: null, nameEn: "No Buffer",    nameAr: "بدون حماية" },
  { level: 2, cost: 25,   dropBy: 3,    nameEn: "Slight Buffer", nameAr: "حماية خفيفة" },
  { level: 3, cost: 250,  dropBy: 2,    nameEn: "Medium Buffer", nameAr: "حماية متوسطة" },
  { level: 4, cost: 2500, dropBy: 1,    nameEn: "Max Buffer",   nameAr: "حماية قصوى" },
];

/** Wrong-answer wallet-loss protection. */
export const CASH_INSURANCE_TIERS: {
  level: 1 | 2 | 3 | 4;
  cost: number;
  lossPct: number;
  nameEn: string;
  nameAr: string;
}[] = [
  { level: 1, cost: 0,    lossPct: 50, nameEn: "Uninsured",     nameAr: "بدون تأمين" },
  { level: 2, cost: 50,   lossPct: 35, nameEn: "Basic Cover",   nameAr: "تغطية أساسية" },
  { level: 3, cost: 500,  lossPct: 20, nameEn: "Solid Cover",   nameAr: "تغطية قوية" },
  { level: 4, cost: 5000, lossPct: 5,  nameEn: "Full Cover",    nameAr: "تغطية كاملة" },
];

export const streakMultiplier = (streak: number): number =>
  streak >= 8 ? 4 : streak >= 5 ? 3 : streak >= 2 ? 2 : 1;

export type BattleActionKey =
  | "vaccine_dose" | "fortified_wall" | "expand_outpost" | "emp_blast" | "vaccine_surge"
  | "biological_strike" | "multiplier_thief" | "health_decay"
  | "airborne_strain" | "horde_rush" | "apex_evolution" | "smoke_grenade" | "alpha_mutation"
  | "horde_breach" | "resource_sabotage" | "toxic_cloud"
  | "cash_multiplier" | "streak_lock";

export const BATTLE_ACTIONS: {
  key: BattleActionKey;
  team: Team;
  cost: number;
  healthDelta?: number;     // heals the BUYER'S OWN team
  maxHealthDelta?: number;  // permanently raises the buyer's own team's health cap
  freezeMs?: number;        // freezes the OPPOSING team's answer submission
  blurMs?: number;          // blurs the OPPOSING team's screen
  buffType?: "cash_mult" | "streak_lock"; // team-wide buff for the buyer's OWN team
  buffMs?: number;
  damageAmount?: number;    // instant HP hit to the OPPOSING team
  stealPct?: number;        // % of the opposing team's payout diverted to the buyer, while active
  stealMs?: number;
  incomeDebuffTiers?: number; // opposing team's effective income tier is lowered by this many levels
  incomeDebuffMs?: number;
  drainBoostMs?: number;    // opposing team's passive drain rate doubles for this long
  nameEn: string;
  nameAr: string;
}[] = [
  { key: "vaccine_dose",   team: "human", cost: 15,   healthDelta: 10, nameEn: "Vaccine Dose",   nameAr: "جرعة لقاح" },
  { key: "fortified_wall", team: "human", cost: 150,  healthDelta: 40, nameEn: "Fortified Wall", nameAr: "جدار محصّن" },
  { key: "expand_outpost", team: "human", cost: 300,  healthDelta: 15, maxHealthDelta: 15, nameEn: "Expand Outpost", nameAr: "توسيع القاعدة" },
  { key: "emp_blast",      team: "human", cost: 200,  blurMs: 10_000, nameEn: "EMP Blast",     nameAr: "قنبلة كهرومغناطيسية" },
  { key: "vaccine_surge",  team: "human", cost: 1500, healthDelta: 40, freezeMs: 7_000, nameEn: "Vaccine Surge", nameAr: "موجة اللقاح" },
  { key: "biological_strike", team: "human", cost: 400,  damageAmount: 15, nameEn: "Biological Strike", nameAr: "ضربة بيولوجية" },
  { key: "multiplier_thief",  team: "human", cost: 800,  stealPct: 20, stealMs: 30_000, nameEn: "Multiplier Thief", nameAr: "لص المضاعف" },
  { key: "health_decay",      team: "human", cost: 1200, drainBoostMs: 20_000, nameEn: "Health Decay", nameAr: "تحلل صحي" },
  { key: "cash_multiplier", team: "human", cost: 1000, buffType: "cash_mult", buffMs: 60_000, nameEn: "Global Cash Multiplier", nameAr: "مضاعف النقود الجماعي" },
  { key: "streak_lock",     team: "human", cost: 1200, buffType: "streak_lock", buffMs: 90_000, nameEn: "Streak Lock", nameAr: "قفل السلسلة" },

  { key: "airborne_strain", team: "zombie", cost: 15,   healthDelta: 10, nameEn: "Airborne Strain", nameAr: "سلالة محمولة جواً" },
  { key: "horde_rush",      team: "zombie", cost: 150,  healthDelta: 40, nameEn: "Horde Rush",      nameAr: "هجوم القطيع" },
  { key: "apex_evolution",  team: "zombie", cost: 300,  healthDelta: 15, maxHealthDelta: 15, nameEn: "Apex Evolution", nameAr: "تطور القمة" },
  { key: "smoke_grenade",   team: "zombie", cost: 200,  blurMs: 10_000, nameEn: "Smoke Grenade",   nameAr: "قنبلة دخان" },
  { key: "alpha_mutation",  team: "zombie", cost: 1500, healthDelta: 40, freezeMs: 7_000, nameEn: "Alpha Mutation",  nameAr: "الطفرة الألفا" },
  { key: "horde_breach",       team: "zombie", cost: 400,  damageAmount: 15, nameEn: "Horde Breach", nameAr: "اختراق القطيع" },
  { key: "resource_sabotage",  team: "zombie", cost: 800,  incomeDebuffTiers: 2, incomeDebuffMs: 30_000, nameEn: "Resource Sabotage", nameAr: "تخريب الموارد" },
  { key: "toxic_cloud",        team: "zombie", cost: 1200, drainBoostMs: 20_000, nameEn: "Toxic Cloud", nameAr: "سحابة سامة" },
  { key: "cash_multiplier", team: "zombie", cost: 1000, buffType: "cash_mult", buffMs: 60_000, nameEn: "Global Cash Multiplier", nameAr: "مضاعف النقود الجماعي" },
  { key: "streak_lock",     team: "zombie", cost: 1200, buffType: "streak_lock", buffMs: 90_000, nameEn: "Streak Lock", nameAr: "قفل السلسلة" },
];

export const battleActionsForTeam = (team: Team) => BATTLE_ACTIONS.filter(a => a.team === team);

export const DAY_CYCLE_MS = 60_000;
export const WIN_DAYS = 5;
export const START_HEALTH = 100;
export const HEALTH_DRAIN_PER_SEC = 0.25; // both teams lose this every second, simultaneously — full drain in ~6.7 min unhealed
