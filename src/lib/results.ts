/* Who won. Each mode scores on a different column, so this is the one place
   the ranking rule per mode is written down. */

export type RankableStudent = {
  id: string;
  crypto?: number | null;
  eliminated?: boolean | null;
  eliminated_at?: string | null;
  team?: string | null;
  height_reached?: number | null;
};

export type RankOptions = {
  hvzWinner?: "humans" | "zombies";
  /** Paint Fight territory share, keyed by student id. */
  paintPctById?: Map<string, number>;
};

export const rankStudents = <T extends RankableStudent>(
  students: T[],
  mode: string,
  { hvzWinner, paintPctById }: RankOptions = {},
): T[] => {
  if (mode === "dodgeball") {
    // Survivors first, then the eliminated in reverse order of elimination:
    // lasting longer places higher.
    return [...students].sort((a, b) => {
      if (!a.eliminated && b.eliminated) return -1;
      if (a.eliminated && !b.eliminated) return 1;
      if (a.eliminated_at && b.eliminated_at)
        return new Date(b.eliminated_at).getTime() - new Date(a.eliminated_at).getTime();
      return 0;
    });
  }

  if (mode === "humansvszombies") {
    const winningTeam = hvzWinner === "zombies" ? "zombie" : "human";
    return [...students].sort((a, b) => {
      if (a.team === winningTeam && b.team !== winningTeam) return -1;
      if (a.team !== winningTeam && b.team === winningTeam) return 1;
      return (b.crypto ?? 0) - (a.crypto ?? 0);
    });
  }

  if (mode === "dontlookdown") {
    return [...students].sort((a, b) => (b.height_reached ?? 0) - (a.height_reached ?? 0));
  }

  if (mode === "paintfight") {
    const pct = paintPctById ?? new Map<string, number>();
    return [...students].sort((a, b) => (pct.get(b.id) ?? 0) - (pct.get(a.id) ?? 0));
  }

  // Crypto Rush, Classic and Hot Potato all accumulate into `crypto`, and the
  // query already returns them in descending order.
  return students;
};

// ── CSV export ─────────────────────────────────────────────────────────────
// One row per student, then one column per question: ✓ if they ever got it
// right, ✗ if they only got it wrong, blank if it never came up for them
// (most modes deal questions at random). A last row gives each question's
// share of right answers, so the sheet shows at a glance what to reteach.
// Starts with a UTF-8 BOM: without it Excel reads the file as ANSI and every
// Arabic name comes out as mojibake.

export type CsvResponse = { student_id: string | null; question_id: string | null; is_correct: boolean | null };

const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

export const resultsCsv = (
  head: string[],
  rows: { id: string; cells: (string | number)[] }[],
  questions: { id: string; text: string }[],
  responses: CsvResponse[],
  pctLabel: string,
): string => {
  const seen = new Map<string, boolean>(); // `${student}:${question}` → ever right
  for (const r of responses) {
    if (!r.student_id || !r.question_id) continue;
    const k = `${r.student_id}:${r.question_id}`;
    seen.set(k, (seen.get(k) ?? false) || !!r.is_correct);
  }
  const lines = [[...head, ...questions.map((q, i) => `Q${i + 1}: ${q.text}`)].map(cell).join(",")];
  for (const r of rows) {
    const marks = questions.map(q => {
      const v = seen.get(`${r.id}:${q.id}`);
      return v === undefined ? "" : v ? "✓" : "✗";
    });
    lines.push([...r.cells, ...marks].map(cell).join(","));
  }
  const pct = questions.map(q => {
    let right = 0, asked = 0;
    for (const r of rows) {
      const v = seen.get(`${r.id}:${q.id}`);
      if (v === undefined) continue;
      asked++; if (v) right++;
    }
    return asked ? `${Math.round((right / asked) * 100)}%` : "";
  });
  lines.push([pctLabel, ...head.slice(1).map(() => ""), ...pct].map(cell).join(","));
  return "﻿" + lines.join("\r\n");
};
