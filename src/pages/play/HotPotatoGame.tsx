import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Trophy, Zap, Check, X as XIcon } from "lucide-react";

type Q = { id: string; text: string; options: string[]; correct_index: number; image_url?: string };
type Phase = "waiting" | "question" | "answered" | "passing" | "exploded" | "done";

const POINTS_PER_CORRECT = 100;
const PASS_SECONDS = 5;

const AV_COLORS = ["#2563eb","#16a34a","#b45309","#dc2626","#7c3aed","#0891b2","#c2410c","#0f766e"];
const av = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return { bg: AV_COLORS[Math.abs(h) % AV_COLORS.length], letter: (name.charAt(0) || "?").toUpperCase() };
};
const Avatar = ({ name, size = "md" }: { name: string; size?: "sm" | "md" | "xl" }) => {
  const { bg, letter } = av(name);
  const cls = size === "xl" ? "h-20 w-20 text-3xl" : size === "md" ? "h-10 w-10 text-base" : "h-8 w-8 text-xs";
  return (
    <div style={{ background: bg }}
      className={cn("rounded-full flex items-center justify-center font-black text-white select-none shrink-0", cls)}>
      {letter}
    </div>
  );
};

// Bomb SVG icon (no emojis)
const BombIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="15" cy="19" r="10" fill="currentColor" opacity="0.9" />
    <rect x="14" y="7" width="2.5" height="6" rx="1.2" fill="currentColor" />
    <path d="M20 4 L24 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="24" cy="4" r="2.5" fill="#ff8c00" />
    <circle cx="11" cy="15" r="2.5" fill="white" opacity="0.25" />
  </svg>
);

interface Props { sessionId: string; studentId: string; }

const HotPotatoGame = ({ sessionId, studentId }: Props) => {
  const navigate = useNavigate();
  const [session, setSession]       = useState<any>(null);
  const [questions, setQuestions]   = useState<Q[]>([]);
  const [students, setStudents]     = useState<any[]>([]);
  const [me, setMe]                 = useState<any>(null);
  const [phase, setPhase]           = useState<Phase>("waiting");
  const [currentQ, setCurrentQ]     = useState<Q | null>(null);
  const [picked, setPicked]         = useState<number | null>(null);
  const [timeLeft, setTimeLeft]     = useState(20);
  const [qSeed, setQSeed]           = useState(0);
  const [passTargets, setPassTargets] = useState<any[]>([]);
  const [passSecsLeft, setPassSecsLeft] = useState(PASS_SECONDS);
  const [now, setNow] = useState(Date.now());
  const [showFlash, setShowFlash] = useState(false);

  const qStartRef    = useRef(Date.now());
  const askedRef     = useRef(0);
  const pickedRef    = useRef<number | null>(null);
  const passedRef    = useRef(false);
  const studentsRef  = useRef<any[]>([]);
  studentsRef.current = students;
  const lastExplosionAtRef = useRef<string | null>(null);
  const passTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const settings        = session?.settings ?? {};
  const hasBomb         = settings.bombHolderId === studentId;
  const bombExplodesAt  = settings.bombExplodesAt as string | null;
  const fuseMs          = bombExplodesAt ? Math.max(0, new Date(bombExplodesAt).getTime() - now) : 0;
  const fusePct         = bombExplodesAt ? Math.min(100, (fuseMs / 90_000) * 100) : 100;
  const fuseColor       = fuseMs > 30_000 ? "hsl(45 100% 55%)" : fuseMs > 12_000 ? "hsl(25 100% 55%)" : "hsl(0 100% 55%)";
  const bombHolder = useMemo(() => students.find(s => s.id === settings.bombHolderId), [students, settings.bombHolderId]);

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from("game_sessions").select("*, quizzes(id,title)").eq("id", sessionId).maybeSingle();
      setSession(s);
      if (s?.quiz_id) {
        const { data: qs } = await supabase.from("questions").select("*").eq("quiz_id", s.quiz_id).order("position");
        setQuestions((qs ?? []).map((q: any) => ({ ...q, options: Array.isArray(q.options) ? q.options : [] })));
      }
      const { data: ss } = await supabase.from("game_students").select("*").eq("session_id", sessionId).order("crypto", { ascending: false });
      setStudents(ss ?? []);
      setMe((ss ?? []).find((x: any) => x.id === studentId) ?? null);
    })();
  }, [sessionId, studentId]);

  // ── Now ticker (for fuse bar) ────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel(`hp-game-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_sessions", filter: `id=eq.${sessionId}` },
        (p: any) => setSession((prev: any) => ({ ...prev, ...p.new })))
      .on("postgres_changes", { event: "*", schema: "public", table: "game_students", filter: `session_id=eq.${sessionId}` },
        async () => {
          const { data: ss } = await supabase.from("game_students").select("*").eq("session_id", sessionId).order("crypto", { ascending: false });
          setStudents(ss ?? []);
          const m = (ss ?? []).find((x: any) => x.id === studentId);
          if (m) setMe(m);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, studentId]);

  // ── Session status sync ───────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    if (session.status === "lobby")      setPhase("waiting");
    else if (session.status === "finished") setPhase("done");
    else if (session.status === "running")
      setPhase(prev => prev === "waiting" ? "question" : prev);
  }, [session?.status]);

  // ── Explosion detection ───────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    const lastAt  = settings.lastExplosionAt;
    const victimId = settings.lastExplosionVictimId;
    if (lastAt && lastAt !== lastExplosionAtRef.current) {
      lastExplosionAtRef.current = lastAt;
      if (victimId === studentId) {
        setPhase("exploded");
      }
    }
  }, [settings.lastExplosionAt, settings.lastExplosionVictimId]);

  // ── Auto-advance after exploded + trigger flash ───────────────────────────
  useEffect(() => {
    if (phase !== "exploded") return;
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 800);
    const t = setTimeout(() => { setQSeed(s => s + 1); setPhase("question"); }, 2200);
    return () => clearTimeout(t);
  }, [phase]);

  // ── Pick question ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "question" || questions.length === 0) return;
    const next = questions[Math.floor(Math.random() * questions.length)];
    setCurrentQ(next);
    setPicked(null);
    pickedRef.current = null;
    askedRef.current += 1;
    qStartRef.current = Date.now();
  }, [phase, qSeed, questions.length]);

  // ── Question countdown ────────────────────────────────────────────────────
  const duration = settings.timePerQ ?? 20;
  useEffect(() => {
    if (phase !== "question" || !currentQ) return;
    const t = setInterval(() => {
      const elapsed = (Date.now() - qStartRef.current) / 1000;
      const left = Math.max(0, Math.ceil(duration - elapsed));
      setTimeLeft(left);
      if (left <= 0 && pickedRef.current === null) { clearInterval(t); handleAnswer(-1); }
    }, 200);
    return () => clearInterval(t);
  }, [phase, currentQ, duration]);

  // ── Auto-advance after answered ───────────────────────────────────────────
  useEffect(() => {
    if (phase !== "answered") return;
    const t = setTimeout(() => { setQSeed(s => s + 1); setPhase("question"); }, 1500);
    return () => clearTimeout(t);
  }, [phase]);

  // ── Pass countdown ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "passing") return;
    setPassSecsLeft(PASS_SECONDS);
    passedRef.current = false;
    if (passTimerRef.current) clearInterval(passTimerRef.current);
    passTimerRef.current = setInterval(() => {
      setPassSecsLeft(prev => {
        if (prev <= 1) {
          clearInterval(passTimerRef.current!);
          // timeout: bomb stays, move to next question
          if (!passedRef.current) {
            passedRef.current = true;
            setTimeout(() => { setQSeed(s => s + 1); setPhase("question"); }, 200);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (passTimerRef.current) clearInterval(passTimerRef.current); };
  }, [phase]);

  // ── Answer handler ────────────────────────────────────────────────────────
  const handleAnswer = useCallback((idx: number) => {
    if (!currentQ || !me) return;
    if (pickedRef.current !== null) return;
    pickedRef.current = idx;

    const correct = idx === currentQ.correct_index;
    setPicked(idx);

    if (correct) {
      // Award points fire-and-forget
      supabase.from("game_students").update({
        crypto: (me.crypto ?? 0) + POINTS_PER_CORRECT,
        correct_answers: (me.correct_answers ?? 0) + 1,
        total_answers: (me.total_answers ?? 0) + 1,
      }).eq("id", me.id).then(undefined, () => {});

      if (hasBomb) {
        // Pick 3 random pass targets
        const others = studentsRef.current.filter((s: any) => s.id !== studentId);
        const shuffled = [...others].sort(() => Math.random() - 0.5).slice(0, 3);
        setPassTargets(shuffled);
        setTimeout(() => setPhase("passing"), 600);
      } else {
        setTimeout(() => setPhase("answered"), 700);
      }
    } else {
      supabase.from("game_students").update({
        total_answers: (me.total_answers ?? 0) + 1,
      }).eq("id", me.id).then(undefined, () => {});
      setTimeout(() => setPhase("answered"), 700);
    }

    supabase.from("question_responses").insert({
      session_id: sessionId, student_id: me.id, question_id: currentQ.id,
      question_index: askedRef.current, answer_index: idx, is_correct: correct,
    }).then(undefined, () => {});
  }, [currentQ, me, hasBomb, studentId, sessionId]);

  const submit = (idx: number) => { if (pickedRef.current !== null) return; handleAnswer(idx); };

  const passBomb = async (targetId: string) => {
    if (passedRef.current) return;
    passedRef.current = true;
    if (passTimerRef.current) clearInterval(passTimerRef.current);
    // Fetch fresh settings to avoid stale spread (session may have updated since render)
    const { data: fresh } = await supabase.from("game_sessions")
      .select("settings").eq("id", sessionId).single();
    const live = fresh?.settings ?? settings;
    supabase.from("game_sessions").update({ settings: { ...live, bombHolderId: targetId } })
      .eq("id", sessionId).then(undefined, () => {});
    setTimeout(() => { setQSeed(s => s + 1); setPhase("question"); }, 300);
  };

  const fmt = (n: number) => n.toLocaleString();
  const points = me?.crypto ?? 0;

  // Danger vignette: deepens as fuse burns when holding bomb
  const dangerAlpha = hasBomb ? ((1 - fusePct / 100) * 0.6).toFixed(2) : "0";
  const dangerSpread = hasBomb ? 60 + (1 - fusePct / 100) * 100 : 0;

  return (
    <div className={cn(
      "theme-hotpotato min-h-[100dvh] bg-background text-foreground font-mono flex flex-col overflow-hidden",
      hasBomb && fuseMs < 5_000 && "animate-screen-shake"
    )}
      style={{
        background: "radial-gradient(ellipse at 40% 0%, hsl(15 80% 10%) 0%, hsl(0 0% 6%) 100%)",
        boxShadow: hasBomb ? `inset 0 0 ${dangerSpread}px hsl(0 100% 40% / ${dangerAlpha})` : "none",
      }}>
      <div className="pointer-events-none fixed inset-0 opacity-10"
        style={{ backgroundImage: "repeating-linear-gradient(0deg,hsl(0 0% 0%/0.5) 0px,hsl(0 0% 0%/0.5) 1px,transparent 1px,transparent 4px)" }} />

      {/* Explosion flash + shockwave overlay */}
      {showFlash && (
        <>
          <div className="pointer-events-none fixed inset-0 z-50 animate-screen-flash"
            style={{ background: "radial-gradient(ellipse at center, hsl(25 100% 70%) 0%, hsl(0 100% 50%) 60%, transparent 100%)" }} />
          <div className="pointer-events-none fixed z-[51] rounded-full animate-shockwave"
            style={{ top: "50%", left: "50%", width: 80, height: 80,
              transform: "translate(-50%,-50%)",
              border: "3px solid hsl(25 100% 70%)" }} />
        </>
      )}

      {/* Header */}
      <header className={cn(
        "relative flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-background/80 backdrop-blur-sm z-10 transition-all",
        hasBomb ? "border-primary/80 animate-hp-bomb-pulse" : "border-primary/25"
      )}>
        <div className="flex items-center gap-2 min-w-0">
          {hasBomb && <BombIcon className="h-6 w-6 text-primary shrink-0" />}
          <span className="text-sm font-bold truncate text-primary">{me?.name ?? "—"}</span>
        </div>
        <div className="flex items-center gap-1.5 text-success font-black tabular-nums text-lg">
          <Zap className="h-4 w-4 text-success" />
          {fmt(points)}
        </div>
      </header>

      <main className="relative flex-1 px-4 pb-6 flex flex-col">

        {/* WAITING */}
        {phase === "waiting" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
            <Avatar name={me?.name ?? "?"} size="xl" />
            <div className="text-xl text-primary animate-pulse">{"> بانتظار المعلّم..."}</div>
            <p className="text-muted-foreground text-sm">{students.length} لاعب متصل</p>
          </div>
        )}

        {/* DONE */}
        {phase === "done" && (() => {
          const sorted = [...students].sort((a, b) => (b.crypto ?? 0) - (a.crypto ?? 0));
          const rank   = sorted.findIndex(s => s.id === studentId) + 1 || sorted.length;
          const medalC = rank === 1 ? "hsl(45 100% 55%)" : rank === 2 ? "hsl(210 20% 72%)" : rank === 3 ? "hsl(25 80% 52%)" : "hsl(0 0% 55%)";
          const top5   = sorted.slice(0, 5);
          const rankLabel = (n: number) => { const s = ["th","st","nd","rd"], v = n%100; return n+(s[(v-20)%10]||s[v]||s[0]); };

          return (
            <div className="flex-1 flex flex-col items-center pt-6 pb-4 px-4 gap-5 overflow-y-auto">

              {/* Rank crash-in */}
              <div style={{ animation: "result-crash-in 0.55s cubic-bezier(0.34,1.4,0.64,1) both" }} className="text-center">
                <div className="text-[80px] leading-none font-black tabular-nums"
                  style={{ color: medalC, textShadow: `0 0 50px ${medalC}cc, 0 0 100px ${medalC}55` }}>
                  #{rank}
                </div>
                <div className="text-sm font-mono tracking-widest mt-1" style={{ color: medalC }}>
                  {rankLabel(rank)} place
                </div>
              </div>

              {/* Score */}
              <div className="animate-fade-up text-center" style={{ animationDelay: "0.15s" }}>
                <div className="text-4xl font-black tabular-nums text-success"
                  style={{ textShadow: "0 0 20px hsl(120 100% 55% / 0.5)" }}>
                  {fmt(points)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 tracking-widest">نقطة</div>
              </div>

              {/* Divider */}
              <div className="w-full max-w-xs h-px bg-primary/20 animate-fade-up" style={{ animationDelay: "0.25s" }} />

              {/* Leaderboard */}
              <div className="w-full max-w-xs space-y-1.5 animate-fade-up" style={{ animationDelay: "0.3s" }}>
                {top5.map((s, i) => {
                  const isMe = s.id === studentId;
                  const mc   = i === 0 ? "hsl(45 100% 55%)" : i === 1 ? "hsl(210 20% 72%)" : i === 2 ? "hsl(25 80% 52%)" : "hsl(0 0% 50%)";
                  return (
                    <div key={s.id} className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all",
                      isMe ? "border-primary/70 bg-primary/12" : "border-white/8 bg-white/4"
                    )}>
                      <span className="font-mono text-sm font-black w-5 text-center shrink-0" style={{ color: mc }}>
                        {i + 1}
                      </span>
                      <span className={cn("flex-1 text-sm font-bold truncate", isMe ? "text-primary" : "text-foreground/80")}>
                        {s.name}
                      </span>
                      <span className="font-mono text-sm tabular-nums text-muted-foreground">{fmt(s.crypto ?? 0)}</span>
                    </div>
                  );
                })}

                {/* Show student row if outside top 5 */}
                {rank > 5 && (
                  <>
                    <div className="text-center text-muted-foreground/40 text-xs py-0.5">···</div>
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-primary/70 bg-primary/12">
                      <span className="font-mono text-sm font-black w-5 text-center shrink-0 text-primary">{rank}</span>
                      <span className="flex-1 text-sm font-bold truncate text-primary">{me?.name}</span>
                      <span className="font-mono text-sm tabular-nums text-muted-foreground">{fmt(points)}</span>
                    </div>
                  </>
                )}
              </div>

              <Button onClick={() => navigate("/play")}
                className="mt-auto bg-primary text-primary-foreground px-8 animate-fade-up"
                style={{ animationDelay: "0.4s" }}>
                خروج
              </Button>
            </div>
          );
        })()}

        {/* EXPLODED */}
        {phase === "exploded" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-5 animate-hp-explode">
            <BombIcon className="h-28 w-28 text-primary" />
            <h2 className="text-3xl font-black text-primary text-glow-fire">انفجرت!</h2>
            <p className="text-muted-foreground text-base">تم تصفير نقاطك</p>
            <p className="text-muted-foreground/50 text-xs">تعود للعبة الآن...</p>
          </div>
        )}

        {/* QUESTION */}
        {(phase === "question" || phase === "answered") && currentQ && (
          <div key={qSeed} className="flex-1 flex flex-col max-w-2xl mx-auto w-full pt-3 animate-question-in">

            {/* Non-bomb holder: subtle indicator showing who's sweating */}
            {!hasBomb && bombHolder && phase === "question" && (
              <div className="mb-2 flex items-center gap-2 px-3 py-1.5 rounded-lg border border-primary/20 bg-primary/8 text-xs text-primary/60 font-mono">
                <BombIcon className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                <span className="flex-1 truncate">{bombHolder.name} يحمل القنبلة</span>
                <span className="tabular-nums" style={{ color: fuseColor }}>{Math.ceil(fuseMs / 1000)}s</span>
              </div>
            )}

            {hasBomb && phase === "question" && (
              <div className="mb-3 rounded-xl bg-primary/15 border border-primary/40 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 text-primary font-bold text-sm">
                  <BombIcon className={cn("h-5 w-5 shrink-0", fuseMs < 12_000 && "animate-fuse-critical")} />
                  <span>لديك القنبلة — أجب صح لتمررها</span>
                  <span className="ms-auto tabular-nums text-xs opacity-70">{Math.ceil(fuseMs / 1000)}s</span>
                </div>
                {/* Spark-on-cord fuse: burned ash on left, glowing spark at junction, golden cord on right */}
                <div className="relative h-2.5 w-full rounded-full overflow-visible bg-primary/8">
                  {/* Burned portion (left) */}
                  <div className="absolute left-0 top-0 h-full rounded-l-full"
                    style={{ width: `${100 - fusePct}%`, background: "hsl(0 0% 14%)" }} />
                  {/* Remaining cord (right) */}
                  <div className="absolute right-0 top-0 h-full rounded-r-full"
                    style={{ width: `${fusePct}%`,
                      background: `linear-gradient(90deg, ${fuseColor}88, ${fuseColor})` }} />
                  {/* Live spark at the burn point */}
                  <div className="absolute top-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      left: `calc(${100 - fusePct}% - 5px)`,
                      width: 10, height: 10,
                      background: fuseColor,
                      boxShadow: `0 0 10px 3px ${fuseColor}, 0 0 22px 6px hsl(45 100% 68% / 0.45)`,
                    }} />
                </div>
              </div>
            )}

            <div className="border-2 border-primary/40 bg-primary/5 px-4 py-6 text-center rounded-xl mb-3">
              {currentQ.image_url && (
                <img src={currentQ.image_url} alt="" className="mx-auto mb-4 max-h-40 rounded-lg border border-primary/30" />
              )}
              <p className="text-xl md:text-2xl text-primary font-bold leading-relaxed">{currentQ.text}</p>
              <div className="mt-2 text-xs text-muted-foreground tabular-nums">{timeLeft}s</div>
            </div>

            <div className="grid grid-cols-2 gap-2 flex-1">
              {currentQ.options.map((opt, i) => {
                const isCorrect = i === currentQ.correct_index;
                const isPicked  = picked === i;
                const show      = picked !== null;
                return (
                  <button key={i} disabled={picked !== null} onClick={() => submit(i)}
                    className={cn(
                      "min-h-[100px] px-3 py-4 text-center text-base font-bold border-2 transition-all rounded-xl active:scale-[0.97]",
                      "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20",
                      show && isCorrect  && "bg-green-700/70 border-green-500 text-white animate-answer-correct",
                      show && isPicked && !isCorrect && "bg-red-800/70 border-red-500 text-white animate-answer-wrong",
                      show && !isPicked && !isCorrect && "opacity-25"
                    )}>
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* PASSING — choose who gets the bomb */}
        {phase === "passing" && (
          <div className="flex-1 flex flex-col pt-4 gap-4 max-w-md mx-auto w-full">
            <div className="text-center">
              <BombIcon className="h-14 w-14 mx-auto text-primary mb-2" />
              <h2 className="text-xl font-black text-primary text-glow-fire">مرّر القنبلة!</h2>
              <p className="text-sm text-muted-foreground mt-1">عندك {passSecsLeft}ث — اختر من تعطيها</p>
              {/* Countdown ring */}
              <svg className="mx-auto mt-2" width="48" height="48" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="20" fill="none" stroke="hsl(25 100% 58% / 0.2)" strokeWidth="3" />
                <circle cx="22" cy="22" r="20" fill="none" stroke="hsl(25 100% 58%)" strokeWidth="3"
                  strokeDasharray="126"
                  strokeDashoffset={126 - (passSecsLeft / PASS_SECONDS) * 126}
                  strokeLinecap="round"
                  transform="rotate(-90 22 22)"
                  style={{ transition: "stroke-dashoffset 0.9s linear" }}
                />
                <text x="22" y="26" textAnchor="middle" fill="hsl(25 100% 58%)" fontSize="13" fontWeight="bold" fontFamily="monospace">
                  {passSecsLeft}
                </text>
              </svg>
            </div>

            <div className="flex flex-col gap-3">
              {passTargets.map(target => (
                <button key={target.id} onClick={() => passBomb(target.id)}
                  className="group rounded-xl border-2 border-primary/50 bg-primary/10 hover:bg-primary/25 hover:border-primary hover:scale-[1.02] p-4 flex items-center gap-3 transition-all active:scale-[0.96]">
                  <Avatar name={target.name} size="md" />
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-primary font-bold text-base truncate">{target.name}</div>
                    <div className="text-success/80 text-xs font-mono tabular-nums">{fmt(target.crypto ?? 0)} pts</div>
                  </div>
                  <BombIcon className="h-6 w-6 text-primary/40 group-hover:text-primary transition-colors" />
                </button>
              ))}
            </div>

            <p className="text-center text-xs text-muted-foreground/50">
              إذا لم تختر — تبقى القنبلة معك
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default HotPotatoGame;
