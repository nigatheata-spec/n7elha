// ── Lava Floor — rules ───────────────────────────────────────────────────────
// Every correct answer lays one brick on your tower. The lava rises under all
// the towers; when it passes a tower's top, everyone standing on it is dunked
// and floats in it until they answer their way back out.
//
// The teacher picks how towers are shared (settings.lfMode):
//   class — one tower for the whole class
//   teams — one per team (settings.lfTeams, 2 to 4)
//   solo  — one per student
// A tower is `width` bricks wide, its member count at the start, and a course
// only completes once that many bricks are in. So a 30-wide class wall rises
// at about the same pace as one student's pillar, and one lava speed fits all
// three setups.
//
// The projector owns the lava (lava_state) and referees dunks and rescues
// (lava_floor_referee); phones only ever add their own answers
// (lava_floor_answer). See the 20261004120000 migration.

export type LfMode = "class" | "teams" | "solo";

export const LF_MODES: { id: LfMode; nameAr: string; nameEn: string; descAr: string; descEn: string }[] = [
  {
    id: "class", nameAr: "الفصل كله", nameEn: "Whole class",
    descAr: "منصة واحدة يبنيها الجميع معًا. إن وصلتها الحمم فالكل يجاوب ليرفعها.",
    descEn: "One platform everyone builds together. If the lava reaches it, everyone answers to lift it out.",
  },
  {
    id: "teams", nameAr: "فرق", nameEn: "Teams",
    descAr: "كل فريق يبني برجه. أعلى برج عند انتهاء الوقت يفوز.",
    descEn: "Each team builds its own tower. Tallest tower when time runs out wins.",
  },
  {
    id: "solo", nameAr: "فردي", nameEn: "Solo",
    descAr: "كل طالب يبني برجه. من تلحقه الحمم يجاوب ليخرج منها.",
    descEn: "Every student builds their own tower. Whoever the lava catches answers to climb out.",
  },
];

export const TEAM_STYLE = [
  { color: "#8FC44A", nameAr: "الأخضر", nameEn: "Green" },
  { color: "#7FB3C4", nameAr: "الأزرق", nameEn: "Blue" },
  { color: "#F08A8A", nameAr: "الأحمر", nameEn: "Red" },
  { color: "#F5C64E", nameAr: "الأصفر", nameEn: "Yellow" },
];
export const CLASS_COLOR = "#8FC44A";

export type Tower = {
  id: string;
  idx: number;
  name: string | null;
  width: number;
  bricks: number;
  base: number;
  dunked: boolean;
  climb: number;
  dunks: number;
};

export type LavaState = { level: number; at: string; rate: number; erupt_at: string | null };

/** Completed courses above the floor, in meters. What the lava is compared against. */
export const towerHeight = (t: Pick<Tower, "base" | "bricks" | "width">) =>
  t.base + Math.floor(t.bricks / Math.max(1, t.width));

/**
 * Courses the tower's own members have built. This, not towerHeight, decides
 * who wins: a rescue lifts a tower back above the lava (base jumps), and that
 * lift must never beat a team that simply stayed out of it. Answers spent
 * climbing out lay no bricks, so falling in costs exactly those answers.
 */
export const builtHeight = (t: Pick<Tower, "bricks" | "width">) => Math.floor(t.bricks / Math.max(1, t.width));

/** Bricks laid in the course that isn't finished yet. */
export const partialCourse = (t: Pick<Tower, "bricks" | "width">) => t.bricks % Math.max(1, t.width);

/** Correct answers a dunked tower needs to climb out: two for one student, one each for a group. */
export const climbNeed = (width: number) => (width <= 1 ? 2 : width);

export const LAVA_START = -1.5;
export const ERUPT_EVERY = 45;   // seconds between eruptions
export const ERUPT_RISE = 2;     // meters an eruption adds
export const ERUPT_SECS = 2.5;   // how long the surge takes
export const MIN_RATE = 0.03;    // m/s, so the lava never stands still
export const MAX_RATE = 0.35;
export const PACE = 0.4;         // the lava rises at this share of the typical tower's growth
// With the eruptions on top (ERUPT_RISE every ERUPT_EVERY), the lava keeps up
// with a tower answering correctly about every 14 seconds per student: a
// normal class stays just ahead, and the eruptions catch whoever lags.
export const PACE_WINDOW = 60;   // seconds of growth the pace looks at

/** Lava level now, from the last snapshot the projector wrote. */
export const lavaNow = (s: Pick<LavaState, "level" | "at" | "rate">, now = Date.now()) =>
  s.level + s.rate * Math.max(0, (now - new Date(s.at).getTime()) / 1000);

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

/**
 * Steady lava speed from how fast the towers have actually been growing
 * (m/s each over the last PACE_WINDOW). Pegged to the typical tower, not the
 * best, so a slow class and a fast class both get a close race; eruptions on
 * top are what catch the ones falling behind.
 */
export const paceRate = (growths: number[]) =>
  Math.min(MAX_RATE, Math.max(MIN_RATE, median(growths) * PACE));

/** Tower color for the board: the team's, the class's, or the one student's avatar color. */
export const towerColor = (mode: LfMode, t: Pick<Tower, "idx">, soloColor?: string) =>
  mode === "teams" ? TEAM_STYLE[t.idx % TEAM_STYLE.length].color : mode === "class" ? CLASS_COLOR : soloColor ?? CLASS_COLOR;

export const towerName = (mode: LfMode, t: Pick<Tower, "idx" | "name">, ar: boolean) =>
  mode === "teams"
    ? (ar ? `فريق ${TEAM_STYLE[t.idx % TEAM_STYLE.length].nameAr}` : `${TEAM_STYLE[t.idx % TEAM_STYLE.length].nameEn} team`)
    : mode === "class" ? (ar ? "الفصل" : "The class") : t.name ?? "";
