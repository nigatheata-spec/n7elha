import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BarChart3, ChevronDown, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { MODE_LABEL } from "@/lib/modeLabels";
import { QuietAccents } from "@/components/teacher/DashboardAccents";
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

// Accuracy reads as a status (good / needs a look / struggling). Numbers stay
// in ink; the color rides a small meter beside them, never the text.
const STATUS = { good: "#5E9E2A", warn: "#D9962B", bad: "#C94A3F", none: "#C9C2B2" };
const statusColor = (pct: number | null) =>
  pct == null ? STATUS.none : pct >= 75 ? STATUS.good : pct >= 50 ? STATUS.warn : STATUS.bad;

const INK = "#1F3439";
const PANEL = "rounded-2xl bg-white border-2 border-[hsl(var(--nb-border))] shadow-[4px_4px_0_0_hsl(var(--nb-border))]";

const Meter = ({ pct, className }: { pct: number | null; className?: string }) => (
  <div className={cn("h-1.5 rounded-full overflow-hidden", className)} style={{ background: "#EEE8DC" }}>
    <div className="h-full rounded-full" style={{ width: `${pct ?? 0}%`, background: statusColor(pct) }} />
  </div>
);

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
    new Date(iso).toLocaleDateString(ar ? "ar-EG-u-nu-latn" : "en-GB", { day: "numeric", month: "short" });
  const fmtNum = (n: number) => n.toLocaleString("en-US");

  // Games nobody answered in (a lobby closed early, a test run) say nothing
  // about learning, so the chart leaves them out.
  const points = useMemo(() => (stats ? stats.sessions.filter(s => s.pct != null).slice(-40) : []), [stats]);
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));

  return (
    <div className="relative isolate min-h-[calc(100dvh-2rem)] md:min-h-[calc(100dvh-4rem)]">
      <QuietAccents />
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className={cn(PANEL, "px-5 py-4 flex items-center justify-between gap-3 flex-wrap")}>
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
          {/* ── Headline: accuracy leads, the three counts sit beside it ── */}
          <div className={cn(PANEL, "md:flex")}>
            <div className="md:w-[34%] p-5 md:p-6 border-b-2 md:border-b-0 md:border-e-2 border-[hsl(var(--nb-border))]">
              <div className="text-sm font-semibold text-black/55">{ar ? "الإجابات الصحيحة" : "Answered correctly"}</div>
              <div className="mt-2 text-[52px] leading-none font-extrabold" style={{ color: INK }}>
                {stats.totals.pct == null ? "—" : `${stats.totals.pct}%`}
              </div>
              <Meter pct={stats.totals.pct} className="mt-4" />
            </div>
            <div className="flex-1 grid grid-cols-3">
            {[
              { n: stats.totals.sessions, label: ar ? "لعبة" : "Games played" },
              { n: stats.totals.students, label: ar ? "مشاركة طالب" : "Student plays" },
              { n: stats.totals.answers, label: ar ? "إجابة" : "Answers" },
            ].map((s, i) => (
              <div key={i} className={cn("p-4 md:p-6 flex flex-col justify-end", i > 0 && "border-s border-black/10")}>
                <div className="text-[24px] md:text-[30px] leading-none font-bold" style={{ color: INK }}>{fmtNum(s.n)}</div>
                <div className="mt-2 text-[13px] md:text-sm text-black/55">{s.label}</div>
              </div>
            ))}
            </div>
          </div>

          {/* ── Over time: one column per game, on a 0-100% scale ──────── */}
          {points.length > 0 && (
            <section className={cn(PANEL, "p-5 md:p-6")}>
              <div className="flex items-end justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-lg font-bold">{ar ? "عبر الزمن" : "Over time"}</h2>
                  <p className="text-sm text-black/50 mt-0.5">
                    {ar ? "نسبة الإجابات الصحيحة في كل لعبة، الأقدم أولاً." : "Share answered correctly in each game, oldest first."}
                  </p>
                </div>
                {stats.totals.pct != null && (
                  <div className="text-sm text-black/55 flex items-center gap-2">
                    <span className="inline-block w-5 h-0 border-t-2" style={{ borderColor: INK }} />
                    {ar ? "المتوسط" : "Average"} <bdi dir="ltr" className="font-bold text-black/70">{stats.totals.pct}%</bdi>
                  </div>
                )}
              </div>

              <div className="mt-5 flex gap-2" dir="ltr">
                {/* y-axis */}
                <div className="relative h-48 w-9 shrink-0 text-[11px] text-black/40 tabular-nums">
                  {[100, 75, 50, 25, 0].map(v => (
                    <span key={v} className="absolute end-1 -translate-y-1/2" style={{ top: `${100 - v}%` }}>{v}%</span>
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="relative h-48">
                    {[100, 75, 50, 25, 0].map(v => (
                      <div key={v} className="absolute inset-x-0 h-px" style={{ top: `${100 - v}%`, background: v === 0 ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.07)" }} />
                    ))}
                    {stats.totals.pct != null && (
                      <div className="absolute inset-x-0 border-t-2 z-[1] pointer-events-none" style={{ bottom: `${stats.totals.pct}%`, borderColor: `${INK}99` }} />
                    )}
                    <div className="absolute inset-0 flex items-end gap-[3px]">
                      {points.map(s => (
                        <div key={s.id} className="group relative flex-1 max-w-[24px] h-full flex items-end">
                          <div className="w-full rounded-t-[4px] bg-[#3F7F86] group-hover:bg-[#2C5F65] transition-colors"
                            style={{ height: `${Math.max(1.5, s.pct ?? 0)}%` }} />
                          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 whitespace-nowrap rounded-xl bg-[#1F3439] text-white text-[12px] px-3 py-2 shadow-lg" dir={ar ? "rtl" : "ltr"}>
                            <div className="font-bold">{s.quizTitle || "—"}</div>
                            <div className="opacity-80 mt-0.5">
                              {fmtDate(s.at)} · {MODE_LABEL[s.mode]?.[ar ? "ar" : "en"] ?? s.mode} · {s.students} {ar ? "طالب" : "students"}
                            </div>
                            <div className="mt-1 text-[15px] font-extrabold">{s.pct}%</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-[3px] mt-2">
                    {points.map((s, i) => (
                      <div key={s.id} className="relative flex-1 max-w-[24px] h-4">
                        {/* the last date hangs from the right edge; a regular one too close to it is skipped */}
                        {i === points.length - 1 ? (
                          <span className="absolute right-0 text-[11px] text-black/45 whitespace-nowrap">{fmtDate(s.at)}</span>
                        ) : i % labelEvery === 0 && points.length - 1 - i > labelEvery * 0.8 ? (
                          <span className="absolute left-0 text-[11px] text-black/45 whitespace-nowrap">{fmtDate(s.at)}</span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          <div className="grid lg:grid-cols-2 gap-6">
            {/* ── Hardest questions ─────────────────────────────────── */}
            <section className={cn(PANEL, "p-5 md:p-6")}>
              <h2 className="text-lg font-bold">{ar ? "الأسئلة الأصعب" : "Hardest questions"}</h2>
              <p className="text-sm text-black/50 mt-0.5 mb-3">
                {ar ? "الأقل إجابة صحيحة، ومعها الخيار الخاطئ الأكثر اختياراً." : "Lowest share correct, with the wrong answer most students picked."}
              </p>
              {stats.hardestQuestions.length === 0 ? (
                <p className="text-sm text-black/40 py-6">{ar ? "لا توجد أسئلة بإجابات كافية بعد." : "No question has enough answers yet."}</p>
              ) : (
                <ol className="divide-y divide-black/[0.08]">
                  {stats.hardestQuestions.slice(0, 6).map(q => (
                    <li key={q.id} className="py-3.5 flex gap-4">
                      <div className="w-14 shrink-0">
                        <div className="text-xl font-extrabold leading-none" style={{ color: INK }}>{q.pct}%</div>
                        <Meter pct={q.pct} className="mt-2" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold leading-snug">{q.text}</div>
                        <div className="text-[12px] text-black/45 mt-1 truncate">
                          {q.quizTitle} · {q.attempts} {ar ? "إجابة" : "answers"}
                        </div>
                        {q.trap && q.trap.text && (
                          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px]" style={{ background: "#F7E4E1" }}>
                            <span className="font-bold" style={{ color: "#8E2F27" }}>{q.trap.share}%</span>
                            <span className="text-black/60">{ar ? "اختاروا" : "picked"}</span>
                            <span className="font-bold text-black/80 truncate max-w-[14rem]">{q.trap.text}</span>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {/* ── Students ────────────────────────────────────────── */}
            <section className={cn(PANEL, "p-5 md:p-6")}>
              <h2 className="text-lg font-bold">{ar ? "من يحتاج متابعة" : "Who to check on"}</h2>
              <p className="text-sm text-black/50 mt-0.5 mb-3">
                {ar
                  ? "الأقل دقة أولاً. يُعرَّف الطالب بالاسم الذي يكتبه، فالاسم المكرر يُجمَع معاً."
                  : "Least accurate first. Students are matched by the name they type, so a repeated name is folded together."}
              </p>
              {stats.students.length === 0 ? (
                <p className="text-sm text-black/40 py-6">{ar ? "لا يوجد طالب بإجابات كافية بعد." : "No student has enough answers yet."}</p>
              ) : (
                <ul className="divide-y divide-black/[0.08]">
                  {stats.students.slice(0, 8).map(s => (
                    <li key={s.name} className="flex items-center gap-3 py-3">
                      <div className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: "#3F5A63" }}>
                        {s.name.trim().charAt(0).toUpperCase() || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold truncate">{s.name}</div>
                        <div className="text-[12px] text-black/45">
                          {s.sessions} {ar ? "لعبة" : s.sessions === 1 ? "game" : "games"} · {s.correct}/{s.answers} {ar ? "صحيحة" : "right"}
                        </div>
                      </div>
                      <Meter pct={s.pct} className="w-20 hidden sm:block" />
                      <div className="w-12 text-end font-extrabold tabular-nums" style={{ color: INK }}>{s.pct}%</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* ── Quizzes ──────────────────────────────────────────────── */}
          {!quizId && stats.perQuiz.length > 0 && (
            <section className={cn(PANEL, "p-5 md:p-6")}>
              <h2 className="text-lg font-bold mb-3">{ar ? "اختباراتك" : "Your quizzes"}</h2>
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm min-w-[420px]">
                  <thead>
                    <tr className="text-[12px] text-black/45 border-b border-black/10">
                      <th className="py-2 px-1 text-start font-semibold">{ar ? "الاختبار" : "Quiz"}</th>
                      <th className="py-2 px-3 w-20 text-center font-semibold">{ar ? "مرات اللعب" : "Hosted"}</th>
                      <th className="hidden lg:table-cell py-2 px-3 w-20 text-center font-semibold">{ar ? "طلاب" : "Students"}</th>
                      <th className="hidden lg:table-cell py-2 px-3 w-20 text-center font-semibold">{ar ? "إجابات" : "Answers"}</th>
                      <th className="py-2 px-3 w-36 text-start font-semibold">{ar ? "صحيح" : "Correct"}</th>
                      <th className="py-2 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.06]">
                    {stats.perQuiz.map(q => (
                      <tr key={q.id} className="hover:bg-black/[0.02]">
                        <td className="py-3 px-1">
                          <div className="font-bold leading-snug">{q.title}</div>
                          {q.subject && <div className="text-[12px] text-black/45">{q.subject}</div>}
                        </td>
                        <td className="py-3 px-3 text-center tabular-nums">{q.hosted}</td>
                        <td className="hidden lg:table-cell py-3 px-3 text-center tabular-nums">{q.students}</td>
                        <td className="hidden lg:table-cell py-3 px-3 text-center tabular-nums">{q.answers}</td>
                        <td className="py-3 px-3">
                          {q.pct == null ? <span className="text-black/35">—</span> : (
                            <div className="flex items-center gap-2">
                              <span className="w-10 font-extrabold tabular-nums" style={{ color: INK }}>{q.pct}%</span>
                              <Meter pct={q.pct} className="flex-1" />
                            </div>
                          )}
                        </td>
                        <td className="py-3 text-end">
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
    </div>
  );
};

export default Analytics;
