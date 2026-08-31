import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Trophy, Check, Clock, Users, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { Seo } from "@/components/Seo";
import { computeCoverage, type CoverageRow, type Stroke } from "@/lib/paintFight";

const fmt = (n: number) => n.toLocaleString();
const pct = (n: number) => `${n.toFixed(0)}%`;

// ── Letter avatar ────────────────────────────────────────────────────────────
const AV_COLORS = ["#2563eb","#16a34a","#b45309","#dc2626","#7c3aed","#0891b2","#c2410c","#0f766e"];
const av = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return { bg: AV_COLORS[Math.abs(h) % AV_COLORS.length], letter: (name.charAt(0) || "?").toUpperCase() };
};

const Avatar = ({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" | "xl" }) => {
  const { bg, letter } = av(name);
  const cls = size === "xl"
    ? "h-20 w-20 text-3xl"
    : size === "lg"
    ? "h-16 w-16 text-2xl"
    : size === "md"
    ? "h-10 w-10 text-base"
    : "h-8 w-8 text-xs";
  return (
    <div style={{ background: bg }}
      className={cn("rounded-full flex items-center justify-center font-black text-white select-none shrink-0 font-mono", cls)}>
      {letter}
    </div>
  );
};

// ── Component ────────────────────────────────────────────────────────────────
const GameResults = () => {
  const { sessionId } = useParams();
  const [session, setSession]     = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [students, setStudents]   = useState<any[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [phase, setPhase]         = useState<"loading" | "cinematic" | "results">("loading");
  const [tab, setTab]             = useState<"rank" | "qa">("rank");
  const [paintCoverage, setPaintCoverage] = useState<CoverageRow[]>([]);
  const nav = useNavigate();
  const { i18n } = useTranslation();

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      const { data: s } = await supabase
        .from("game_sessions").select("*, quizzes(title)").eq("id", sessionId).maybeSingle();
      setSession(s);
      if (s?.quiz_id) {
        const { data: qs } = await supabase.from("questions").select("*").eq("quiz_id", s.quiz_id).order("position");
        setQuestions(qs ?? []);
      }
      const [{ data: ss }, { data: rs }] = await Promise.all([
        supabase.from("game_students").select("*").eq("session_id", sessionId).order("crypto", { ascending: false }),
        supabase.from("question_responses").select("*").eq("session_id", sessionId),
      ]);
      setStudents(ss ?? []);
      setResponses(rs ?? []);
      if (s?.settings?.mode === "paintfight") {
        const { data: strokes } = await supabase.from("paint_fight_strokes")
          .select("student_id,hue,cell_indices").eq("session_id", sessionId).order("created_at", { ascending: true });
        const totalCells = (s.settings.arenaCols ?? 0) * (s.settings.arenaRows ?? 0);
        setPaintCoverage(computeCoverage((strokes ?? []) as Stroke[], totalCells));
      }
      setPhase("cinematic");
    })();
  }, [sessionId]);

  // Auto-advance reveal after 4.8 s
  useEffect(() => {
    if (phase !== "cinematic") return;
    const t = setTimeout(() => setPhase("results"), 4800);
    return () => clearTimeout(t);
  }, [phase]);

  const ar = (session?.settings?.lang ?? i18n.language) === "ar";
  const mode = session?.settings?.mode ?? "crypto_rush";
  // classic and humansvszombies also score by accumulated points stored in the `crypto` column
  const isPointsMode = mode === "crypto_rush" || mode === "classic" || mode === "humansvszombies" || mode === "dontlookdown";
  const hvzWinner = session?.settings?.winner as ("humans" | "zombies" | undefined);

  const ranked = useMemo(() => {
    if (mode === "dodgeball") {
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
    // Don't Look Down ranks by how high they climbed, not cash
    if (mode === "dontlookdown") {
      return [...students].sort((a, b) => (b.height_reached ?? 0) - (a.height_reached ?? 0));
    }
    // Paint Fight ranks by territory %, from the replayed paint log
    if (mode === "paintfight") {
      const pctById = new Map(paintCoverage.map(r => [r.studentId, r.pct]));
      return [...students].sort((a, b) => (pctById.get(b.id) ?? 0) - (pctById.get(a.id) ?? 0));
    }
    return students;
  }, [students, mode, hvzWinner, paintCoverage]);

  const paintPctFor = (studentId: string) => paintCoverage.find(r => r.studentId === studentId)?.pct ?? 0;

  const stats = useMemo(() => {
    const total = responses.length;
    const ok = responses.filter(r => r.is_correct).length;
    const dur = session?.started_at && session?.ended_at
      ? Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000) : 0;
    return {
      avgAcc: total ? (ok / total) * 100 : 0,
      mm: Math.floor(dur / 60), ss: dur % 60,
    };
  }, [responses, session]);

  const winner = ranked[0];

  const exportCsv = () => {
    const header = ar
      ? ["الترتيب","الاسم", mode === "paintfight" ? "المساحة%" : mode === "crypto_rush" ? "العملة" : mode === "classic" ? "النقاط" : "الحالة", "صحيح","الإجمالي","الدقة%"]
      : ["Rank","Name", mode === "paintfight" ? "Territory%" : mode === "crypto_rush" ? "Crypto" : mode === "classic" ? "Points" : "Status", "Correct","Total","Accuracy%"];
    const rows = ranked.map((s, i) => {
      const a = s.total_answers ? (s.correct_answers / s.total_answers) * 100 : 0;
      const metric = mode === "paintfight" ? paintPctFor(s.id).toFixed(0)
        : isPointsMode ? String(s.crypto) : (s.eliminated ? (ar ? "أُقصي" : "Eliminated") : (ar ? "نجا" : "Survived"));
      return [String(i + 1), s.name, metric, String(s.correct_answers), String(s.total_answers), a.toFixed(0)];
    });
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${session?.quizzes?.title || "game"}-results.csv`;
    a.click();
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <span className="text-primary/50 text-sm animate-pulse tracking-widest">{ar ? "جارٍ التحميل..." : "LOADING..."}</span>
      </div>
    );
  }

  // ── Cinematic reveal ────────────────────────────────────────────────────
  if (phase === "cinematic") {
    const second = ranked[1];
    const third  = ranked[2];
    return (
      <div className="fixed inset-0 overflow-hidden flex flex-col items-center justify-center"
        style={{ background: "linear-gradient(135deg, hsl(40 47% 85%) 0%, hsl(40 60% 94%) 100%)" }}>

        {/* Grid */}
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.03]" />

        {/* GAME OVER label */}
        <div className="absolute top-10 inset-x-0 text-center"
          style={{ animation: "result-fade-in 0.5s 0.3s both" }}>
          <span className="text-[10px] tracking-[0.6em] text-primary/40 uppercase">
            {mode === "humansvszombies"
              ? (hvzWinner === "zombies"
                  ? (ar ? "فاز الزومبي — عدوى كاملة" : "Zombies Win — Fully Infected")
                  : (ar ? "فاز البشر — نجوا من الفناء" : "Humans Win — Survived the Apocalypse"))
              : (ar ? "انتهت اللعبة" : "Game Over")}
          </span>
        </div>

        {/* Scan sweep line */}
        <div className="absolute inset-x-0 h-px bg-primary/50 top-1/2"
          style={{ animation: "result-scan 0.9s 0.85s both" }} />

        {/* Winner block — crash in */}
        {winner && (
          <div className="relative z-10 flex flex-col items-center gap-5 px-8 text-center">
            <div style={{ animation: "result-crash-in 0.75s 1.15s cubic-bezier(0.16,1,0.3,1) both" }}>
              <Avatar name={winner.name} size="xl" />
            </div>
            <div style={{ animation: "result-crash-in 0.75s 1.35s cubic-bezier(0.16,1,0.3,1) both" }}>
              <div className="text-[clamp(2.4rem,9vw,6.5rem)] font-black tracking-tighter text-primary leading-none"
                style={{ textShadow: "0 0 100px hsl(16 100% 66% / 0.45)" }}>
                {winner.name}
              </div>
            </div>
            <div style={{ animation: "result-fade-in 0.5s 1.95s both", opacity: 0 }}>
              <span className="text-[10px] tracking-[0.4em] text-primary/45 uppercase">
                {ar ? "المركز الأول" : "1st Place"}
                {session?.quizzes?.title ? ` · ${session.quizzes.title}` : ""}
              </span>
            </div>
          </div>
        )}

        {/* Separator */}
        <div className="absolute bottom-28 inset-x-16 h-px bg-primary/15 origin-left"
          style={{ animation: "result-grow-x 0.5s 2.4s cubic-bezier(0.16,1,0.3,1) both" }} />

        {/* 2nd & 3rd */}
        {(second || third) && (
          <div className="absolute bottom-14 flex items-center gap-10"
            style={{ animation: "fade-up 0.5s 2.8s both", opacity: 0 }}>
            {second && (
              <div className="flex items-center gap-2.5">
                <Avatar name={second.name} size="sm" />
                <div>
                  <div className="text-[9px] tracking-widest text-primary/30 uppercase">{ar ? "الثاني" : "2nd"}</div>
                  <div className="text-sm font-bold text-primary/65">{second.name}</div>
                </div>
              </div>
            )}
            {second && third && <div className="h-8 w-px bg-primary/15" />}
            {third && (
              <div className="flex items-center gap-2.5">
                <Avatar name={third.name} size="sm" />
                <div>
                  <div className="text-[9px] tracking-widest text-primary/30 uppercase">{ar ? "الثالث" : "3rd"}</div>
                  <div className="text-sm font-bold text-primary/65">{third.name}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Skip */}
        <button onClick={() => setPhase("results")}
          className="absolute bottom-5 right-6 text-[10px] tracking-[0.4em] text-primary/25 hover:text-primary/55 transition-colors uppercase"
          style={{ animation: "result-fade-in 0.4s 3.5s both", opacity: 0 }}>
          {ar ? "تخطي" : "Skip"}
        </button>
      </div>
    );
  }

  // ── Full results ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] text-foreground font-sans" style={{ background: "hsl(var(--cream-panel))" }}>
      <Seo
        path={`/app/games/${sessionId}/results`}
        titleAr="نتائج الجلسة"
        titleEn="Session Results"
        descriptionAr="نتائج جلسة اللعب المباشرة."
        descriptionEn="Results for a live game session."
        index={false}
      />
      <div className="pointer-events-none fixed inset-0 bg-grid opacity-[0.06]" />

      <div className="relative max-w-7xl mx-auto px-4 py-8 space-y-6"
        style={{ animation: "fade-up 0.45s both" }}>

        {/* ── Header ── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => nav("/app")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 border-[hsl(var(--nb-border))] bg-white text-primary text-[10px] tracking-[0.3em] uppercase font-bold shadow-[3px_3px_0_0_hsl(var(--nb-border))] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_0_hsl(var(--nb-border))] transition-all">
              <ArrowLeft className="h-3 w-3" />{ar ? "لوحة التحكم" : "Dashboard"}
            </button>
            <div className="h-4 w-px bg-[hsl(var(--nb-border))]/25" />
            <div>
              <div className="text-[10px] tracking-[0.5em] text-[#8FC44A] uppercase mb-1">{ar ? "النتائج" : "Results"}</div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-primary leading-none">
                {session?.quizzes?.title ?? (ar ? "اللعبة" : "Game")}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-5 shrink-0">
            <Stat icon={<Clock className="h-3 w-3" />} label={ar ? "المدة" : "Duration"}
              value={`${stats.mm}:${String(stats.ss).padStart(2, "0")}`} />
            <Stat icon={<Users className="h-3 w-3" />} label={ar ? "اللاعبون" : "Players"} value={String(ranked.length)} />
            <Stat icon={<Target className="h-3 w-3" />} label={ar ? "الدقة" : "Accuracy"} value={pct(stats.avgAcc)} />
          </div>
        </div>

        {/* ── Podium ──────────────────────────────────────────────────────
            First, second and third all get the same card. Previously only the
            winner did and 2nd–5th were thin rows, so a podium finish was
            invisible unless you came first. Ranks 4+ keep the compact rows. */}
        {ranked.length > 0 && (() => {
          const MEDALS = [
            { color: "#D9A441", labelAr: "البطل",  labelEn: "Champion" },
            { color: "#9AA7B4", labelAr: "الثاني", labelEn: "Runner-up" },
            { color: "#B87333", labelAr: "الثالث", labelEn: "Third" },
          ];
          const scoreFor = (s: any) =>
            mode === "paintfight" ? pct(paintPctFor(s.id))
            : isPointsMode       ? fmt(s.crypto)
            : null;

          // A real podium: 3rd on the left, champion raised in the middle, 2nd on
          // the right. The arrangement is spatial rather than reading order, so the
          // row is forced LTR — it must look identical in Arabic and English.
          const PODIUM_STEPS = [
            { rank: 2, height: "sm:min-h-[212px]", avatar: "lg" as const, name: "text-xl md:text-2xl", score: "text-2xl md:text-3xl" },
            { rank: 0, height: "sm:min-h-[272px]", avatar: "xl" as const, name: "text-2xl md:text-3xl", score: "text-3xl md:text-4xl" },
            { rank: 1, height: "sm:min-h-[240px]", avatar: "lg" as const, name: "text-xl md:text-2xl", score: "text-2xl md:text-3xl" },
          ].filter(step => step.rank < ranked.length);

          return (
            <div className="space-y-4">
              <div dir="ltr" className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                {PODIUM_STEPS.map((step, i) => {
                  const s = ranked[step.rank];
                  const m = MEDALS[step.rank];
                  const score = scoreFor(s);
                  return (
                    <div key={s.id} dir={ar ? "rtl" : "ltr"}
                      className={cn(
                        "rounded-2xl border-2 border-[hsl(var(--nb-border))] bg-white px-4 py-5 flex flex-col items-center justify-center text-center gap-2.5 shadow-[5px_5px_0_0_hsl(var(--nb-border))]",
                        step.height,
                      )}
                      style={{ animation: `fade-up 0.45s ${i * 90}ms both` }}>
                      <div className="text-[10px] tracking-[0.35em] text-primary/70 uppercase flex items-center gap-2">
                        <Trophy className="h-3 w-3" style={{ color: m.color }} />
                        {ar ? m.labelAr : m.labelEn}
                      </div>
                      <Avatar name={s.name} size={step.avatar} />
                      <div className={cn("font-black tracking-tight text-primary leading-none truncate max-w-full", step.name)}>
                        {s.name}
                      </div>
                      {score !== null ? (
                        <div className={cn("font-black tabular-nums text-primary leading-none", step.score)}>
                          {score}
                        </div>
                      ) : (
                        <div className={cn("text-xs tracking-[0.35em] uppercase font-bold",
                          s.eliminated ? "text-destructive/80" : "text-primary/80")}>
                          {s.eliminated ? (ar ? "خارج" : "Out") : (ar ? "آخر الناجين" : "Last Standing")}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {ranked.length > 3 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {ranked.slice(3, 9).map((s, idx) => {
                    const rank = idx + 4;
                    const acc = s.total_answers ? (s.correct_answers / s.total_answers) * 100 : 0;
                    return (
                      <div key={s.id}
                        className="rounded-xl border-2 border-[hsl(var(--nb-border))] bg-white px-4 py-3 flex items-center gap-3 shadow-[3px_3px_0_0_hsl(var(--nb-border))]"
                        style={{ animation: `fade-up 0.4s ${idx * 70}ms both` }}>
                        <span className="text-primary/60 font-black tabular-nums text-sm w-5 shrink-0">{rank}</span>
                        <Avatar name={s.name} size="sm" />
                        <span className="font-bold text-primary flex-1 truncate min-w-0">{s.name}</span>
                        <span className="text-xs text-primary/65 tabular-nums shrink-0">{pct(acc)}</span>
                        {scoreFor(s) !== null
                          ? <span className="font-black tabular-nums text-primary text-sm shrink-0">{scoreFor(s)}</span>
                          : <span className={cn("text-[10px] font-bold tracking-widest shrink-0",
                              s.eliminated ? "text-destructive/80" : "text-primary/80")}>
                              {s.eliminated ? (ar ? "خارج" : "OUT") : (ar ? "حي" : "ALIVE")}
                            </span>
                        }
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Tabs ── */}
        <div>
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex gap-2">
              {(["rank", "qa"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={cn(
                    "px-5 py-2 rounded-lg text-[10px] tracking-[0.35em] uppercase font-bold transition-all border-2",
                    tab === t
                      ? "bg-white text-primary border-[hsl(var(--nb-border))] shadow-[3px_3px_0_0_hsl(var(--nb-border))]"
                      : "bg-transparent text-primary/70 border-[hsl(var(--nb-border))]/25 hover:bg-primary/10 hover:text-primary"
                  )}>
                  {t === "rank" ? (ar ? "لوحة الصدارة" : "Leaderboard") : (ar ? "الأسئلة" : "Questions")}
                </button>
              ))}
            </div>
            <button onClick={exportCsv}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 border-[hsl(var(--nb-border))] bg-white text-primary text-[10px] tracking-widest uppercase font-bold shadow-[3px_3px_0_0_hsl(var(--nb-border))] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_0_hsl(var(--nb-border))] transition-all">
              <Download className="h-3.5 w-3.5" />{ar ? "تصدير" : "Export"}
            </button>
          </div>

          {/* Leaderboard */}
          {tab === "rank" && (
            <div className="rounded-xl border-2 border-[hsl(var(--nb-border))] bg-white overflow-hidden shadow-[4px_4px_0_0_rgba(0,0,0,0.35)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-primary/25 bg-primary/10">
                    {[ar ? "#" : "#", ar ? "اللاعب" : "Player",
                      mode === "paintfight" ? (ar ? "المساحة" : "Territory")
                        : isPointsMode ? (ar ? "النقاط" : "Points") : (ar ? "الحالة" : "Status"),
                      ar ? "صحيح" : "Correct", ar ? "الدقة" : "Accuracy",
                      ...(mode === "crypto_rush" ? [ar ? "الاختراقات" : "Hacks"] : []),
                      ...(mode === "humansvszombies" ? [ar ? "الفريق" : "Team"] : []),
                      ...(mode === "dontlookdown" ? [ar ? "الارتفاع" : "Height"] : []),
                    ].map(h => (
                      <th key={h} className="px-4 py-3 text-[10px] tracking-widest text-primary/70 text-start first:text-start text-center first-of-type:text-start font-bold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((s, i) => {
                    const acc = s.total_answers ? (s.correct_answers / s.total_answers) * 100 : 0;
                    return (
                      <tr key={s.id}
                        className={cn("border-t border-primary/15 transition-colors hover:bg-primary/8",
                          i === 0 && "bg-primary/12")}>
                        <td className="px-4 py-3 font-bold text-primary/60 tabular-nums">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={s.name} size="sm" />
                            <span className={cn("font-bold truncate max-w-[140px]",
                              i === 0 ? "text-primary" : "text-foreground")}>{s.name}</span>
                            {i === 0 && <Trophy className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                          </div>
                        </td>
                        {mode === "paintfight"
                          ? <td className="px-4 py-3 text-center font-black tabular-nums text-primary">{pct(paintPctFor(s.id))}</td>
                          : isPointsMode
                          ? <td className="px-4 py-3 text-center font-black tabular-nums text-primary">{fmt(s.crypto)}</td>
                          : <td className="px-4 py-3 text-center">
                              <span className={cn("text-[10px] font-bold tracking-widest",
                                s.eliminated ? "text-destructive/80" : "text-primary")}>
                                {s.eliminated ? (ar ? "أُقصي" : "ELIMINATED") : (ar ? "بطل" : "CHAMPION")}
                              </span>
                            </td>
                        }
                        <td className="px-4 py-3 text-center tabular-nums text-foreground/80">
                          {s.correct_answers ?? 0}/{s.total_answers ?? 0}
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums text-foreground/80">{pct(acc)}</td>
                        {mode === "crypto_rush" &&
                          <td className="px-4 py-3 text-center text-primary/60 text-xs">
                            {s.hacks_made ?? 0}/{s.hacks_received ?? 0}
                          </td>
                        }
                        {mode === "humansvszombies" &&
                          <td className="px-4 py-3 text-center">
                            <span className={cn("text-[10px] font-bold tracking-widest uppercase",
                              s.team === "zombie" ? "text-emerald-600" : "text-blue-600")}>
                              {s.team === "zombie" ? (ar ? "زومبي" : "zombie")
                                : s.team === "human" ? (ar ? "بشر" : "human")
                                : "—"}
                            </span>
                          </td>
                        }
                        {mode === "dontlookdown" &&
                          <td className="px-4 py-3 text-center font-black tabular-nums text-primary">
                            {s.height_reached ?? 0}m
                          </td>
                        }
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Questions */}
          {tab === "qa" && (
            <div className="space-y-3">
              {questions.length === 0 && (
                <div className="rounded-xl border-2 border-[hsl(var(--nb-border))]/20 py-16 text-center text-primary/45 text-sm">
                  {ar ? "لا توجد بيانات أسئلة متاحة" : "No question data available"}
                </div>
              )}
              {questions.map((q, idx) => {
                const rs = responses.filter(r => r.question_index === idx);
                const correct = rs.filter(r => r.is_correct).length;
                const a = rs.length ? (correct / rs.length) * 100 : 0;
                const dist = [0, 0, 0, 0];
                rs.forEach(r => { if (r.answer_index < 4) dist[r.answer_index]++; });
                return (
                  <div key={q.id} className={cn(
                    "rounded-xl border-2 p-5 shadow-[4px_4px_0_0_rgba(0,0,0,0.35)]",
                    a < 50 ? "border-destructive/60 bg-[#FDECEC]" : "border-[hsl(var(--nb-border))] bg-white"
                  )}>
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <p className="text-sm font-bold text-foreground leading-relaxed">{idx + 1}. {q.text}</p>
                      <div className={cn("text-xl font-black tabular-nums shrink-0", a < 50 ? "text-destructive" : "text-primary")}>
                        {pct(a)}
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      {q.options.map((o: string, i: number) => {
                        const c = dist[i];
                        const p = rs.length ? (c / rs.length) * 100 : 0;
                        const isC = i === q.correct_index;
                        return (
                          <div key={i}>
                            <div className="flex items-center justify-between text-xs mb-1 gap-2">
                              <span className={cn("flex items-center gap-1.5 truncate",
                                isC ? "text-primary font-bold" : "text-foreground/65")}>
                                {isC && <Check className="h-3 w-3 shrink-0" />}
                                {String.fromCharCode(65 + i)}. {o}
                              </span>
                              <span className="font-mono text-foreground/60 shrink-0 tabular-nums">
                                {c} ({pct(p)})
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-primary/15 overflow-hidden">
                              <div className={cn("h-full rounded-full", isC ? "bg-primary" : "bg-primary/40")}
                                style={{ width: `${p}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

// ── Tiny stat chip ────────────────────────────────────────────────────────────
const Stat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="text-center">
    <div className="flex items-center justify-center gap-1 text-[9px] tracking-widest text-primary/60 uppercase mb-0.5">
      {icon}{label}
    </div>
    <div className="font-black tabular-nums text-primary text-sm">{value}</div>
  </div>
);

export default GameResults;
