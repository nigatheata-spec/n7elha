import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Trophy, Check } from "lucide-react";

type Q = { id: string; text: string; options: string[]; correct_index: number; image_url?: string };
type Phase =
  | "waiting"
  | "question"
  | "answered"
  | "timer"
  | "tapped"
  | "life_gift"
  | "eliminated"
  | "revived"
  | "done";

// ── Letter avatar ────────────────────────────────────────────────────────────
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

// Arcane crystal icon — replaces Heart / Skull (no emojis)
const CrystalIcon = ({ className, dim = false }: { className?: string; dim?: boolean }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="12,2 20,9 12,22 4,9"
      fill={dim ? "hsl(240 20% 35%)" : "hsl(190 100% 65%)"}
      opacity={dim ? 0.35 : 0.85} />
    <polygon points="12,2 20,9 12,8 4,9"
      fill={dim ? "hsl(240 15% 55%)" : "hsl(200 100% 92%)"}
      opacity={dim ? 0.25 : 0.7} />
    <line x1="12" y1="2" x2="12" y2="8" stroke="white" strokeWidth="0.6" opacity="0.5" />
    {!dim && <circle cx="12" cy="2" r="1.2" fill="hsl(200 100% 96%)" opacity="0.9" />}
  </svg>
);

// Stable starfield — computed once outside component, never regenerates
const STARS = Array.from({ length: 40 }, (_, i) => ({
  x:        (i * 37 + 11) % 100,
  y:        (i * 53 + 17) % 100,
  size:     1 + (i % 3),
  color:    i % 6 === 0 ? "hsl(290 80% 82%)" : i % 4 === 0 ? "hsl(200 100% 88%)" : "hsl(260 50% 92%)",
  duration: 2.5 + (i % 4) * 0.7,
  delay:    (i * 0.31) % 4,
}));

interface Props { sessionId: string; studentId: string; }

const DodgeballGame = ({ sessionId, studentId }: Props) => {
  const navigate = useNavigate();
  const [session, setSession]       = useState<any>(null);
  const [questions, setQuestions]   = useState<Q[]>([]);
  const [students, setStudents]     = useState<any[]>([]);
  const [me, setMe]                 = useState<any>(null);
  const [phase, setPhase]           = useState<Phase>("waiting");
  const [currentQ, setCurrentQ]     = useState<Q | null>(null);
  const [picked, setPicked]         = useState<number | null>(null);
  const [timeLeft, setTimeLeft]     = useState(20);
  const [timerMs, setTimerMs]       = useState(0);
  const [hasTapped, setHasTapped]   = useState(false);
  const [qSeed, setQSeed]           = useState(0);
  const [showFreeze, setShowFreeze] = useState(false);

  const qStartRef     = useRef(Date.now());
  const timerStartRef = useRef(0);
  const timerRafRef   = useRef<number | null>(null);
  const askedRef      = useRef(0);
  const pickedRef     = useRef<number | null>(null);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from("game_sessions").select("*, quizzes(id,title)").eq("id", sessionId).maybeSingle();
      setSession(s);
      if (s?.quiz_id) {
        const { data: qs } = await supabase.from("questions").select("*").eq("quiz_id", s.quiz_id).order("position");
        setQuestions((qs ?? []).map((q: any) => ({ ...q, options: Array.isArray(q.options) ? q.options : [] })));
      }
      const { data: ss } = await supabase.from("game_students").select("*").eq("session_id", sessionId).order("name");
      setStudents(ss ?? []);
      setMe((ss ?? []).find((x: any) => x.id === studentId) ?? null);
    })();
  }, [sessionId, studentId]);

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel(`db-game-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_sessions", filter: `id=eq.${sessionId}` },
        (p: any) => setSession((prev: any) => ({ ...prev, ...p.new })))
      .on("postgres_changes", { event: "*", schema: "public", table: "game_students", filter: `session_id=eq.${sessionId}` },
        async () => {
          const { data: ss } = await supabase.from("game_students").select("*").eq("session_id", sessionId).order("name");
          setStudents(ss ?? []);
          const m = (ss ?? []).find((x: any) => x.id === studentId);
          if (m) setMe((prev: any) => {
            if (prev?.eliminated && !m.eliminated) setPhase("revived");
            return m;
          });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, studentId]);

  // ── Session status sync ───────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    if (session.status === "lobby")          setPhase("waiting");
    else if (session.status === "finished")  setPhase("done");
    else if (session.status === "running")
      setPhase(prev => prev === "waiting" ? "question" : prev);
  }, [session?.status]);

  // ── Timer activation ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    const active   = session.settings?.timerActive ?? false;
    const winnerId = session.settings?.timerWinnerId;
    if (active) {
      if (phase !== "eliminated" && phase !== "done") {
        timerStartRef.current = session.settings?.timerStartedAt
          ? new Date(session.settings.timerStartedAt).getTime()
          : Date.now();
        setHasTapped(false);
        setTimerMs(0);
        setPhase("timer");
      }
    } else if (!active && winnerId) {
      if (winnerId === studentId) {
        setPhase("life_gift");
      } else if (phase === "timer" || phase === "tapped") {
        setTimeout(() => { setQSeed(s => s + 1); setPhase("question"); }, 700);
      }
    }
  }, [session?.settings?.timerActive, session?.settings?.timerWinnerId]);

  // ── Timer RAF ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "timer") {
      if (timerRafRef.current) cancelAnimationFrame(timerRafRef.current);
      return;
    }
    const tick = () => {
      setTimerMs(Date.now() - timerStartRef.current);
      timerRafRef.current = requestAnimationFrame(tick);
    };
    timerRafRef.current = requestAnimationFrame(tick);
    return () => { if (timerRafRef.current) cancelAnimationFrame(timerRafRef.current); };
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
  const duration = session?.settings?.timePerQ ?? 20;
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

  // ── Auto-advance after "answered" ─────────────────────────────────────────
  useEffect(() => {
    if (phase !== "answered") return;
    const t = setTimeout(() => { setQSeed(s => s + 1); setPhase("question"); }, 1500);
    return () => clearTimeout(t);
  }, [phase]);

  // ── Revival transition ────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "revived") return;
    const t = setTimeout(() => { setQSeed(s => s + 1); setPhase("question"); }, 2000);
    return () => clearTimeout(t);
  }, [phase]);

  // ── Answer handler ────────────────────────────────────────────────────────
  const handleAnswer = useCallback((idx: number) => {
    if (!currentQ || !me) return;
    if (pickedRef.current !== null) return;
    pickedRef.current = idx;

    const correct    = idx === currentQ.correct_index;
    const newLives   = correct ? (me.lives ?? 1) : Math.max(0, (me.lives ?? 1) - 1);
    const eliminated = !correct && newLives <= 0;

    setPicked(idx);
    setTimeout(() => setPhase(eliminated ? "eliminated" : "answered"), 700);

    supabase.from("question_responses").insert({
      session_id: sessionId, student_id: me.id, question_id: currentQ.id,
      question_index: askedRef.current, answer_index: idx, is_correct: correct,
    }).then(undefined, () => {});

    const updates: any = { total_answers: (me.total_answers ?? 0) + 1 };
    if (correct) {
      updates.correct_answers = (me.correct_answers ?? 0) + 1;
    } else {
      updates.lives = newLives;
      if (eliminated) { updates.eliminated = true; updates.eliminated_at = new Date().toISOString(); }
    }
    supabase.from("game_students").update(updates).eq("id", me.id).then(undefined, () => {});
  }, [currentQ, me, sessionId]);

  const submit = (idx: number) => { if (pickedRef.current !== null) return; handleAnswer(idx); };

  const tapTimer = () => {
    if (hasTapped || !session?.settings?.timerRoundId) return;
    setHasTapped(true);
    setShowFreeze(true);
    setTimeout(() => setShowFreeze(false), 700);
    if (timerRafRef.current) cancelAnimationFrame(timerRafRef.current);
    const elapsed = Date.now() - timerStartRef.current;
    setTimerMs(elapsed);
    setPhase("tapped");
    supabase.from("dodgeball_timer_taps").insert({
      session_id: sessionId, student_id: studentId,
      timer_round_id: session.settings.timerRoundId, elapsed_ms: elapsed,
    }).then(undefined, () => {});
  };

  const keepLife = () => {
    if (!me) return;
    supabase.from("game_students").update({ lives: (me.lives ?? 1) + 1 }).eq("id", studentId).then(undefined, () => {});
    setQSeed(s => s + 1);
    setPhase("question");
  };

  const giftLife = (targetId: string) => {
    const target = students.find(s => s.id === targetId);
    if (!target) return;
    if (target.eliminated) {
      supabase.from("game_students").update({ eliminated: false, eliminated_at: null, lives: 1 }).eq("id", targetId).then(undefined, () => {});
    } else {
      supabase.from("game_students").update({ lives: (target.lives ?? 1) + 1 }).eq("id", targetId).then(undefined, () => {});
    }
    setQSeed(s => s + 1);
    setPhase("question");
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const lives    = me?.lives ?? 1;
  const timerSec = (timerMs / 1000).toFixed(2);

  return (
    <div className="theme-dodgeball min-h-[100dvh] text-foreground font-mono flex flex-col overflow-hidden relative"
      style={{ background: "radial-gradient(ellipse at 50% -10%, hsl(270 50% 14%) 0%, hsl(255 40% 7%) 55%, hsl(240 35% 5%) 100%)" }}>

      {/* Starfield */}
      {STARS.map((s, i) => (
        <div key={i} className="absolute rounded-full pointer-events-none"
          style={{
            left: `${s.x}%`, top: `${s.y}%`,
            width: s.size, height: s.size,
            background: s.color,
            animation: `star-twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
          }} />
      ))}

      {/* Freeze flash overlay */}
      {showFreeze && (
        <div className="pointer-events-none fixed inset-0 z-50 animate-freeze-flash"
          style={{ background: "radial-gradient(ellipse at center, hsl(200 100% 92% / 0.75) 0%, hsl(220 100% 72% / 0.35) 55%, transparent 80%)" }} />
      )}

      {/* Ambient top arcane glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72"
        style={{ background: "radial-gradient(ellipse at 50% 0%, hsl(270 60% 28% / 0.3) 0%, transparent 70%)" }} />

      {/* Header */}
      <header className="relative flex items-center justify-between px-4 py-3 border-b border-primary/30 sticky top-0 z-10"
        style={{ background: "hsl(255 40% 6% / 0.85)", backdropFilter: "blur(8px)" }}>
        <div className="text-sm font-bold truncate max-w-[50%] text-primary">{me?.name ?? "—"}</div>
        <div className="flex items-center gap-1">
          {lives > 0
            ? Array.from({ length: Math.min(lives, 6) }).map((_, i) => (
                <div key={i} style={{ filter: "drop-shadow(0 0 5px hsl(190 100% 60% / 0.8))" }}>
                  <CrystalIcon className="h-5 w-5" />
                </div>
              ))
            : <CrystalIcon className="h-5 w-5" dim />
          }
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {students.filter(s => !s.eliminated).length} alive
        </div>
      </header>

      <main className="relative flex-1 px-4 pb-6 flex flex-col">

        {/* WAITING */}
        {phase === "waiting" && (
          <div className="flex-1 flex flex-col items-center pt-5 gap-4 overflow-hidden">

            {/* Game identity */}
            <div className="text-center shrink-0">
              <CrystalIcon className="h-10 w-10 mx-auto mb-1.5" />
              <h1 className="text-2xl font-black text-primary tracking-widest"
                style={{ textShadow: "0 0 20px hsl(190 100% 60% / 0.7)" }}>
                TIME WIZARD
              </h1>
              {session?.quizzes?.title && (
                <p className="text-muted-foreground/60 text-xs font-mono mt-1 truncate max-w-[240px]">{session.quizzes.title}</p>
              )}
            </div>

            {/* My card — highlighted */}
            <div className="w-full max-w-sm shrink-0 flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-primary/70 bg-primary/10"
              style={{ boxShadow: "0 0 16px hsl(190 100% 60% / 0.2)" }}>
              <Avatar name={me?.name ?? "?"} size="md" />
              <span className="font-bold text-primary flex-1 truncate">{me?.name ?? "—"}</span>
              <CrystalIcon className="h-5 w-5 shrink-0" />
            </div>

            {/* Live roster */}
            <div className="w-full max-w-sm flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between text-xs font-mono text-muted-foreground mb-2 shrink-0">
                <span>Summoned</span>
                <span className="text-primary font-bold tabular-nums">{students.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1.5 pb-1">
                {students.filter(s => s.id !== me?.id).map(s => (
                  <div key={s.id} className="animate-fade-up flex items-center gap-3 px-3 py-2 rounded-lg border border-primary/20 bg-primary/5">
                    <Avatar name={s.name} size="sm" />
                    <span className="text-foreground/75 text-sm truncate flex-1">{s.name}</span>
                    <CrystalIcon className="h-3.5 w-3.5 opacity-40 shrink-0" />
                  </div>
                ))}
                {students.filter(s => s.id !== me?.id).length === 0 && (
                  <p className="text-muted-foreground/30 font-mono text-xs pt-1">{">"} no one yet...</p>
                )}
              </div>
            </div>

            {/* Waiting pulse */}
            <p className="shrink-0 text-primary/50 font-mono text-sm animate-pulse pb-2">
              {">"} awaiting the wizard...
            </p>
          </div>
        )}

        {/* DONE */}
        {phase === "done" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
            {me && !me.eliminated ? (
              <>
                <div className="animate-crystal-burst">
                  <div style={{ filter: "drop-shadow(0 0 32px hsl(190 100% 60% / 0.9))" }}>
                    <CrystalIcon className="h-24 w-24" />
                  </div>
                </div>
                <h2 className="text-3xl font-black text-primary"
                  style={{ textShadow: "0 0 28px hsl(190 100% 60% / 0.65)" }}>
                  بلورتك تتوهج
                </h2>
                <p className="text-muted-foreground text-sm">أنت آخر لاعب واقف</p>
              </>
            ) : (
              <>
                <div style={{ filter: "blur(1px)" }}>
                  <CrystalIcon className="h-20 w-20" dim />
                </div>
                <h2 className="text-3xl font-black text-muted-foreground">انتهت اللعبة</h2>
              </>
            )}
            <Button onClick={() => navigate("/play")} className="mt-4 bg-primary text-primary-foreground">خروج</Button>
          </div>
        )}

        {/* ELIMINATED */}
        {phase === "eliminated" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
            <div className="relative opacity-30" style={{ filter: "blur(0.5px)" }}>
              <CrystalIcon className="h-20 w-20" dim />
              {/* Shard fragments */}
              <div className="absolute -top-2 -right-2 w-3 h-4 rounded-sm opacity-40 rotate-[20deg]"
                style={{ background: "hsl(190 60% 50%)", clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)" }} />
              <div className="absolute -bottom-1 -left-3 w-2 h-3 rounded-sm opacity-30 -rotate-[15deg]"
                style={{ background: "hsl(190 60% 50%)", clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)" }} />
              <div className="absolute top-2 -left-4 w-2 h-2 rounded-sm opacity-25 rotate-[40deg]"
                style={{ background: "hsl(190 60% 50%)", clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)" }} />
            </div>
            <h2 className="text-2xl font-black text-muted-foreground">تحطمت بلورتك</h2>
            <p className="text-xs text-muted-foreground/50">بانتظار نهاية اللعبة...</p>
            <p className="text-xs text-muted-foreground/30">قد يهبك أحدهم بلورة جديدة</p>
          </div>
        )}

        {/* REVIVED */}
        {phase === "revived" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
            <div className="animate-crystal-burst">
              <div style={{ filter: "drop-shadow(0 0 24px hsl(190 100% 60% / 0.9))" }}>
                <CrystalIcon className="h-24 w-24" />
              </div>
            </div>
            <h2 className="text-2xl font-black text-primary"
              style={{ textShadow: "0 0 20px hsl(190 100% 60% / 0.6)" }}>
              استعدت بلورتك!
            </h2>
            <p className="text-sm text-muted-foreground">عد إلى الساحة السحرية...</p>
          </div>
        )}

        {/* QUESTION */}
        {(phase === "question" || phase === "answered") && currentQ && (
          <div key={qSeed} className="flex-1 flex flex-col max-w-2xl mx-auto w-full pt-4 animate-question-in">
            <div className="border-2 border-primary/40 px-4 py-6 text-center rounded-xl mb-3"
              style={{ background: "hsl(255 40% 9% / 0.75)", backdropFilter: "blur(6px)" }}>
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
                      "border-primary/40 text-primary hover:bg-primary/15",
                      show && isCorrect              && "bg-green-700/70 border-green-500 text-white animate-answer-correct",
                      show && isPicked && !isCorrect && "bg-red-800/70 border-red-500 text-white animate-answer-wrong",
                      show && !isPicked && !isCorrect && "opacity-25"
                    )}
                    style={!show ? { background: "hsl(255 40% 10% / 0.55)" } : undefined}>
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* TIMER — mystical STOP orb */}
        {(phase === "timer" || phase === "tapped") && (() => {
          const arcPct   = Math.min(100, (timerMs / 10_000) * 100);
          const arcColor = timerMs < 9_000
            ? "hsl(190 100% 60%)"
            : timerMs <= 10_500
              ? "hsl(140 100% 55%)"
              : "hsl(0 90% 60%)";
          const circ = 502.65; // 2π × 80
          // 12 rune tick marks etched around the outer ring
          const TICK_IN  = 72;
          const TICK_OUT = 82;
          const CX = 90, CY = 90;
          const ticks = Array.from({ length: 12 }, (_, i) => {
            const ang = (i / 12) * Math.PI * 2 - Math.PI / 2;
            return {
              x1: CX + TICK_IN  * Math.cos(ang),
              y1: CY + TICK_IN  * Math.sin(ang),
              x2: CX + TICK_OUT * Math.cos(ang),
              y2: CY + TICK_OUT * Math.sin(ang),
              major: i % 3 === 0,
            };
          });

          return (
            <div className="flex-1 flex flex-col items-center justify-center gap-6">
              {/* Target label */}
              <div className="text-center">
                <div className="text-[10px] tracking-[0.4em] text-muted-foreground mb-0.5 uppercase font-mono">
                  أوقف عند
                </div>
                <div className="text-5xl font-black tabular-nums font-mono"
                  style={{ color: "hsl(45 100% 65%)", textShadow: "0 0 24px hsl(45 100% 60% / 0.6)" }}>
                  10.00s
                </div>
              </div>

              {/* Running time */}
              <div className="text-4xl font-black tabular-nums font-mono"
                style={{ color: arcColor, textShadow: phase === "timer" ? `0 0 18px ${arcColor}99` : "none" }}>
                {timerSec}s
              </div>

              {phase === "timer" ? (
                <div className="relative flex items-center justify-center">
                  <svg className="absolute" width="180" height="180" viewBox="0 0 180 180"
                    style={{ top: -6, left: -6 }}>
                    {/* Outer glow halo */}
                    <circle cx="90" cy="90" r="86" fill="none"
                      stroke={arcColor} strokeWidth="1" opacity="0.1" />
                    {/* Rune tick marks */}
                    {ticks.map((t, i) => (
                      <line key={i}
                        x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
                        stroke={arcColor}
                        strokeWidth={t.major ? 2.5 : 1.2}
                        opacity={t.major ? 0.7 : 0.3}
                        strokeLinecap="round" />
                    ))}
                    {/* Track ring */}
                    <circle cx="90" cy="90" r="80" fill="none"
                      stroke={`${arcColor}20`} strokeWidth="5" />
                    {/* Progress arc */}
                    <circle cx="90" cy="90" r="80" fill="none"
                      stroke={arcColor} strokeWidth="5"
                      strokeDasharray={circ}
                      strokeDashoffset={circ - (arcPct / 100) * circ}
                      strokeLinecap="round"
                      transform="rotate(-90 90 90)"
                      style={{
                        transition: "stroke-dashoffset 0.1s linear, stroke 0.25s ease",
                        filter: `drop-shadow(0 0 8px ${arcColor})`,
                      }} />
                    {/* Inner centre dot */}
                    <circle cx="90" cy="90" r="3" fill={arcColor} opacity="0.25" />
                  </svg>

                  <button onClick={tapTimer}
                    className="h-40 w-40 rounded-full border-4 font-black text-2xl active:scale-95 transition-all tracking-widest"
                    style={{
                      borderColor: arcColor,
                      background: `radial-gradient(ellipse at 40% 35%, ${arcColor}28 0%, ${arcColor}0c 60%, transparent 100%)`,
                      color: arcColor,
                      boxShadow: `0 0 40px ${arcColor}55, inset 0 0 20px ${arcColor}15`,
                      textShadow: `0 0 12px ${arcColor}`,
                    }}>
                    STOP
                  </button>
                </div>
              ) : (
                <div className="h-40 w-40 rounded-full border-4 border-border/40 flex flex-col items-center justify-center gap-1"
                  style={{ background: "hsl(255 40% 9% / 0.6)" }}>
                  <Check className="h-8 w-8" style={{ color: arcColor }} />
                  <div className="text-xs text-muted-foreground">تم الإيقاف</div>
                  <div className="text-2xl font-black tabular-nums" style={{ color: arcColor }}>{timerSec}s</div>
                </div>
              )}

              <div className="text-xs text-muted-foreground/60 tracking-widest font-mono">
                بانتظار نتيجة الجولة السحرية
              </div>
            </div>
          );
        })()}

        {/* LIFE GIFT */}
        {phase === "life_gift" && (
          <div className="flex-1 flex flex-col pt-5 gap-4">
            <div className="text-center">
              <div className="animate-crystal-burst inline-block mb-2">
                <div style={{ filter: "drop-shadow(0 0 20px hsl(190 100% 60% / 0.8))" }}>
                  <CrystalIcon className="h-14 w-14" />
                </div>
              </div>
              <h2 className="text-xl font-black text-primary">فزت بالجولة</h2>
              <p className="text-sm text-muted-foreground mt-1">احتفظ بالبلورة أو اهدِها لأحد</p>
            </div>

            <Button onClick={keepLife}
              className="w-full h-14 bg-primary text-primary-foreground hover:bg-primary/90 text-lg font-bold gap-2">
              <div className="h-5 w-5 shrink-0">
                <CrystalIcon className="h-5 w-5" />
              </div>
              احتفظ بها
            </Button>

            <div className="text-center text-[10px] tracking-widest text-muted-foreground uppercase">
              — أو اهدِها —
            </div>

            <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-64">
              {students.filter(s => s.id !== studentId).map(s => (
                <button key={s.id} onClick={() => giftLife(s.id)}
                  className={cn(
                    "rounded-xl border-2 p-3 text-left transition-all",
                    s.eliminated
                      ? "border-border/30 opacity-60"
                      : "border-primary/40 hover:bg-primary/15 hover:border-primary active:scale-[0.97]"
                  )}
                  style={s.eliminated
                    ? { background: "hsl(255 30% 8%)" }
                    : { background: "hsl(255 40% 9% / 0.6)" }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Avatar name={s.name} size="sm" />
                    <span className={cn("text-sm font-bold truncate",
                      s.eliminated ? "text-muted-foreground line-through" : "text-primary")}>
                      {s.name}
                    </span>
                  </div>
                  {s.eliminated ? (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <CrystalIcon className="h-3 w-3" dim /> تعود بلورته
                    </div>
                  ) : (
                    <div className="flex gap-0.5">
                      {Array.from({ length: Math.min(s.lives ?? 1, 5) }).map((_: any, i: number) => (
                        <CrystalIcon key={i} className="h-3 w-3" />
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default DodgeballGame;
