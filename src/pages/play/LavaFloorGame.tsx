import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Trophy, Skull, Shield } from "lucide-react";

type Q = { id: string; text: string; options: string[]; correct_index: number; image_url?: string };
type Phase = "waiting" | "question" | "answered" | "done";

const BRICKS_PER_CORRECT = 5;
const SPEND_COST = 5;
const SPEND_LAVA_REDUCTION = 2; // % lava per spend
const WRONG_PENALTY = 1;        // % lava per wrong answer

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

const LavaFloorGame = ({ sessionId, studentId }: Props) => {
  const navigate = useNavigate();
  const [session, setSession]     = useState<any>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [me, setMe]               = useState<any>(null);
  const [phase, setPhase]         = useState<Phase>("waiting");
  const [currentQ, setCurrentQ]   = useState<Q | null>(null);
  const [picked, setPicked]       = useState<number | null>(null);
  const [timeLeft, setTimeLeft]   = useState(20);
  const [qSeed, setQSeed]         = useState(0);
  const [displayLava, setDisplayLava] = useState(0);
  const [spendFlash, setSpendFlash]   = useState(false);

  const qStartRef  = useRef(Date.now());
  const askedRef   = useRef(0);
  const pickedRef  = useRef<number | null>(null);

  const settings  = session?.settings ?? {};
  const bricks    = me?.crypto ?? 0;
  const lavaWon   = settings.lavaWon;

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from("game_sessions").select("*, quizzes(id,title)").eq("id", sessionId).maybeSingle();
      setSession(s);
      if (s?.quiz_id) {
        const { data: qs } = await supabase.from("questions").select("*").eq("quiz_id", s.quiz_id).order("position");
        setQuestions((qs ?? []).map((q: any) => ({ ...q, options: Array.isArray(q.options) ? q.options : [] })));
      }
      const { data: ss } = await supabase.from("game_students").select("*").eq("session_id", sessionId);
      setMe((ss ?? []).find((x: any) => x.id === studentId) ?? null);
    })();
  }, [sessionId, studentId]);

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel(`lf-game-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_sessions", filter: `id=eq.${sessionId}` },
        (p: any) => setSession((prev: any) => ({ ...prev, ...p.new })))
      .on("postgres_changes", { event: "*", schema: "public", table: "game_students", filter: `session_id=eq.${sessionId}` },
        async () => {
          const { data: ss } = await supabase.from("game_students").select("*").eq("session_id", sessionId);
          const m = (ss ?? []).find((x: any) => x.id === studentId);
          if (m) setMe(m);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, studentId]);

  // ── Status sync ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    if (session.status === "lobby")      setPhase("waiting");
    else if (session.status === "finished") setPhase("done");
    else if (session.status === "running")
      setPhase(prev => prev === "waiting" ? "question" : prev);
  }, [session?.status]);

  // ── Lava interpolation ────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => {
      if (!session || session.status !== "running") return;
      const base    = settings.lavaLevel ?? 0;
      const snapAt  = settings.lavaSnapshotAt;
      const rate    = settings.lavaRate ?? 0.08;
      if (!snapAt) { setDisplayLava(base); return; }
      const elapsed = (Date.now() - new Date(snapAt).getTime()) / 1000;
      setDisplayLava(Math.min(100, base + rate * elapsed));
    }, 300);
    return () => clearInterval(t);
  }, [session?.settings?.lavaLevel, session?.settings?.lavaSnapshotAt, session?.settings?.lavaRate, session?.status]);

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

  // ── Countdown ─────────────────────────────────────────────────────────────
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

  // ── Answer handler ────────────────────────────────────────────────────────
  const handleAnswer = useCallback((idx: number) => {
    if (!currentQ || !me) return;
    if (pickedRef.current !== null) return;
    pickedRef.current = idx;

    const correct = idx === currentQ.correct_index;
    setPicked(idx);
    setTimeout(() => setPhase("answered"), 700);

    const updates: any = { total_answers: (me.total_answers ?? 0) + 1 };
    if (correct) {
      updates.correct_answers = (me.correct_answers ?? 0) + 1;
      updates.crypto = (me.crypto ?? 0) + BRICKS_PER_CORRECT;
    } else {
      // Signal wrong answer penalty to monitor via hacks_received (repurposed as wrong_penalty_count)
      updates.hacks_received = (me.hacks_received ?? 0) + 1;
    }
    supabase.from("game_students").update(updates).eq("id", me.id).catch(() => {});

    supabase.from("question_responses").insert({
      session_id: sessionId, student_id: me.id, question_id: currentQ.id,
      question_index: askedRef.current, answer_index: idx, is_correct: correct,
    }).catch(() => {});
  }, [currentQ, me, sessionId]);

  const submit = (idx: number) => { if (pickedRef.current !== null) return; handleAnswer(idx); };

  // ── Spend bricks ──────────────────────────────────────────────────────────
  const spendBricks = () => {
    if (!me || bricks < SPEND_COST) return;
    // Deduct bricks, increment hacks_made (monitor reads this as "bricks spent signal")
    supabase.from("game_students").update({
      crypto: Math.max(0, bricks - SPEND_COST),
      hacks_made: (me.hacks_made ?? 0) + SPEND_COST,
    }).eq("id", me.id).catch(() => {});
    setSpendFlash(true);
    setTimeout(() => setSpendFlash(false), 600);
  };

  const lavaColor = displayLava > 75 ? "#c0392b" : displayLava > 45 ? "#e67e22" : "#e74c3c";
  const lavaHeight = `${Math.min(100, displayLava)}%`;

  return (
    <div className="theme-lavafloor min-h-[100dvh] bg-background text-foreground font-mono flex flex-col overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 50% 100%, hsl(14 60% 10%) 0%, hsl(0 0% 6%) 60%)" }}>

      {/* Lava bar — top strip showing class danger level */}
      <div className="relative h-3 w-full bg-muted overflow-hidden shrink-0">
        <div className="absolute inset-y-0 left-0 lava-fill lava-fill-anim transition-all duration-700"
          style={{ width: lavaHeight, opacity: session?.status === "running" ? 1 : 0.3 }} />
        {displayLava > 80 && (
          <div className="absolute inset-0 animate-pulse" style={{ background: "hsl(14 100% 55% / 0.3)" }} />
        )}
      </div>

      {/* Header */}
      <header className="relative flex items-center justify-between px-4 py-3 border-b border-primary/25 sticky top-0 bg-background/80 backdrop-blur-sm z-10">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar name={me?.name ?? "?"} size="sm" />
          <span className="text-sm font-bold truncate text-foreground">{me?.name ?? "—"}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-muted-foreground">
            {Math.round(displayLava)}% <span className="text-primary">lava</span>
          </div>
          <div className="flex items-center gap-1 text-success font-black tabular-nums text-base">
            <Shield className="h-4 w-4" />
            {bricks}
          </div>
        </div>
      </header>

      <main className="relative flex-1 px-4 pb-6 flex flex-col">

        {/* WAITING */}
        {phase === "waiting" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
            <Avatar name={me?.name ?? "?"} size="xl" />
            <div className="text-xl text-primary animate-pulse">{"> بانتظار المعلّم..."}</div>
          </div>
        )}

        {/* DONE */}
        {phase === "done" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
            {lavaWon !== false ? (
              <>
                <Trophy className="h-20 w-20 text-success" style={{ filter: "drop-shadow(0 0 20px hsl(142 65% 42%))" }} />
                <h2 className="text-3xl font-black text-success text-glow-green">نجح الفصل!</h2>
                <p className="text-muted-foreground">صمدتم معاً حتى انتهى الوقت</p>
              </>
            ) : (
              <>
                <Skull className="h-20 w-20 text-primary" style={{ filter: "drop-shadow(0 0 20px hsl(14 100% 55%))" }} />
                <h2 className="text-3xl font-black text-primary text-glow-lava">ابتلعتكم الحمم</h2>
                <p className="text-muted-foreground">حاولوا أكثر المرة القادمة</p>
              </>
            )}
            <p className="text-muted-foreground text-sm">
              {me?.correct_answers ?? 0} إجابة صحيحة · {bricks} طوب مكتسب
            </p>
            <Button onClick={() => navigate("/play")} className="mt-2 bg-primary text-primary-foreground">خروج</Button>
          </div>
        )}

        {/* QUESTION */}
        {(phase === "question" || phase === "answered") && currentQ && (
          <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full pt-3">

            <div className="border-2 border-primary/40 bg-primary/5 px-4 py-5 text-center rounded-xl mb-3">
              {currentQ.image_url && (
                <img src={currentQ.image_url} alt="" className="mx-auto mb-3 max-h-36 rounded-lg border border-primary/30" />
              )}
              <p className="text-xl md:text-2xl text-foreground font-bold leading-relaxed">{currentQ.text}</p>
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
                      "min-h-[90px] px-3 py-4 text-center text-base font-bold border-2 transition-all rounded-xl active:scale-[0.97]",
                      "border-primary/40 bg-primary/8 text-foreground hover:bg-primary/18",
                      show && isCorrect  && "bg-green-800/70 border-green-500 text-white",
                      show && isPicked && !isCorrect && "bg-red-900/70 border-red-500 text-white",
                      show && !isPicked && !isCorrect && "opacity-25"
                    )}>
                    {opt}
                  </button>
                );
              })}
            </div>

            {/* Spend bricks button */}
            {phase === "question" && (
              <button
                onClick={spendBricks}
                disabled={bricks < SPEND_COST}
                className={cn(
                  "mt-3 w-full h-12 rounded-xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.97]",
                  spendFlash
                    ? "border-success bg-success/20 text-success"
                    : bricks >= SPEND_COST
                      ? "border-success/60 bg-success/10 text-success hover:bg-success/20"
                      : "border-border/30 bg-muted/10 text-muted-foreground/40 cursor-not-allowed"
                )}>
                <Shield className="h-4 w-4" />
                {bricks >= SPEND_COST
                  ? `أنفق ${SPEND_COST} طوب ← حمم -${SPEND_LAVA_REDUCTION}%`
                  : `تحتاج ${SPEND_COST} طوب (لديك ${bricks})`
                }
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default LavaFloorGame;
