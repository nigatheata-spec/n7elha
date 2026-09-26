import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Check, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// ── What you missed ─────────────────────────────────────────────────────────
// The end of every mode on the student's phone: a button that opens the
// questions this student got wrong in this game, each with what they picked
// and the right answer. Read from question_responses, so it's the same record
// the teacher's analytics use. A question they missed and later got right
// still shows, marked as fixed: seeing it once more is the point.

type Q = { id: string; text: string; options: string[]; correct_index: number; image_url?: string | null };
type Missed = { q: Q; picked: number; fixed: boolean; times: number };

interface Props {
  sessionId: string;
  studentId: string;
  ar: boolean;
  /** Button look: "dark" for modes on a dark screen, "light" for the rest. */
  tone?: "light" | "dark";
  className?: string;
}

const MissedReview = ({ sessionId, studentId, ar, tone = "light", className }: Props) => {
  const [open, setOpen] = useState(false);
  const [missed, setMissed] = useState<Missed[] | null>(null);
  const [total, setTotal] = useState({ answered: 0, right: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase.from("question_responses")
        .select("question_id,answer_index,is_correct,answered_at")
        .eq("session_id", sessionId).eq("student_id", studentId)
        .order("answered_at", { ascending: true });
      if (cancelled || !rows) return;
      setTotal({ answered: rows.length, right: rows.filter(r => r.is_correct).length });
      const wrong = new Map<string, { picked: number; times: number }>();
      const rightAfter = new Set<string>();
      for (const r of rows) {
        if (!r.question_id) continue;
        if (!r.is_correct) {
          const w = wrong.get(r.question_id);
          wrong.set(r.question_id, { picked: r.answer_index, times: (w?.times ?? 0) + 1 });
          rightAfter.delete(r.question_id);
        } else if (wrong.has(r.question_id)) rightAfter.add(r.question_id);
      }
      if (wrong.size === 0) { setMissed([]); return; }
      const { data: qs } = await supabase.from("questions")
        .select("id,text,options,correct_index,image_url").in("id", [...wrong.keys()]);
      if (cancelled) return;
      const byId = new Map((qs ?? []).map(q => [q.id, { ...q, options: Array.isArray(q.options) ? q.options as string[] : [] } as Q]));
      const list: Missed[] = [];
      for (const [id, w] of wrong) {
        const q = byId.get(id);
        if (q) list.push({ q, picked: w.picked, times: w.times, fixed: rightAfter.has(id) });
      }
      // Still-wrong first: those are the ones worth reading.
      list.sort((a, b) => Number(a.fixed) - Number(b.fixed) || b.times - a.times);
      setMissed(list);
    })();
    return () => { cancelled = true; };
  }, [sessionId, studentId]);

  if (missed === null || total.answered === 0) return null;

  const count = missed.filter(m => !m.fixed).length;
  const dark = tone === "dark";

  return (
    <>
      <button onClick={() => setOpen(true)}
        className={cn("flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-extrabold active:scale-95 transition-transform", className)}
        style={dark
          ? { background: "rgba(255,255,255,0.1)", color: "#FFFFFF" }
          : { background: "rgba(18,58,51,0.08)", color: "#123A33" }}>
        <BookOpen className="h-4 w-4" />
        {missed.length === 0
          ? (ar ? "لم تخطئ في أي سؤال" : "You missed nothing")
          : ar ? `راجع ما فاتك (${missed.length})` : `What you missed (${missed.length})`}
      </button>

      {/* Portalled to <body> so no mode's theme (terminal font, scanlines,
          pixel borders) leaks into it: it reads the same after every game. */}
      {open && createPortal(
        <div dir={ar ? "rtl" : "ltr"} className="fixed inset-0 z-[1000] flex flex-col text-start font-sans"
          style={{ background: "#F7F5EF", color: "#123A33", fontFamily: "'Almarai', system-ui, sans-serif" }}>
          <div className="flex items-center justify-between gap-3 px-5 py-4 shrink-0"
            style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
            <div>
              <div className="text-xl font-extrabold">{ar ? "ما فاتك" : "What you missed"}</div>
              <div className="text-xs font-bold opacity-60">
                {ar
                  ? `${total.right} صحيحة من ${total.answered}${count ? ` — ${count} ما زالت تحتاج مراجعة` : ""}`
                  : `${total.right} right out of ${total.answered}${count ? ` — ${count} still to learn` : ""}`}
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label={ar ? "إغلاق" : "Close"}
              className="h-10 w-10 rounded-full flex items-center justify-center active:scale-95 transition-transform"
              style={{ background: "#123A33", color: "#FFFFFF" }}>
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-6">
            {missed.length === 0 && (
              <div className="pt-16 text-center font-bold opacity-60">
                {ar ? "أجبت عن كل شيء صحيحًا. ممتاز!" : "Every answer was right. Great work!"}
              </div>
            )}
            {missed.map(({ q, picked, fixed }) => (
              <div key={q.id} className="space-y-2.5">
                <div className="flex items-start gap-2">
                  <p className="flex-1 text-[15px] font-extrabold leading-snug">{q.text}</p>
                  {fixed && (
                    <span className="shrink-0 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-black" style={{ background: "#D8F0DF", color: "#15803d" }}>
                      {ar ? "صحّحتها لاحقًا" : "GOT IT LATER"}
                    </span>
                  )}
                </div>
                {q.image_url && <img src={q.image_url} alt="" className="max-h-40 w-auto rounded-xl" />}
                <div className="space-y-1.5">
                  {q.options.map((opt, i) => {
                    const right = i === q.correct_index, mine = i === picked && !right;
                    if (!right && !mine) return null;
                    return (
                      <div key={i} className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-sm font-bold"
                        style={right ? { background: "#D8F0DF", color: "#14532d" } : { background: "#F8DCDC", color: "#7f1d1d" }}>
                        {right ? <Check className="h-4 w-4 shrink-0" /> : <X className="h-4 w-4 shrink-0" />}
                        <span className="flex-1">{opt}</span>
                        <span className="text-[10px] font-black opacity-70 shrink-0">
                          {right ? (ar ? "الصحيحة" : "RIGHT ANSWER") : (ar ? "إجابتك" : "YOUR ANSWER")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};

export default MissedReview;
