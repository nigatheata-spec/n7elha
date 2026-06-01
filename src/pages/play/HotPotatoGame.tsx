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

  const qStartRef    = useRef(Date.now());
  const askedRef     = useRef(0);
  const pickedRef    = useRef<number | null>(null);
  const passedRef    = useRef(false);
  const lastExplosionAtRef = useRef<string | null>(null);
  const passTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const settings   = session?.settings ?? {};
  const hasBomb    = settings.bombHolderId === studentId;
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

  // ── Auto-advance after exploded ───────────────────────────────────────────
  useEffect(() => {
    if (phase !== "exploded") return;
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
      }).eq("id", me.id).catch(() => {});

      if (hasBomb) {
        // Pick 3 random pass targets
        const others = students.filter(s => s.id !== studentId);
        const shuffled = [...others].sort(() => Math.random() - 0.5).slice(0, 3);
        setPassTargets(shuffled);
        setTimeout(() => setPhase("passing"), 600);
      } else {
        setTimeout(() => setPhase("answered"), 700);
      }
    } else {
      supabase.from("game_students").update({
        total_answers: (me.total_answers ?? 0) + 1,
      }).eq("id", me.id).catch(() => {});
      setTimeout(() => setPhase("answered"), 700);
    }

    supabase.from("question_responses").insert({
      session_id: sessionId, student_id: me.id, question_id: currentQ.id,
      question_index: askedRef.current, answer_index: idx, is_correct: correct,
    }).catch(() => {});
  }, [currentQ, me, hasBomb, students, studentId, sessionId]);

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
      .eq("id", sessionId).catch(() => {});
    setTimeout(() => { setQSeed(s => s + 1); setPhase("question"); }, 300);
  };

  const fmt = (n: number) => n.toLocaleString();
  const points = me?.crypto ?? 0;

  return (
    <div className="theme-hotpotato min-h-[100dvh] bg-background text-foreground font-mono flex flex-col overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 40% 0%, hsl(0 0% 13%) 0%, hsl(0 0% 6%) 100%)" }}>
      <div className="pointer-events-none fixed inset-0 opacity-10"
        style={{ backgroundImage: "repeating-linear-gradient(0deg,hsl(0 0% 0%/0.5) 0px,hsl(0 0% 0%/0.5) 1px,transparent 1px,transparent 4px)" }} />

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
        {phase === "done" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
            <Trophy className="h-20 w-20 text-success" style={{ filter: "drop-shadow(0 0 20px hsl(45 100% 55%))" }} />
            <h2 className="text-3xl font-black text-primary">انتهت اللعبة</h2>
            <p className="text-success text-2xl font-black tabular-nums">{fmt(points)} نقطة</p>
            <Button onClick={() => navigate("/play")} className="mt-4 bg-primary text-primary-foreground">خروج</Button>
          </div>
        )}

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
          <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full pt-3">

            {hasBomb && phase === "question" && (
              <div className="flex items-center gap-2 justify-center mb-3 px-3 py-2 rounded-xl bg-primary/15 border border-primary/40 text-primary font-bold text-sm animate-pulse">
                <BombIcon className="h-5 w-5" />
                لديك القنبلة — أجب صح لتمررها
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
                  className="rounded-xl border-2 border-primary/50 bg-primary/10 hover:bg-primary/25 hover:border-primary p-4 flex items-center gap-3 transition-all active:scale-[0.97]">
                  <Avatar name={target.name} size="md" />
                  <span className="text-primary font-bold text-base flex-1 text-left">{target.name}</span>
                  <span className="text-success font-black tabular-nums text-sm">{fmt(target.crypto ?? 0)}</span>
                  <BombIcon className="h-5 w-5 text-primary/60" />
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
