// ── Homework monitor ────────────────────────────────────────────────────────
// The teacher's view of an assignment. Unlike every other mode's monitor this
// is not a projector screen — nothing is happening live in a classroom, so it
// is a worksheet: the share link at the top, and a roster of who has submitted
// underneath. It still subscribes to realtime so a teacher watching during
// class sees submissions land without refreshing.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { Copy, Check, X, Link2, Square, BookOpen, Users, Percent, ChevronLeft, ChevronDown } from "lucide-react";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";

interface Props { session: any; sessionId: string; }

const AV_COLORS = ["#2563eb", "#16a34a", "#b45309", "#dc2626", "#7c3aed", "#0891b2", "#c2410c", "#0f766e"];
const av = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return { bg: AV_COLORS[Math.abs(h) % AV_COLORS.length], letter: (name.charAt(0) || "?").toUpperCase() };
};

const NB = "border-2 border-[hsl(var(--nb-border))]";

const HomeworkMonitor = ({ session, sessionId }: Props) => {
  const nav = useNavigate();
  const { i18n } = useTranslation();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const ar = (session?.settings?.lang ?? i18n.language) === "ar";

  const [students, setStudents] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [answersByStudent, setAnswersByStudent] = useState<Record<string, any[]>>({});
  const total = questions.length;

  const link = `${window.location.origin}/hw/${sessionId}`;
  const closed = session?.status === "finished" || session?.status === "cancelled";

  useEffect(() => {
    if (!sessionId) return;
    const refresh = async () => {
      const { data } = await supabase.from("game_students").select("*")
        .eq("session_id", sessionId).order("joined_at");
      setStudents(data ?? []);
    };
    refresh();
    if (session?.quiz_id) {
      supabase.from("questions").select("id, text, options, correct_index, position")
        .eq("quiz_id", session.quiz_id).order("position")
        .then(({ data }) => setQuestions(data ?? []));
    }
    const ch = supabase.channel(`hw-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_students", filter: `session_id=eq.${sessionId}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, session?.quiz_id]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(ar ? "تعذّر النسخ" : "Could not copy");
    }
  };

  const closeNow = async () => {
    const ok = await confirm(ar
      ? "إغلاق الواجب؟ لن يتمكن الطلاب من فتح الرابط بعدها."
      : "Close this homework? Students will no longer be able to open the link.");
    if (!ok) return;
    await supabase.from("game_sessions").update({
      status: "finished", ended_at: new Date().toISOString(),
    }).eq("id", sessionId);
    toast.success(ar ? "تم إغلاق الواجب" : "Homework closed");
  };

  // A student counts as "submitted" once game_students has their final tally.
  // That row is written exactly once, when the student finishes — there is no
  // in-between state to show, on purpose: a live "on question 3 of 5" ticker
  // was more noise than signal, and it meant every answer round-tripped
  // through the DB just to feed it. Nothing updates until a submission lands.
  const { submitted, avg } = useMemo(() => {
    const done = students.filter(s => total > 0 && (s.total_answers ?? 0) >= total);
    const mean = done.length
      ? Math.round(done.reduce((a, s) => a + ((s.correct_answers ?? 0) / (total || 1)) * 100, 0) / done.length)
      : 0;
    return { submitted: done.length, avg: mean };
  }, [students, total]);

  const ranked = [...students].sort((a, b) => (b.correct_answers ?? 0) - (a.correct_answers ?? 0));

  // Answers are fetched per student on demand rather than joined into the
  // roster query up front — a teacher usually only opens this for the one
  // or two students who didn't do well, not the whole class every load.
  // Only ever opened for a student who has submitted — question_responses is
  // written per-answer for resume purposes, so an in-progress student's rows
  // exist too, but surfacing those would just be the removed "live progress"
  // view again in disguise. Nothing about a student is visible before they
  // submit.
  const toggleExpand = async (studentId: string) => {
    if (expanded === studentId) { setExpanded(null); return; }
    setExpanded(studentId);
    if (!answersByStudent[studentId]) {
      const { data } = await supabase.from("question_responses")
        .select("question_id, answer_index, is_correct").eq("student_id", studentId);
      setAnswersByStudent(prev => ({ ...prev, [studentId]: data ?? [] }));
    }
  };

  const dueAt: string | null = session?.settings?.dueAt ?? null;
  const dueLabel = dueAt
    ? new Date(dueAt).toLocaleString(ar ? "ar" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div>
      {ConfirmDialog}
      <div className="max-w-3xl mx-auto space-y-5">

        {/* ── Header ── */}
        <div className={`rounded-2xl bg-white ${NB} shadow-[4px_4px_0_0_hsl(var(--nb-border))] px-5 py-4 flex flex-wrap items-center justify-between gap-4`}>
          <div className="flex items-center gap-4">
            <button onClick={() => nav("/app/games")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] tracking-[0.3em] uppercase font-bold ${NB} shadow-[3px_3px_0_0_hsl(var(--nb-border))] hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_0_hsl(var(--nb-border))] transition-all text-[#3F5A63]`}>
              <ChevronLeft className="h-3 w-3" />{ar ? "رجوع" : "Back"}
            </button>
            <div className="h-4 w-px bg-[hsl(var(--nb-border))]/25" />
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8FC44A]">
                <BookOpen className="h-3 w-3" />
                {ar ? "واجب" : "HOMEWORK"}
              </div>
              <h1 className="mt-0.5 text-xl sm:text-2xl font-bold text-[#3F5A63] leading-tight"
                style={{ fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}>
                {session?.quizzes?.title ?? (ar ? "واجب" : "Homework")}
              </h1>
              {dueLabel && (
                <p className="mt-0.5 text-xs font-semibold" style={{ color: "#C8783A" }}>
                  {ar ? `التسليم قبل ${dueLabel}` : `Due ${dueLabel}`}
                </p>
              )}
            </div>
          </div>
          {!closed ? (
            <button onClick={closeNow}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold bg-white text-red-600 ${NB} shadow-[3px_3px_0_0_hsl(var(--nb-border))] hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_0_hsl(var(--nb-border))] transition-all shrink-0`}>
              <Square className="h-4 w-4" />
              {ar ? "إغلاق الواجب" : "Close homework"}
            </button>
          ) : (
            <span className={`rounded-xl px-4 py-2.5 text-sm font-bold bg-black/[0.04] text-black/45 ${NB} shrink-0`}>
              {ar ? "مقفل" : "Closed"}
            </span>
          )}
        </div>

        {/* ── Share link ── */}
        <div className={`rounded-2xl p-6 bg-white ${NB} shadow-[4px_4px_0_0_hsl(var(--nb-border))] space-y-3`}>
          <div className="flex items-center gap-2 text-[12px] font-semibold tracking-widest uppercase text-black/40">
            <Link2 className="h-3.5 w-3.5" />
            {ar ? "رابط الواجب" : "Homework link"}
          </div>
          <p className="text-sm text-black/55 leading-relaxed">
            {ar
              ? "أرسل هذا الرابط لطلابك. يفتحونه في أي وقت، يكتبون أسماءهم، ويحلّون الأسئلة بمفردهم — بدون رمز ولا ردهة."
              : "Send this link to your students. They open it whenever they want, enter their name, and work through the questions on their own — no code, no lobby."}
          </p>
          <div className="flex items-stretch gap-2">
            <div className={`flex-1 min-w-0 rounded-xl px-4 py-3 bg-[hsl(var(--background))] ${NB} font-mono text-[13px] text-[#3F5A63] truncate select-all`} dir="ltr">
              {link}
            </div>
            <button onClick={copy}
              className={`shrink-0 flex items-center gap-2 rounded-xl px-4 text-sm font-bold ${NB} shadow-[3px_3px_0_0_hsl(var(--nb-border))] hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_0_hsl(var(--nb-border))] transition-all ${copied ? "bg-[#8FC44A] text-white" : "bg-[#3F5A63] text-white"}`}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? (ar ? "تم النسخ" : "Copied") : (ar ? "نسخ" : "Copy")}
            </button>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className={`rounded-2xl bg-white ${NB} shadow-[4px_4px_0_0_hsl(var(--nb-border))] grid grid-cols-3 divide-x divide-[hsl(var(--nb-border))] rtl:divide-x-reverse`}>
          <Stat icon={<Users className="h-4 w-4" />} label={ar ? "بدأوا" : "Started"} value={String(students.length)} />
          <Stat icon={<Check className="h-4 w-4" />} label={ar ? "سلّموا" : "Submitted"} value={String(submitted)} />
          <Stat icon={<Percent className="h-4 w-4" />} label={ar ? "المعدل" : "Average"} value={`${avg}%`} />
        </div>

        {/* ── Roster ── */}
        <div className={`rounded-2xl bg-white ${NB} shadow-[4px_4px_0_0_hsl(var(--nb-border))] overflow-hidden`}>
          <div className="px-5 py-3 border-b-2 border-[hsl(var(--nb-border))] text-[12px] font-semibold tracking-widest uppercase text-black/40">
            {ar ? "التسليمات" : "Submissions"}
          </div>
          {ranked.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-black/40">
              {ar ? "لم يبدأ أي طالب بعد" : "No student has started yet"}
            </div>
          ) : (
            <ul className="divide-y divide-black/[0.06]">
              {ranked.map(s => {
                const { bg, letter } = av(s.name ?? "?");
                const answered = s.total_answers ?? 0;
                const correct = s.correct_answers ?? 0;
                const complete = total > 0 && answered >= total;
                const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
                const isOpen = complete && expanded === s.id;
                const answers = answersByStudent[s.id];
                const byQuestion = new Map((answers ?? []).map((a: any) => [a.question_id, a]));
                const Row = complete ? "button" : "div";
                return (
                  <li key={s.id}>
                    <Row
                      onClick={complete ? () => toggleExpand(s.id) : undefined}
                      className={`w-full flex items-center gap-3 px-5 py-3 text-start transition-colors ${complete ? "hover:bg-black/[0.02]" : ""}`}
                    >
                      <div className="h-9 w-9 rounded-full flex items-center justify-center font-black text-white text-sm shrink-0"
                        style={{ background: bg }}>{letter}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-[#3F5A63] truncate">{s.name}</div>
                        <div className="text-[12px] text-black/40">
                          {complete ? (ar ? "سلّم" : "Submitted") : (ar ? "لم يسلّم بعد" : "Not submitted yet")}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-black tabular-nums text-[#3F5A63]">{complete ? `${correct}/${total}` : "—"}</div>
                        <div className="text-[12px] font-bold tabular-nums" style={{ color: complete ? "#8FC44A" : "rgba(0,0,0,0.3)" }}>
                          {complete ? `${pct}%` : "—"}
                        </div>
                      </div>
                      {complete && (
                        <ChevronDown className={`h-4 w-4 text-black/30 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      )}
                    </Row>

                    {isOpen && (
                      <div className="px-5 pb-4 space-y-1.5">
                        {!answers ? (
                          <div className="text-xs text-black/35 py-2">{ar ? "جارٍ التحميل…" : "Loading…"}</div>
                        ) : questions.length === 0 ? null : (
                          questions.map((q, i) => {
                            const a = byQuestion.get(q.id);
                            const opts = Array.isArray(q.options) ? q.options : [];
                            return (
                              <div key={q.id} className={`rounded-xl px-3 py-2 text-xs ${NB} ${a ? (a.is_correct ? "bg-[#8FC44A]/10" : "bg-red-500/10") : "bg-black/[0.03] opacity-60"}`}>
                                <div className="flex items-start gap-2">
                                  {a ? (
                                    a.is_correct
                                      ? <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[#8FC44A]" strokeWidth={3} />
                                      : <X className="h-3.5 w-3.5 mt-0.5 shrink-0 text-red-500" strokeWidth={3} />
                                  ) : <span className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
                                  <div className="min-w-0" dir="auto">
                                    <div className="font-semibold text-[#3F5A63]">{i + 1}. {q.text}</div>
                                    {a ? (
                                      !a.is_correct && (
                                        <div className="mt-0.5 text-black/50">
                                          {ar ? "أجاب: " : "Answered: "}
                                          <span className="text-red-500 font-medium">{opts[a.answer_index]}</span>
                                          {" · "}
                                          {ar ? "الصحيح: " : "Correct: "}
                                          <span className="text-[#8FC44A] font-medium">{opts[q.correct_index]}</span>
                                        </div>
                                      )
                                    ) : (
                                      <div className="mt-0.5 text-black/35">{ar ? "لم يُجب بعد" : "Not answered yet"}</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

const Stat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="p-4">
    <div className="flex items-center gap-1.5 text-black/35">{icon}
      <span className="text-[11px] font-semibold tracking-widest uppercase">{label}</span>
    </div>
    <div className="mt-1.5 text-2xl font-black tabular-nums text-[#3F5A63]">{value}</div>
  </div>
);

export default HomeworkMonitor;
