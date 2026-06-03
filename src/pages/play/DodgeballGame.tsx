import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Heart, Skull, Trophy, Zap, Check, X as XIcon } from "lucide-react";

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

  const qStartRef    = useRef(Date.now());
  const timerStartRef = useRef(0);
  const timerRafRef  = useRef<number | null>(null);
  const askedRef     = useRef(0);
  const pickedRef    = useRef<number | null>(null); // prevents double-execution

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
            if (prev?.eliminated && !m.eliminated) {
              setPhase("revived");
            }
            return m;
          });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, studentId]);

  // ── Session status sync ───────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    if (session.status === "lobby")    setPhase("waiting");
    else if (session.status === "finished") setPhase("done");
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
    pickedRef.current = null; // allow next answer through
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
      // Only fire timeout if student hasn't already picked
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
    // Guard: only the first call per question goes through
    if (pickedRef.current !== null) return;
    pickedRef.current = idx;

    const correct = idx === currentQ.correct_index;
    setPicked(idx);

    // ── Calculate outcome immediately ─────────────────────────────────────
    const newLives   = correct ? (me.lives ?? 1) : Math.max(0, (me.lives ?? 1) - 1);
    const eliminated = !correct && newLives <= 0;

    // ── Phase transition is NEVER blocked by DB calls ─────────────────────
    setTimeout(() => setPhase(eliminated ? "eliminated" : "answered"), 700);

    // ── DB updates fire-and-forget in background ──────────────────────────
    supabase.from("question_responses").insert({
      session_id: sessionId, student_id: me.id, question_id: currentQ.id,
      question_index: askedRef.current, answer_index: idx, is_correct: correct,
    }).catch(() => {});

    const updates: any = { total_answers: (me.total_answers ?? 0) + 1 };
    if (correct) {
      updates.correct_answers = (me.correct_answers ?? 0) + 1;
    } else {
      updates.lives = newLives;
      if (eliminated) { updates.eliminated = true; updates.eliminated_at = new Date().toISOString(); }
    }
    supabase.from("game_students").update(updates).eq("id", me.id).catch(() => {});
  }, [currentQ, me, sessionId]);

  const submit = (idx: number) => { if (pickedRef.current !== null) return; handleAnswer(idx); };

  const tapTimer = async () => {
    if (hasTapped || !session?.settings?.timerRoundId) return;
    setHasTapped(true);
    if (timerRafRef.current) cancelAnimationFrame(timerRafRef.current);
    const elapsed = Date.now() - timerStartRef.current;
    setTimerMs(elapsed);
    setPhase("tapped");
    await supabase.from("dodgeball_timer_taps").insert({
      session_id: sessionId, student_id: studentId,
      timer_round_id: session.settings.timerRoundId, elapsed_ms: elapsed,
    });
  };

  const keepLife = async () => {
    if (!me) return;
    await supabase.from("game_students").update({ lives: (me.lives ?? 1) + 1 }).eq("id", studentId);
    setQSeed(s => s + 1);
    setPhase("question");
  };

  const giftLife = async (targetId: string) => {
    const target = students.find(s => s.id === targetId);
    if (!target) return;
    if (target.eliminated) {
      await supabase.from("game_students").update({ eliminated: false, eliminated_at: null, lives: 1 }).eq("id", targetId);
    } else {
      await supabase.from("game_students").update({ lives: (target.lives ?? 1) + 1 }).eq("id", targetId);
    }
    setQSeed(s => s + 1);
    setPhase("question");
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const lives = me?.lives ?? 1;
  const timerSec = (timerMs / 1000).toFixed(2);

  return (
    <div className="theme-dodgeball min-h-[100dvh] bg-background text-foreground font-mono flex flex-col overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 30% 10%, hsl(240 45% 12%) 0%, hsl(240 50% 6%) 100%)" }}>
      <div className="pointer-events-none fixed inset-0 opacity-10"
        style={{ backgroundImage: "repeating-linear-gradient(0deg,hsl(0 0% 0%/0.5) 0px,hsl(0 0% 0%/0.5) 1px,transparent 1px,transparent 4px)" }} />

      {/* Header */}
      <header className="relative flex items-center justify-between px-4 py-3 border-b border-primary/30 sticky top-0 bg-background/80 backdrop-blur-sm z-10">
        <div className="text-sm font-bold truncate max-w-[50%] text-primary">{me?.name ?? "—"}</div>
        <div className="flex items-center gap-1">
          {lives > 0
            ? Array.from({ length: lives }).map((_, i) =>
                <Heart key={i} className="h-5 w-5 fill-current"
                  style={{ color: "hsl(190 100% 60%)", filter: "drop-shadow(0 0 8px hsl(190 100% 60% / 0.7))" }} />)
            : <Skull className="h-5 w-5" style={{ color: "hsl(270 50% 50%)" }} />
          }
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {students.filter(s => !s.eliminated).length} alive
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
        {phase === "done" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
            {me && !me.eliminated ? (
              <>
                <Trophy className="h-20 w-20 text-amber-400" style={{ filter: "drop-shadow(0 0 20px gold)" }} />
                <h2 className="text-3xl font-black text-primary">فزت!</h2>
                <p className="text-muted-foreground text-sm">أنت آخر لاعب واقف</p>
              </>
            ) : (
              <>
                <Skull className="h-20 w-20 text-muted-foreground" />
                <h2 className="text-3xl font-black text-muted-foreground">انتهت اللعبة</h2>
              </>
            )}
            <Button onClick={() => navigate("/play")} className="mt-4 bg-primary text-primary-foreground">خروج</Button>
          </div>
        )}

        {/* ELIMINATED */}
        {phase === "eliminated" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
            <div className="opacity-40"><Avatar name={me?.name ?? "?"} size="xl" /></div>
            <Skull className="h-12 w-12 text-muted-foreground" />
            <h2 className="text-2xl font-black text-muted-foreground">تم حذفك</h2>
            <p className="text-xs text-muted-foreground/50">بانتظار نهاية اللعبة...</p>
            <p className="text-xs text-muted-foreground/30">قد يعطيك أحدهم حياة إضافية</p>
          </div>
        )}

        {/* REVIVED */}
        {phase === "revived" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 animate-pulse">
            <Heart className="h-20 w-20 fill-current" style={{ color: "hsl(190 100% 60%)", filter: "drop-shadow(0 0 24px hsl(190 100% 60% / 0.8))" }} />
            <h2 className="text-2xl font-black text-primary">تم إنعاشك!</h2>
            <p className="text-sm text-muted-foreground">عد إلى الحلبة...</p>
          </div>
        )}

        {/* QUESTION */}
        {(phase === "question" || phase === "answered") && currentQ && (
          <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full pt-4">
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
                      "border-primary/50 bg-primary/8 text-primary hover:bg-primary/20",
                      show && isCorrect  && "bg-green-700/70 border-green-500 text-white",
                      show && isPicked && !isCorrect && "bg-red-800/70 border-red-500 text-white",
                      show && !isPicked && !isCorrect && "opacity-25"
                    )}>
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* TIMER — STOP button */}
        {(phase === "timer" || phase === "tapped") && (
          <div className="flex-1 flex flex-col items-center justify-center gap-7">
            <div className="text-center">
              <div className="text-[10px] tracking-[0.5em] text-muted-foreground mb-1 uppercase">Stop closest to</div>
              <div className="text-6xl font-black text-primary tabular-nums"
                style={{ textShadow: "0 0 30px hsl(190 100% 60% / 0.9)" }}>
                10.00s
              </div>
            </div>

            <div className="text-5xl font-black tabular-nums text-foreground"
              style={{ textShadow: phase === "timer" ? "0 0 20px hsl(190 100% 60% / 0.6)" : "none" }}>
              {timerSec}s
            </div>

            {phase === "timer" ? (
              <button onClick={tapTimer}
                className="h-40 w-40 rounded-full border-4 border-primary bg-primary/20 font-black text-2xl text-primary active:scale-95 transition-all tracking-widest"
                style={{ boxShadow: "0 0 40px hsl(190 100% 60% / 0.5)", textShadow: "0 0 10px hsl(190 100% 60%)" }}>
                STOP
              </button>
            ) : (
              <div className="h-40 w-40 rounded-full border-4 border-border/40 bg-muted/10 flex flex-col items-center justify-center gap-1">
                <Check className="h-8 w-8 text-muted-foreground" />
                <div className="text-xs text-muted-foreground">tapped</div>
                <div className="text-2xl font-black text-primary tabular-nums">{timerSec}s</div>
              </div>
            )}

            <div className="text-xs text-muted-foreground/60 tracking-widest">بانتظار نتيجة الجولة</div>
          </div>
        )}

        {/* LIFE GIFT */}
        {phase === "life_gift" && (
          <div className="flex-1 flex flex-col pt-4 gap-4">
            <div className="text-center">
              <Trophy className="h-12 w-12 mx-auto text-amber-400 mb-2" />
              <h2 className="text-xl font-black text-primary">فزت بالجولة</h2>
              <p className="text-sm text-muted-foreground mt-1">احتفظ بالحياة الإضافية أو اهدِها لأحد</p>
            </div>

            <Button onClick={keepLife}
              className="w-full h-14 bg-primary text-primary-foreground hover:bg-primary/90 text-lg font-bold gap-2">
              <Heart className="h-5 w-5 fill-current" />
              احتفظ بها
            </Button>

            <div className="text-center text-[10px] tracking-widest text-muted-foreground uppercase">— أو اهدِها —</div>

            <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-64">
              {students.filter(s => s.id !== studentId).map(s => (
                <button key={s.id} onClick={() => giftLife(s.id)}
                  className={cn(
                    "rounded-xl border-2 p-3 text-left transition-all",
                    s.eliminated
                      ? "border-border/30 bg-muted/10 opacity-60"
                      : "border-primary/40 bg-primary/8 hover:bg-primary/20 hover:border-primary"
                  )}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Avatar name={s.name} size="sm" />
                    <span className={cn("text-sm font-bold truncate",
                      s.eliminated ? "text-muted-foreground line-through" : "text-primary")}>
                      {s.name}
                    </span>
                  </div>
                  {s.eliminated ? (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Skull className="h-3 w-3" /> محذوف — يعود للعبة
                    </div>
                  ) : (
                    <div className="flex gap-0.5">
                      {Array.from({ length: s.lives ?? 1 }).map((_: any, i: number) => (
                        <Heart key={i} className="h-3 w-3 fill-current" style={{ color: "hsl(190 100% 60%)" }} />
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
