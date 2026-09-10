import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BarChart3, ChevronDown, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  computeAnalytics, forQuiz, type Analytics as Stats,
  type SessionRow, type StudentRow, type ResponseRow, type QuestionRow, type QuizRow,
} from "@/lib/analytics";

// ── Teacher analytics ───────────────────────────────────────────────────────
// A view of src/lib/analytics.ts and nothing else: every number on this page
// comes out of computeAnalytics, so the page can't disagree with the tests.
//
// Fetching is the only thing that lives here, and the one thing to know about
// it is that PostgREST caps a query at 1000 rows. Answers blow past that in a
// term (20 students × 10 questions × 50 sessions), so everything is paged with
// .range() until it comes back short — a single .select() would silently show
// the teacher their first thousand answers and call it a term.

const PAGE = 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fetchAll = async <T,>(build: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: unknown }>): Promise<T[]> => {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
};

const chunks = <T,>(xs: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
};

const MODE_LABEL: Record<string, { ar: string; en: string }> = {
  classic: { ar: "كلاسيكي", en: "Classic" },
  crypto_rush: { ar: "كريبتو", en: "Crypto Rush" },
  dodgeball: { ar: "المراوغة", en: "Dodgeball" },
  hotpotato: { ar: "البطاطا", en: "Hot Potato" },
  lavafloor: { ar: "الحمم", en: "Lava Floor" },
  humansvszombies: { ar: "بشر وزومبي", en: "Humans vs Zombies" },
  dontlookdown: { ar: "لا تنظر للأسفل", en: "Don't Look Down" },
  paintfight: { ar: "معركة الأرض", en: "Paint Fight" },
  physical: { ar: "لوحة", en: "Physical" },
  homework: { ar: "واجب", en: "Homework" },
};

const tone = (pct: number | null) =>
  pct == null ? "text-black/35" : pct >= 75 ? "text-[#4d8a1c]" : pct >= 50 ? "text-[#b06a12]" : "text-[#b4342f]";
const barTone = (pct: number | null) =>
  pct == null ? "#c9d3d0" : pct >= 75 ? "#8FC44A" : pct >= 50 ? "#e0a52a" : "#d64545";

const Analytics = () => {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const [all, setAll] = useState<Stats | null>(null);
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const [sessions, quizRows] = await Promise.all([
          fetchAll<SessionRow>((a, b) => supabase.from("game_sessions")
            .select("id,quiz_id,status,started_at,created_at,settings").eq("teacher_id", user.id).order("created_at").range(a, b)),
          fetchAll<QuizRow>((a, b) => supabase.from("quizzes")
            .select("id,title,subject").eq("created_by", user.id).order("created_at").range(a, b)),
        ]);
        const sessionIds = sessions.map(s => s.id);
        const quizIds = Array.from(new Set(sessions.map(s => s.quiz_id)));
        // .in() goes in the URL, so very long id lists are chunked rather than
        // trusted to fit.
        const [students, responses, questions] = await Promise.all([
          Promise.all(chunks(sessionIds, 200).map(ids => fetchAll<StudentRow>((a, b) => supabase.from("game_students")
            .select("id,session_id,name,correct_answers,total_answers").in("session_id", ids).order("id").range(a, b)))).then(x => x.flat()),
          Promise.all(chunks(sessionIds, 200).map(ids => fetchAll<ResponseRow>((a, b) => supabase.from("question_responses")
            .select("session_id,student_id,question_id,answer_index,is_correct").in("session_id", ids).order("id").range(a, b)))).then(x => x.flat()),
          Promise.all(chunks(quizIds, 200).map(ids => fetchAll<QuestionRow>((a, b) => supabase.from("questions")
            .select("id,quiz_id,text,options,correct_index").in("quiz_id", ids).order("id").range(a, b)))).then(x => x.flat()),
        ]);
        if (cancelled) return;
        setQuizzes(quizRows);
        setAll(computeAnalytics(sessions, students, responses, questions, quizRows));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  return <AnalyticsView all={all} quizzes={quizzes} error={error} ar={i18n.language === "ar"} />;
};

export const AnalyticsView = ({ all, quizzes, error, ar }: { all: Stats | null; quizzes: QuizRow[]; error: string | null; ar: boolean }) => {
  const { t } = useTranslation();
  const [quizId, setQuizId] = useState<string | null>(null);

  const stats = useMemo(() => (all ? forQuiz(all, quizId) : null), [all, quizId]);
  const hostedQuizzes = useMemo(() => {
    if (!all) return [];
    const ids = new Set(all.perQuiz.map(q => q.id));
    return quizzes.filter(q => ids.has(q.id));
  }, [all, quizzes]);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(ar ? "ar-EG" : "en-GB", { day: "numeric", month: "short" });

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="rounded-2xl border-2 border-[hsl(var(--nb-border))] bg-white shadow-[4px_4px_0_0_hsl(var(--nb-border))] px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />{t("analytics")}
        </h1>
        {hostedQuizzes.length > 1 && (
          <label className="relative">
            <select value={quizId ?? ""} onChange={e => setQuizId(e.target.value || null)}
              className="appearance-none rounded-full border-2 border-[hsl(var(--nb-border))] bg-white ps-4 pe-9 py-2 text-sm font-bold max-w-[60vw] truncate">
              <option value="">{ar ? "كل الاختبارات" : "All quizzes"}</option>
              {hostedQuizzes.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
          </label>
        )}
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}
      {!stats && !error && <div className="text-muted-foreground">...</div>}

      {stats && stats.totals.sessions === 0 && (
        <div className="py-16 flex flex-col items-center gap-4 text-center">
          <p className="text-lg font-bold">{ar ? "لا توجد بيانات بعد" : "Nothing to show yet"}</p>
          <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
            {ar
              ? "استضف لعبة واحدة وستظهر هنا نسبة الإجابات الصحيحة، والأسئلة التي أخطأ فيها الطلاب، ومن يحتاج إلى متابعة."
              : "Host one game and this page fills in: how the class did, which questions tripped them up, and who could use a word after class."}
          </p>
          <Link to="/app/quizzes" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent text-white font-bold text-sm">
            <Play className="h-4 w-4 fill-current" />{ar ? "استضف لعبة" : "Host a game"}
          </Link>
        </div>
      )}

      {stats && stats.totals.sessions > 0 && (
        <>
          {/* ── The four numbers ────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 border-t-2 border-b-2 border-[hsl(var(--nb-border))]">
            {[
              { n: stats.totals.sessions, label: ar ? "لعبة" : "games played" },
              { n: stats.totals.students, label: ar ? "مشاركة طالب" : "student plays" },
              { n: stats.totals.answers, label: ar ? "إجابة" : "answers" },
              { n: stats.totals.pct == null ? "—" : `${stats.totals.pct}%`, label: ar ? "إجابات صحيحة" : "answered correctly", pct: stats.totals.pct },
            ].map((s, i) => (
              <div key={i} className={cn("py-6 px-4", i > 0 && "border-s border-black/15", i === 2 && "max-lg:border-s-0", i >= 2 && "max-lg:border-t border-black/15")}>
                <div className={cn("text-[40px] sm:text-[48px] leading-none font-extrabold tabular-nums", "pct" in s ? tone(s.pct ?? null) : "text-primary")}>{s.n}</div>
                <div className="mt-2 text-[12px] font-bold tracking-wide uppercase text-black/45">{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── Over time ────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-bold mb-1">{ar ? "عبر الزمن" : "Over time"}</h2>
            <p className="text-sm text-black/50 mb-4">
              {ar ? "نسبة الإجابات الصحيحة في كل لعبة، بالترتيب." : "Share of answers that were correct, one bar per game, oldest first."}
            </p>
            <div className="overflow-x-auto pb-2">
              <div className="flex items-end gap-1.5 h-40 min-w-max" dir="ltr">
                {stats.sessions.slice(-40).map(s => (
                  <div key={s.id} className="group relative flex flex-col items-center w-5">
                    <div className="absolute bottom-full mb-2 hidden group-hover:block z-10 whitespace-nowrap rounded-xl bg-primary text-white text-[11px] px-2.5 py-1.5 shadow">
                      <div className="font-bold">{s.quizTitle || "—"}</div>
                      <div className="opacity-80">
                        {MODE_LABEL[s.mode]?.[ar ? "ar" : "en"] ?? s.mode} · {s.students} {ar ? "طالب" : "students"} · {s.pct == null ? "—" : `${s.pct}%`}
                      </div>
                    </div>
                    <div className="w-full rounded-t-[3px] transition-[height]"
                      style={{ height: `${Math.max(4, (s.pct ?? 0) * 1.28)}px`, background: barTone(s.pct) }} />
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5 min-w-max mt-1.5" dir="ltr">
                {stats.sessions.slice(-40).map((s, i, arr) => (
                  <div key={s.id} className="w-5 text-[9px] text-center text-black/40 tabular-nums whitespace-nowrap">
                    {i === 0 || i === arr.length - 1 || i % 5 === 0 ? fmtDate(s.at) : ""}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="grid lg:grid-cols-2 gap-x-10 gap-y-8">
            {/* ── Hardest questions ─────────────────────────────────── */}
            <section>
              <h2 className="text-lg font-bold mb-1">{ar ? "الأسئلة الأصعب" : "Hardest questions"}</h2>
              <p className="text-sm text-black/50 mb-3">
                {ar ? "الأقل إجابة صحيحة عبر كل الألعاب، ومع كل سؤال الخيار الخاطئ الذي اختاره أغلب الطلاب." : "Lowest share correct across every game, with the wrong answer most students fell for."}
              </p>
              {stats.hardestQuestions.length === 0 ? (
                <p className="text-sm text-black/40 py-6">{ar ? "لا توجد أسئلة بإجابات كافية بعد." : "No question has enough answers yet."}</p>
              ) : (
                <ol className="border-t border-black/15">
                  {stats.hardestQuestions.slice(0, 8).map((q, i) => (
                    <li key={q.id} className="grid grid-cols-[52px_1fr] gap-3 py-3.5 border-b border-black/15">
                      <div className={cn("text-[22px] leading-none font-extrabold tabular-nums pt-0.5", tone(q.pct))}>{q.pct}%</div>
                      <div className="min-w-0">
                        <div className="font-bold leading-snug">{q.text}</div>
                        <div className="text-[12px] text-black/45 mt-1 flex flex-wrap gap-x-2">
                          <span className="font-mono text-[11px] text-black/30">{String(i + 1).padStart(2, "0")}</span>
                          <span>{q.quizTitle}</span>
                          <span>·</span>
                          <span>{q.attempts} {ar ? "إجابة" : "answers"}</span>
                        </div>
                        {q.trap && q.trap.text && (
                          <div className="mt-1.5 text-[13px]">
                            <span className="text-[#b4342f] font-bold">{q.trap.share}%</span>
                            <span className="text-black/60"> {ar ? "اختاروا" : "picked"} </span>
                            <span className="font-bold">“{q.trap.text}”</span>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {/* ── Students ────────────────────────────────────────── */}
            <section>
              <h2 className="text-lg font-bold mb-1">{ar ? "من يحتاج متابعة" : "Who to check on"}</h2>
              <p className="text-sm text-black/50 mb-3">
                {ar
                  ? "الأقل دقة أولاً، عبر كل الألعاب. الطلاب يُعرَّفون بالاسم الذي يكتبونه عند الانضمام، فالاسم المكرر يُجمَع معاً."
                  : "Least accurate first, across every game. Students are matched by the name they type when joining, so a repeated name is folded together."}
              </p>
              {stats.students.length === 0 ? (
                <p className="text-sm text-black/40 py-6">{ar ? "لا يوجد طالب بإجابات كافية بعد." : "No student has enough answers yet."}</p>
              ) : (
                <ul className="border-t border-black/15">
                  {stats.students.slice(0, 8).map(s => (
                    <li key={s.name} className="flex items-center gap-3 py-3 border-b border-black/15">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold truncate">{s.name}</div>
                        <div className="text-[12px] text-black/45">
                          {s.sessions} {ar ? "لعبة" : s.sessions === 1 ? "game" : "games"} · {s.correct}/{s.answers}
                        </div>
                      </div>
                      <div className="w-24 h-2 rounded-full overflow-hidden bg-black/10">
                        <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: barTone(s.pct) }} />
                      </div>
                      <div className={cn("w-12 text-end font-extrabold tabular-nums", tone(s.pct))}>{s.pct}%</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* ── Quizzes ──────────────────────────────────────────────── */}
          {!quizId && stats.perQuiz.length > 0 && (
            <section>
              <h2 className="text-lg font-bold mb-3">{ar ? "اختباراتك" : "Your quizzes"}</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[520px]">
                  <thead>
                    <tr className="border-b-2 border-[hsl(var(--nb-border))] text-[11px] tracking-widest uppercase text-black/45">
                      <th className="py-2 text-start font-bold">{ar ? "الاختبار" : "Quiz"}</th>
                      <th className="py-2 text-end font-bold">{ar ? "استُضيف" : "Hosted"}</th>
                      <th className="py-2 text-end font-bold">{ar ? "طلاب" : "Students"}</th>
                      <th className="py-2 text-end font-bold">{ar ? "إجابات" : "Answers"}</th>
                      <th className="py-2 text-end font-bold">{ar ? "صحيح" : "Correct"}</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.perQuiz.map(q => (
                      <tr key={q.id} className="border-b border-black/15">
                        <td className="py-3 pe-3">
                          <div className="font-bold">{q.title}</div>
                          {q.subject && <div className="text-[12px] text-black/45">{q.subject}</div>}
                        </td>
                        <td className="py-3 text-end tabular-nums">{q.hosted}</td>
                        <td className="py-3 text-end tabular-nums">{q.students}</td>
                        <td className="py-3 text-end tabular-nums">{q.answers}</td>
                        <td className={cn("py-3 text-end tabular-nums font-extrabold", tone(q.pct))}>{q.pct == null ? "—" : `${q.pct}%`}</td>
                        <td className="py-3 ps-3 text-end">
                          <Link to={`/app/host/${q.id}`} aria-label={ar ? "استضافة" : "Host"}
                            className="inline-flex h-8 w-8 rounded-full bg-primary text-white items-center justify-center">
                            <Play className="h-3.5 w-3.5 fill-current" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default Analytics;
