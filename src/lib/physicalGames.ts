// ── Physical Games — printed board, QR-scan question dispenser ─────────────
// A kit is a physical board printed once; its QR only encodes an ID, so
// everything it *points to* (which quiz/session is active) stays editable
// server-side even after printing. Only 6 square designs exist and repeat
// across every board, so a square-type scan can never mean "give me this
// exact square's question" — it always pulls the next unused question of
// that difficulty from the session's own quiz.
//
// Square scans are meant to be opened by ANY phone's camera app (the printed
// QR is a real URL to /scan/:kitId/:typeCode, a public unauthenticated
// route), not just the teacher's device — so dispensePhysicalQuestion below
// is shared between that public page and PhysicalMonitor's in-app scanner
// fallback, and every call is a self-contained DB round trip (no client-side
// session state to coordinate between different students' phones).

import { supabase } from "@/integrations/supabase/client";

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

export type PhysicalQuestion = { id: string; text: string; options: string[]; correct_index: number };

export type DispenseResult =
  | { kind: "question"; type: SquareType; q: PhysicalQuestion }
  | { kind: "rest"; type: SquareType }
  | { kind: "error"; message: string };

/** Finds the currently-running session for a kit, so any phone can independently resolve "what game is this board playing right now". */
export const findActiveSessionForKit = async (kitId: string) => {
  const { data: kit } = await supabase.from("kits").select("*").eq("id", kitId).maybeSingle();
  if (!kit || kit.status !== "active") return { error: "kit-inactive" as const };
  const { data: session } = await supabase.from("game_sessions").select("*")
    .eq("kit_id", kitId).eq("status", "running")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!session) return { error: "no-session" as const };
  return { session };
};

/** Pulls the next unused question for a square scan, falling back to any unused question, then reshuffling once the whole quiz's been shown this session. */
export const dispensePhysicalQuestion = async (sessionId: string, quizId: string, typeCode: number): Promise<DispenseResult> => {
  const type = SQUARE_TYPES[typeCode];
  if (!type) return { kind: "error", message: "unknown-type" };
  if (type.kind === "rest") return { kind: "rest", type };

  const difficulty = type.kind === "wildcard"
    ? (["easy", "medium", "hard"] as const)[Math.floor(Math.random() * 3)]
    : type.difficulty!;

  const usedIds = async () => {
    const { data } = await supabase.from("physical_used_questions").select("question_id").eq("session_id", sessionId);
    return new Set((data ?? []).map((u: any) => u.question_id));
  };

  const pickByDifficulty = async () => {
    const used = await usedIds();
    const { data: pool } = await supabase.from("questions").select("id,text,options,correct_index")
      .eq("quiz_id", quizId).eq("difficulty", difficulty);
    return (pool ?? []).filter((q: any) => !used.has(q.id));
  };

  let candidates = await pickByDifficulty();
  if (!candidates.length) {
    const { data: allOfDifficulty } = await supabase.from("questions").select("id").eq("quiz_id", quizId).eq("difficulty", difficulty);
    const ids = (allOfDifficulty ?? []).map((q: any) => q.id);
    if (ids.length) await supabase.from("physical_used_questions").delete().eq("session_id", sessionId).in("question_id", ids);
    candidates = await pickByDifficulty();
  }

  // The quiz may not have any question tagged at this exact difficulty at all
  // (e.g. generated without a difficulty spread) — fall back to any unused
  // question rather than blocking play on a tagging gap.
  if (!candidates.length) {
    const used = await usedIds();
    const { data: anyPool } = await supabase.from("questions").select("id,text,options,correct_index").eq("quiz_id", quizId);
    candidates = (anyPool ?? []).filter((q: any) => !used.has(q.id));
    if (!candidates.length) {
      const allIds = (anyPool ?? []).map((q: any) => q.id);
      if (allIds.length) await supabase.from("physical_used_questions").delete().eq("session_id", sessionId).in("question_id", allIds);
      candidates = anyPool ?? [];
    }
  }

  if (!candidates.length) return { kind: "error", message: "no-questions" };

  const q = candidates[Math.floor(Math.random() * candidates.length)];
  await supabase.from("physical_used_questions").insert({ session_id: sessionId, question_id: q.id });
  return { kind: "question", type, q };
};
