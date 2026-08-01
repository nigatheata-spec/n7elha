import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Trophy, Check, Clock, Users, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const fmt = (n: number) => n.toLocaleString();
const pct = (n: number) => `${n.toFixed(0)}%`;

// ── Letter avatar ────────────────────────────────────────────────────────────
const AV_COLORS = ["#2563eb","#16a34a","#b45309","#dc2626","#7c3aed","#0891b2","#c2410c","#0f766e"];
const av = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return { bg: AV_COLORS[Math.abs(h) % AV_COLORS.length], letter: (name.charAt(0) || "?").toUpperCase() };
};

const Avatar = ({ name, size = "md" }: { name: string; size?: "sm" | "md" | "xl" }) => {
  const { bg, letter } = av(name);
  const cls = size === "xl"
    ? "h-20 w-20 text-3xl"
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
  const nav = useNavigate();

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
      setPhase("cinematic");
    })();
  }, [sessionId]);

  // Auto-advance reveal after 4.8 s
  useEffect(() => {
    if (phase !== "cinematic") return;
    const t = setTimeout(() => setPhase("results"), 4800);
    return () => clearTimeout(t);
  }, [phase]);

  const mode = session?.settings?.mode ?? "crypto_rush";
  // classic mode also scores by accumulated points stored in the `crypto` column
  const isPointsMode = mode === "crypto_rush" || mode === "classic";

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
    return students;
  }, [students, mode]);

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
    const header = ["Rank","Name", mode === "crypto_rush" ? "Crypto" : mode === "classic" ? "Points" : "Status", "Correct","Total","Accuracy%"];
    const rows = ranked.map((s, i) => {
      const a = s.total_answers ? (s.correct_answers / s.total_answers) * 100 : 0;
      const metric = isPointsMode ? String(s.crypto) : (s.eliminated ? "Eliminated" : "Survived");
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
      <div className="theme-game fixed inset-0 bg-background flex items-center justify-center">
        <span className="font-mono text-primary/50 text-sm animate-pulse tracking-widest">LOADING...</span>
      </div>
    );
  }

  // ── Cinematic reveal ────────────────────────────────────────────────────
  if (phase === "cinematic") {
    const second = ranked[1];
    const third  = ranked[2];
    return (
      <div className="theme-game fixed inset-0 overflow-hidden font-mono flex flex-col items-center justify-center"
        style={{ background: "hsl(199 32% 8%)" }}>

        {/* Grid */}
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.07]" />
        {/* Scanlines */}
        <div className="pointer-events-none absolute inset-0 terminal-scanlines opacity-10" />

        {/* GAME OVER label */}
        <div className="absolute top-10 inset-x-0 text-center"
          style={{ animation: "result-fade-in 0.5s 0.3s both" }}>
          <span className="text-[10px] tracking-[0.6em] text-primary/40 uppercase">
            Game Over
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
                1st Place
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
                  <div className="text-[9px] tracking-widest text-primary/30 uppercase">2nd</div>
                  <div className="text-sm font-bold text-primary/65">{second.name}</div>
                </div>
              </div>
            )}
            {second && third && <div className="h-8 w-px bg-primary/15" />}
            {third && (
              <div className="flex items-center gap-2.5">
                <Avatar name={third.name} size="sm" />
                <div>
                  <div className="text-[9px] tracking-widest text-primary/30 uppercase">3rd</div>
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
          Skip
        </button>
      </div>
    );
  }

  // ── Full results ─────────────────────────────────────────────────────────
  return (
    <div className="theme-game min-h-[100dvh] bg-background text-foreground font-mono">
      <div className="pointer-events-none fixed inset-0 bg-grid opacity-[0.06]" />
      <div className="pointer-events-none fixed inset-0 terminal-scanlines opacity-[0.07]" />

      <div className="relative max-w-7xl mx-auto px-4 py-8 space-y-6"
        style={{ animation: "fade-up 0.45s both" }}>

        {/* ── Header ── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => nav("/app")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/50 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] tracking-[0.3em] uppercase transition-all font-bold">
              <ArrowLeft className="h-3 w-3" />Dashboard
            </button>
            <div className="h-4 w-px bg-primary/25" />
            <div>
              <div className="text-[10px] tracking-[0.5em] text-primary/60 uppercase mb-1">Results</div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-primary leading-none">
                {session?.quizzes?.title ?? "Game"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-5 shrink-0">
            <Stat icon={<Clock className="h-3 w-3" />} label="Duration"
              value={`${stats.mm}:${String(stats.ss).padStart(2, "0")}`} />
            <Stat icon={<Users className="h-3 w-3" />} label="Players" value={String(ranked.length)} />
            <Stat icon={<Target className="h-3 w-3" />} label="Accuracy" value={pct(stats.avgAcc)} />
          </div>
        </div>

        {/* ── Podium row ── */}
        {ranked.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-4">
            {/* Winner */}
            {winner && (
              <div className="rounded-2xl border-2 border-primary bg-primary/8 p-7 flex flex-col items-center justify-center text-center gap-4"
                style={{ boxShadow: "0 0 70px -12px hsl(16 100% 66% / 0.22)" }}>
                <div className="text-[10px] tracking-[0.5em] text-primary/70 uppercase flex items-center gap-2">
                  <Trophy className="h-3 w-3 text-amber-400" />
                  Champion
                </div>
                <Avatar name={winner.name} size="xl" />
                <div className="text-2xl md:text-3xl font-black tracking-tight text-primary leading-none">
                  {winner.name}
                </div>
                {isPointsMode ? (
                  <div className="text-3xl md:text-4xl font-black tabular-nums text-primary"
                    style={{ textShadow: "0 0 24px hsl(16 100% 66% / 0.5)" }}>
                    {fmt(winner.crypto)}
                  </div>
                ) : (
                  <div className="text-xs tracking-[0.35em] text-primary/80 uppercase font-bold">Last Standing</div>
                )}
              </div>
            )}

            {/* 2–5 */}
            <div className="flex flex-col gap-2">
              {ranked.slice(1, 6).map((s, idx) => {
                const rank = idx + 2;
                const acc = s.total_answers ? (s.correct_answers / s.total_answers) * 100 : 0;
                return (
                  <div key={s.id}
                    className="rounded-xl border border-primary/30 bg-primary/8 px-4 py-3 flex items-center gap-3"
                    style={{ animation: `fade-up 0.4s ${idx * 70}ms both` }}>
                    <span className="text-primary/60 font-black tabular-nums text-sm w-5 shrink-0">{rank}</span>
                    <Avatar name={s.name} size="sm" />
                    <span className="font-bold text-primary flex-1 truncate min-w-0">{s.name}</span>
                    <span className="text-xs text-primary/65 tabular-nums shrink-0">{pct(acc)}</span>
                    {isPointsMode
                      ? <span className="font-black tabular-nums text-primary text-sm shrink-0">{fmt(s.crypto)}</span>
                      : <span className={cn("text-[10px] font-bold tracking-widest shrink-0",
                          s.eliminated ? "text-destructive/80" : "text-primary/80")}>
                          {s.eliminated ? "OUT" : "ALIVE"}
                        </span>
                    }
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Tabs ── */}
        <div>
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex gap-1 rounded-lg border border-primary/40 bg-primary/5 p-1">
              {(["rank", "qa"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={cn(
                    "px-5 py-2 rounded-md text-[10px] tracking-[0.35em] uppercase font-black transition-all",
                    tab === t
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-primary hover:bg-primary/15"
                  )}>
                  {t === "rank" ? "Leaderboard" : "Questions"}
                </button>
              ))}
            </div>
            <button onClick={exportCsv}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-primary bg-transparent text-primary text-[10px] tracking-widest uppercase font-bold hover:bg-primary/15 transition-all">
              <Download className="h-3.5 w-3.5" />Export
            </button>
          </div>

          {/* Leaderboard */}
          {tab === "rank" && (
            <div className="rounded-xl border border-primary/30 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-primary/25 bg-primary/10">
                    {["#", "Player",
                      isPointsMode ? "Points" : "Status",
                      "Correct", "Accuracy",
                      ...(mode === "crypto_rush" ? ["Hacks"] : [])
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
                        {isPointsMode
                          ? <td className="px-4 py-3 text-center font-black tabular-nums text-primary">{fmt(s.crypto)}</td>
                          : <td className="px-4 py-3 text-center">
                              <span className={cn("text-[10px] font-bold tracking-widest",
                                s.eliminated ? "text-destructive/80" : "text-primary")}>
                                {s.eliminated ? "ELIMINATED" : "CHAMPION"}
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
                <div className="rounded-xl border border-primary/18 py-16 text-center text-primary/30 text-sm">
                  No question data available
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
                    "rounded-xl border p-5",
                    a < 50 ? "border-destructive/50 bg-destructive/8" : "border-primary/30 bg-primary/8"
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
    <div className="flex items-center justify-center gap-1 text-[9px] tracking-widest text-primary/65 uppercase mb-0.5">
      {icon}{label}
    </div>
    <div className="font-black tabular-nums text-primary text-sm">{value}</div>
  </div>
);

export default GameResults;
