import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Heart, Skull, Trophy, Gift, Zap } from "lucide-react";

type Q = { id: string; text: string; options: string[]; correct_index: number; image_url?: string };
type Phase =
  | "waiting"    // lobby
  | "question"   // answering
  | "answered"   // brief flash of result
  | "timer"      // surprise timer active — tap to stop
  | "tapped"     // already tapped, waiting for result
  | "life_gift"  // you won the timer — keep or gift
  | "eliminated" // you lost all lives
  | "revived"    // just revived — transition
  | "done";      // game over

const AVATARS = ["👾","🐱","🐶","🐼","🦊","🐸","🐵","🦁","🐯","🐰","🐻","🐨","🐷","🐮","🦄","🐲","🦉","🐺","🐙","🦝"];
const avatarFor = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATARS[Math.abs(h) % AVATARS.length];
};

interface Props {
  sessionId: string;
  studentId: string;
}

const DodgeballGame = ({ sessionId, studentId }: Props) => {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  const [phase, setPhase] = useState<Phase>("waiting");
  const [currentQ, setCurrentQ] = useState<Q | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(20);
  const [timerMs, setTimerMs] = useState(0);
  const [hasTapped, setHasTapped] = useState(false);
  const [wasEliminated, setWasEliminated] = useState(false);
  const [qSeed, setQSeed] = useState(0);

  const qStartRef = useRef(Date.now());
  const timerStartRef = useRef(0);
  const timerRafRef = useRef<number | null>(null);
  const askedRef = useRef(0);

  // ── Initial load ────────────────────────────────────────────────────────
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
      const myData = (ss ?? []).find((x: any) => x.id === studentId);
      if (myData) setMe(myData);
    })();
  }, [sessionId, studentId]);

  // ── Realtime ────────────────────────────────────────────────────────────
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
            // Detect revival (was eliminated, now not)
            if (prev?.eliminated && !m.eliminated) {
              setWasEliminated(false);
              setPhase("revived");
            }
            return m;
          });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, studentId]);

  // ── Session status sync ─────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    if (session.status === "lobby") setPhase("waiting");
    else if (session.status === "finished") setPhase("done");
    else if (session.status === "running") {
      setPhase(prev => {
        if (prev === "waiting") return "question";
        return prev;
      });
    }
  }, [session?.status]);

  // ── Timer activation (interrupt) ────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    const active = session.settings?.timerActive ?? false;
    const winnerId = session.settings?.timerWinnerId;
    const roundId = session.settings?.timerRoundId;

    if (active) {
      // Timer just fired — switch to timer phase unless already eliminated/done
      if (phase !== "eliminated" && phase !== "done") {
        timerStartRef.current = session.settings?.timerStartedAt
          ? new Date(session.settings.timerStartedAt).getTime()
          : Date.now();
        setHasTapped(false);
        setTimerMs(0);
        setPhase("timer");
      }
    } else if (!active && winnerId) {
      // Timer ended
      if (winnerId === studentId) {
        // I won! Give life gift choice
        setPhase("life_gift");
      } else if (phase === "timer" || phase === "tapped") {
        // Go back to question
        setTimeout(() => { setQSeed(s => s + 1); setPhase("question"); }, 800);
      }
    }
  }, [session?.settings?.timerActive, session?.settings?.timerWinnerId, session?.settings?.timerRoundId]);

  // ── Timer RAF ───────────────────────────────────────────────────────────
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

  // ── Pick a new question ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "question" || questions.length === 0) return;
    const next = questions[Math.floor(Math.random() * questions.length)];
    setCurrentQ(next);
    setPicked(null);
    askedRef.current += 1;
    qStartRef.current = Date.now();
  }, [phase, qSeed, questions.length]);

  // ── Question countdown ──────────────────────────────────────────────────
  const duration = session?.settings?.timePerQ ?? 20;
  useEffect(() => {
    if (phase !== "question" || !currentQ) return;
    const t = setInterval(() => {
      const elapsed = (Date.now() - qStartRef.current) / 1000;
      const left = Math.max(0, Math.ceil(duration - elapsed));
      setTimeLeft(left);
      if (left <= 0) {
        clearInterval(t);
        handleAnswer(-1); // timeout = wrong
      }
    }, 200);
    return () => clearInterval(t);
  }, [phase, currentQ, duration]);

  // ── Auto-advance after "answered" flash ─────────────────────────────────
  useEffect(() => {
    if (phase !== "answered") return;
    const t = setTimeout(() => { setQSeed(s => s + 1); setPhase("question"); }, 1500);
    return () => clearTimeout(t);
  }, [phase]);

  // ── Revived transition ───────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "revived") return;
    const t = setTimeout(() => { setQSeed(s => s + 1); setPhase("question"); }, 2000);
    return () => clearTimeout(t);
  }, [phase]);

  // ── Handle answer ────────────────────────────────────────────────────────
  const handleAnswer = useCallback(async (idx: number) => {
    if (!currentQ || !me) return;
    const correct = idx === currentQ.correct_index;
    setPicked(idx);

    await supabase.from("question_responses").insert({
      session_id: sessionId, student_id: me.id, question_id: currentQ.id,
      question_index: askedRef.current, answer_index: idx, is_correct: correct,
    }).catch(() => {}); // non-blocking

    if (correct) {
      await supabase.from("game_students").update({
        total_answers: (me.total_answers ?? 0) + 1,
        correct_answers: (me.correct_answers ?? 0) + 1,
      }).eq("id", me.id);
      setTimeout(() => setPhase("answered"), 700);
    } else {
      // Lose a life
      const newLives = Math.max(0, (me.lives ?? 1) - 1);
      const updates: any = {
        total_answers: (me.total_answers ?? 0) + 1,
        lives: newLives,
      };
      if (newLives <= 0) {
        updates.eliminated = true;
        updates.eliminated_at = new Date().toISOString();
      }
      await supabase.from("game_students").update(updates).eq("id", me.id);
      setTimeout(() => {
        if (newLives <= 0) {
          setWasEliminated(true);
          setPhase("eliminated");
        } else {
          setPhase("answered");
        }
      }, 800);
    }
  }, [currentQ, me, sessionId]);

  const submit = (idx: number) => {
    if (picked !== null) return;
    handleAnswer(idx);
  };

  // ── Tap timer ────────────────────────────────────────────────────────────
  const tapTimer = async () => {
    if (hasTapped || !session?.settings?.timerRoundId) return;
    setHasTapped(true);
    if (timerRafRef.current) cancelAnimationFrame(timerRafRef.current);
    const elapsed = Date.now() - timerStartRef.current;
    setTimerMs(elapsed);
    setPhase("tapped");
    await supabase.from("dodgeball_timer_taps").insert({
      session_id: sessionId,
      student_id: studentId,
      timer_round_id: session.settings.timerRoundId,
      elapsed_ms: elapsed,
    });
  };

  // ── Life gift ────────────────────────────────────────────────────────────
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
      // Revive the player
      await supabase.from("game_students").update({ eliminated: false, eliminated_at: null, lives: 1 }).eq("id", targetId);
    } else {
      await supabase.from("game_students").update({ lives: (target.lives ?? 1) + 1 }).eq("id", targetId);
    }
    setQSeed(s => s + 1);
    setPhase("question");
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const timerSec = (timerMs / 1000).toFixed(2);
  const lives = me?.lives ?? 1;

  return (
    <div className="theme-dodgeball min-h-[100dvh] bg-background text-foreground font-mono flex flex-col overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 30% 10%, hsl(0 40% 12%) 0%, hsl(0 45% 8%) 100%)" }}>
      <div className="pointer-events-none fixed inset-0 opacity-10"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, hsl(0 0% 0%/0.5) 0px, hsl(0 0% 0%/0.5) 1px, transparent 1px, transparent 4px)" }} />

      {/* Header */}
      <header className="relative flex items-center justify-between px-4 py-3 border-b border-primary/30 sticky top-0 bg-background/80 backdrop-blur-sm z-10">
        <div className="text-sm font-bold truncate max-w-[50%] text-primary">{me?.name ?? "—"}</div>
        <div className="flex items-center gap-1">
          {lives > 0
            ? Array.from({ length: lives }).map((_, i) => <Heart key={i} className="h-5 w-5 fill-current text-red-500" />)
            : <Skull className="h-5 w-5 text-muted-foreground" />
          }
        </div>
        <div className="text-xs text-muted-foreground">
          {students.filter(s => !s.eliminated).length} alive
        </div>
      </header>

      <main className="relative flex-1 px-4 pb-6 flex flex-col">

        {/* WAITING */}
        {phase === "waiting" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
            <div className="text-4xl">{avatarFor(me?.name ?? "")}</div>
            <div className="text-xl text-primary animate-pulse">{"> بانتظار المعلّم..."}</div>
            <p className="text-muted-foreground text-sm">{students.length} لاعب متصل</p>
          </div>
        )}

        {/* DONE */}
        {phase === "done" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
            {me && !me.eliminated ? (
              <>
                <Trophy className="h-20 w-20 text-yellow-400" style={{ filter: "drop-shadow(0 0 20px gold)" }} />
                <h2 className="text-3xl font-black text-primary">🎉 فزت!</h2>
                <p className="text-muted-foreground">أنت آخر لاعب واقف</p>
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
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
            <div className="text-8xl grayscale opacity-60">{avatarFor(me?.name ?? "")}</div>
            <Skull className="h-12 w-12 text-muted-foreground" />
            <h2 className="text-2xl font-black text-muted-foreground">تم حذفك 💀</h2>
            <p className="text-sm text-muted-foreground/60">بانتظار نهاية اللعبة...</p>
            <p className="text-xs text-muted-foreground/40">قد يعطيك أحدهم حياة إضافية!</p>
          </div>
        )}

        {/* REVIVED */}
        {phase === "revived" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 animate-pulse">
            <Heart className="h-20 w-20 text-red-500 fill-current" style={{ filter: "drop-shadow(0 0 20px red)" }} />
            <h2 className="text-2xl font-black text-primary">تم إنعاشك! ❤️</h2>
            <p className="text-sm text-muted-foreground">عد إلى الحلبة...</p>
          </div>
        )}

        {/* QUESTION */}
        {(phase === "question" || phase === "answered") && currentQ && (
          <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full pt-4">
            {/* Question box */}
            <div className="border-2 border-primary/40 bg-primary/5 px-4 py-6 text-center rounded-xl mb-3">
              {currentQ.image_url && (
                <img src={currentQ.image_url} alt="" className="mx-auto mb-4 max-h-40 rounded-lg border border-primary/30" />
              )}
              <p className="text-xl md:text-2xl text-primary font-bold leading-relaxed">{currentQ.text}</p>
              <div className="mt-2 text-xs text-muted-foreground">⏱ {timeLeft}s</div>
            </div>

            {/* Lives warning */}
            {lives === 1 && phase === "question" && (
              <div className="text-center text-xs text-red-400 font-bold mb-2 animate-pulse">
                ⚠ حياة أخيرة! أجب بحذر
              </div>
            )}

            {/* Options */}
            <div className="grid grid-cols-2 gap-2 flex-1">
              {currentQ.options.map((opt, i) => {
                const isCorrect = i === currentQ.correct_index;
                const isPicked = picked === i;
                const show = picked !== null;
                return (
                  <button
                    key={i}
                    disabled={picked !== null}
                    onClick={() => submit(i)}
                    className={cn(
                      "min-h-[100px] px-3 py-4 text-center text-base font-bold border-2 transition-all rounded-xl active:scale-[0.97]",
                      "border-primary/50 bg-primary/8 text-primary hover:bg-primary/20",
                      show && isCorrect && "bg-green-600/80 border-green-500 text-white",
                      show && isPicked && !isCorrect && "bg-red-700/80 border-red-500 text-white",
                      show && !isPicked && !isCorrect && "opacity-30"
                    )}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* TIMER — big STOP button */}
        {(phase === "timer" || phase === "tapped") && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <div className="text-center">
              <div className="text-xs text-muted-foreground font-mono mb-1">STOP CLOSEST TO</div>
              <div className="text-6xl font-black text-primary tabular-nums"
                style={{ textShadow: "0 0 30px hsl(9 100% 58% / 0.9)" }}>
                10.00s
              </div>
            </div>

            {/* Live counter */}
            <div className="text-5xl font-black tabular-nums text-foreground"
              style={{ textShadow: phase === "timer" ? "0 0 20px hsl(9 100% 58% / 0.6)" : "none" }}>
              {timerSec}s
            </div>

            {phase === "timer" ? (
              <button
                onClick={tapTimer}
                className="h-40 w-40 rounded-full border-4 border-primary bg-primary/20 font-black text-2xl text-primary active:scale-95 transition-all"
                style={{ boxShadow: "0 0 40px hsl(9 100% 58% / 0.5)", textShadow: "0 0 10px hsl(9 100% 58%)" }}>
                STOP!
              </button>
            ) : (
              <div className="h-40 w-40 rounded-full border-4 border-border/40 bg-muted/10 flex flex-col items-center justify-center">
                <Zap className="h-8 w-8 text-muted-foreground" />
                <div className="text-sm text-muted-foreground mt-1">tapped!</div>
                <div className="text-2xl font-black text-primary mt-1">{timerSec}s</div>
              </div>
            )}

            <div className="text-xs text-muted-foreground">بانتظار نتيجة الجولة...</div>
          </div>
        )}

        {/* LIFE GIFT */}
        {phase === "life_gift" && (
          <div className="flex-1 flex flex-col pt-4 gap-4">
            <div className="text-center">
              <Trophy className="h-12 w-12 mx-auto text-yellow-400 mb-2" />
              <h2 className="text-xl font-black text-primary">فزت بالجولة! 🎉</h2>
              <p className="text-sm text-muted-foreground mt-1">احتفظ بالحياة الإضافية أو اهدِها لأحد</p>
            </div>

            <Button onClick={keepLife}
              className="w-full h-14 bg-primary text-primary-foreground hover:bg-primary/90 text-lg font-bold">
              <Heart className="h-5 w-5 me-2 fill-current" />احتفظ بها ❤️
            </Button>

            <div className="text-center text-xs text-muted-foreground font-bold">— أو اهدِها —</div>

            <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-64">
              {students.filter(s => s.id !== studentId).map(s => (
                <button
                  key={s.id}
                  onClick={() => giftLife(s.id)}
                  className={cn(
                    "rounded-xl border-2 p-3 text-left transition-all",
                    s.eliminated
                      ? "border-border/30 bg-muted/10 opacity-60"
                      : "border-primary/40 bg-primary/8 hover:bg-primary/20 hover:border-primary"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("text-2xl", s.eliminated && "grayscale")}>{avatarFor(s.name)}</span>
                    <span className={cn("text-sm font-bold truncate", s.eliminated ? "text-muted-foreground line-through" : "text-primary")}>
                      {s.name}
                    </span>
                  </div>
                  {s.eliminated ? (
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Skull className="h-3 w-3" /> محذوف — يعود للعبة!
                    </div>
                  ) : (
                    <div className="flex gap-0.5 mt-1">
                      {Array.from({ length: s.lives ?? 1 }).map((_: any, i: number) => (
                        <Heart key={i} className="h-3 w-3 fill-current text-red-500" />
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
