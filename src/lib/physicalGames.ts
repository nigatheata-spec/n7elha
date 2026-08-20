// ── Physical Games — printed board, QR-scan question dispenser ─────────────
// A kit is a physical board printed once; its QR only encodes an ID, so
// everything it *points to* (which quiz/session is active) stays editable
// server-side even after printing. Only 6 square designs exist and repeat
// across every board, so a square-type scan can never mean "give me this
// exact square's question" — it always pulls the next unused question of
// that difficulty from the session's own quiz (see PhysicalMonitor).

export type SquareKind = "difficulty" | "rest" | "double" | "wildcard";

export type SquareType = {
  code: number;
  kind: SquareKind;
  difficulty?: "easy" | "medium" | "hard";
  color: string;
  label_en: string;
  label_ar: string;
};

export const SQUARE_TYPES: Record<number, SquareType> = {
  1: { code: 1, kind: "difficulty", difficulty: "easy", color: "#3a9e6e", label_en: "Green — Easy", label_ar: "أخضر — سهل" },
  2: { code: 2, kind: "difficulty", difficulty: "medium", color: "#8a8a8a", label_en: "White — Normal", label_ar: "أبيض — عادي" },
  3: { code: 3, kind: "difficulty", difficulty: "hard", color: "#c0392b", label_en: "Red — Hard", label_ar: "أحمر — صعب" },
  4: { code: 4, kind: "rest", color: "#2f6f8f", label_en: "Teal — Rest", label_ar: "تركواز — استراحة" },
  5: { code: 5, kind: "double", difficulty: "medium", color: "#e0b400", label_en: "Yellow — Double", label_ar: "أصفر — مضاعف" },
  6: { code: 6, kind: "wildcard", color: "#8e44ad", label_en: "? — Wildcard", label_ar: "؟ — عشوائي" },
};

/** Accepts either the full URL (n7elha.app/kit/K4471) or a bare kit code. */
export const parseKitQR = (raw: string): string | null => {
  const s = raw.trim();
  const m = s.match(/\/kit\/([A-Za-z0-9_-]+)\/?(?:[?#].*)?$/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{3,20}$/.test(s)) return s;
  return null;
};

/** Accepts either the full URL (n7elha.app/scan/K4471/3) or a bare "kitId/typeCode". */
export const parseSquareQR = (raw: string): { kitId: string; typeCode: number } | null => {
  const s = raw.trim();
  const m = s.match(/\/scan\/([A-Za-z0-9_-]+)\/([1-6])\/?(?:[?#].*)?$/);
  if (m) return { kitId: m[1], typeCode: Number(m[2]) };
  const parts = s.split("/").filter(Boolean);
  if (parts.length === 2 && /^[1-6]$/.test(parts[1])) return { kitId: parts[0], typeCode: Number(parts[1]) };
  return null;
};
