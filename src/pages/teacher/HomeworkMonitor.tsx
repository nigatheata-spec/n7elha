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
import { Copy, Check, Link2, Square, BookOpen, Users, Percent, ChevronLeft } from "lucide-react";
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
  const [total, setTotal] = useState(0);
  const [copied, setCopied] = useState(false);

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
      supabase.from("questions").select("id", { count: "exact", head: true })
        .eq("quiz_id", session.quiz_id)
        .then(({ count }) => setTotal(count ?? 0));
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

  // A student counts as "submitted" once they have answered every question.
  // Anyone with fewer is mid-way, which is worth seeing separately — it is the
  // difference between "hasn't started" and "gave up on question 3".
  const { submitted, avg } = useMemo(() => {
    const done = students.filter(s => total > 0 && (s.total_answers ?? 0) >= total);
    const mean = done.length
      ? Math.round(done.reduce((a, s) => a + ((s.correct_answers ?? 0) / (total || 1)) * 100, 0) / done.length)
      : 0;
    return { submitted: done.length, avg: mean };
  }, [students, total]);

  const ranked = [...students].sort((a, b) => (b.correct_answers ?? 0) - (a.correct_answers ?? 0));

  const dueAt: string | null = session?.settings?.dueAt ?? null;
  const dueLabel = dueAt
    ? new Date(dueAt).toLocaleString(ar ? "ar" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="min-h-screen p-5 sm:p-8" style={{ background: "hsl(var(--background))" }}>
      {ConfirmDialog}
      <div className="max-w-3xl mx-auto space-y-5">

        <button onClick={() => nav("/app/games")}
          className="flex items-center gap-1.5 text-sm font-medium text-black/50 hover:text-[#3F5A63] transition-colors">
          <ChevronLeft className="h-4 w-4" />
          {ar ? "السجل" : "History"}
        </button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-[12px] font-semibold text-[#8FC44A]">
              <BookOpen className="h-3.5 w-3.5" />
              {ar ? "واجب" : "HOMEWORK"}
            </div>
            <h1 className="mt-2 text-[26px] sm:text-[32px] font-bold text-[#3F5A63] leading-tight"
              style={{ fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}>
              {session?.quizzes?.title ?? (ar ? "واجب" : "Homework")}
            </h1>
            {dueLabel && (
              <p className="mt-1 text-sm font-semibold" style={{ color: "#C8783A" }}>
                {ar ? `التسليم قبل ${dueLabel}` : `Due ${dueLabel}`}
              </p>
            )}
          </div>
          {!closed ? (
            <button onClick={closeNow}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold bg-white text-red-600 ${NB} shadow-[3px_3px_0_0_hsl(var(--nb-border))] hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_0_hsl(var(--nb-border))] transition-all`}>
              <Square className="h-4 w-4" />
              {ar ? "إغلاق الواجب" : "Close homework"}
            </button>
          ) : (
            <span className={`rounded-xl px-4 py-2.5 text-sm font-bold bg-black/[0.04] text-black/45 ${NB}`}>
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
        <div className="grid grid-cols-3 gap-3">
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
                return (
                  <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="h-9 w-9 rounded-full flex items-center justify-center font-black text-white text-sm shrink-0"
                      style={{ background: bg }}>{letter}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-[#3F5A63] truncate">{s.name}</div>
                      <div className="text-[12px] text-black/40">
                        {complete
                          ? (ar ? "سلّم" : "Submitted")
                          : (ar ? `في السؤال ${answered + 1} من ${total}` : `On question ${answered + 1} of ${total}`)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-black tabular-nums text-[#3F5A63]">{correct}/{total}</div>
                      <div className="text-[12px] font-bold tabular-nums" style={{ color: complete ? "#8FC44A" : "rgba(0,0,0,0.3)" }}>
                        {complete ? `${pct}%` : "—"}
                      </div>
                    </div>
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
  <div className={`rounded-2xl p-4 bg-white ${NB} shadow-[3px_3px_0_0_hsl(var(--nb-border))]`}>
    <div className="flex items-center gap-1.5 text-black/35">{icon}
      <span className="text-[11px] font-semibold tracking-widest uppercase">{label}</span>
    </div>
    <div className="mt-1.5 text-2xl font-black tabular-nums text-[#3F5A63]">{value}</div>
  </div>
);

export default HomeworkMonitor;
