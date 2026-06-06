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

// Bomb SVG icon
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
  const sessionStatusRef = useRef<string>("lobby");

  const settings        = session?.settings ?? {};
  const hasBomb         = settings.bombHolderId === studentId;
  const bombExplodesAt  = settings.bombExplodesAt as string | null;
  const fuseMs          = bombExplodesAt ? Math.max(0, new Date(bombExplodesAt).getTime() - now) : 0;
  const fusePct         = bombExplodesAt ? Math.min(100, (fuseMs / 90_000) * 100) : 100;
  const fuseColor       = fuseMs > 30_000 ? "hsl(142 70% 52%)" : fuseMs > 10_000 ? "hsl(38 90% 55%)" : "hsl(0 85% 58%)";
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
    sessionStatusRef.current = session.status;
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
    const t = setTimeout(() => {
      if (sessionStatusRef.current === "finished") return;
      setQSeed(s => s + 1); setPhase("question");
    }, 2200);
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
      if (left <= 0 && pickedRef.current === null) { clearInterval(t); if (sessionStatusRef.current !== "finished") handleAnswer(-1); }
    }, 200);
    return () => clearInterval(t);
  }, [phase, currentQ, duration]);

  // ── Auto-advance after answered ───────────────────────────────────────────
  useEffect(() => {
    if (phase !== "answered") return;
    const t = setTimeout(() => {
      if (sessionStatusRef.current === "finished") return;
      setQSeed(s => s + 1); setPhase("question");
    }, 1500);
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
            setTimeout(() => { if (sessionStatusRef.current !== "finished") { setQSeed(s => s + 1); setPhase("question"); } }, 200);
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
        setTimeout(() => { if (sessionStatusRef.current !== "finished") setPhase("passing"); }, 600);
      } else {
        setTimeout(() => { if (sessionStatusRef.current !== "finished") setPhase("answered"); }, 700);
      }
    } else {
      supabase.from("game_students").update({
        total_answers: (me.total_answers ?? 0) + 1,
      }).eq("id", me.id).then(undefined, () => {});
      setTimeout(() => { if (sessionStatusRef.current !== "finished") setPhase("answered"); }, 700);
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
    setTimeout(() => { if (sessionStatusRef.current !== "finished") { setQSeed(s => s + 1); setPhase("question"); } }, 300);
  };

  const fmt = (n: number) => n.toLocaleString();
  const points = me?.crypto ?? 0;

  const dangerAlpha  = hasBomb ? ((1 - fusePct / 100) * 0.45).toFixed(2) : "0";
  const dangerSpread = hasBomb ? 50 + (1 - fusePct / 100) * 80 : 0;

  // Shared metal panel style
  const metalPanel = {
    background: "linear-gradient(180deg, hsl(210 20% 14%), hsl(210 18% 10%))",
    border: "1.5px solid hsl(210 20% 22%)",
    boxShadow: "inset 0 1.5px 0 hsl(210 18% 30%), inset 0 -1px 0 hsl(210 15% 6%), 0 6px 20px hsl(0 0% 0% / 0.45)",
  };

  return (
    <div className="theme-hotpotato fixed inset-0 overflow-hidden text-foreground font-mono"
      style={{
        background: "radial-gradient(ellipse at 30% 10%, hsl(210 28% 11%) 0%, hsl(210 22% 7%) 55%, hsl(210 18% 5%) 100%)",
        boxShadow: hasBomb ? `inset 0 0 ${dangerSpread}px hsl(0 85% 40% / ${dangerAlpha})` : "none",
      }}>
      {/* PCB circuit board trace — background texture only, panels are solid */}
      <div className="pcb-trace-bg pointer-events-none absolute inset-0" style={{ zIndex: 0 }} />

      {/* Explosion flash */}
      {showFlash && (
        <>
          <div className="pointer-events-none absolute inset-0 z-50 animate-screen-flash"
            style={{ background: "radial-gradient(ellipse at center, hsl(210 10% 90%) 0%, hsl(210 15% 50%) 60%, transparent 100%)" }} />
          <div className="pointer-events-none absolute z-[51] rounded-full animate-shockwave"
            style={{ top: "50%", left: "50%", width: 80, height: 80, transform: "translate(-50%,-50%)", border: "3px solid hsl(210 10% 75%)" }} />
        </>
      )}

      {/* Shake wrapper */}
      <div className={cn("relative z-10 flex flex-col h-full overflow-y-auto", hasBomb && fuseMs < 5_000 && "animate-screen-shake")}>

        {/* ── HEADER — metal panel ── */}
        <header className="relative shrink-0 flex items-center justify-between px-5 py-3 safe-top z-10"
          style={{ ...metalPanel, borderRadius: 0, borderLeft: "none", borderRight: "none", borderTop: "none" }}>
          <div className="flex items-center gap-2 min-w-0">
            {hasBomb && <BombIcon className="h-5 w-5 shrink-0" style={{ color: fuseColor }} />}
            <span className="text-sm font-bold truncate" style={{ color: "hsl(210 10% 80%)" }}>{me?.name ?? "—"}</span>
          </div>
          <div className="flex items-center gap-1.5 font-black tabular-nums text-lg text-success">
            <Zap className="h-4 w-4" />
            {fmt(points)}
          </div>
        </header>

        <main className="flex-1 px-4 pb-6 safe-bottom flex flex-col overflow-y-auto">

          {/* ── WAITING ── */}
          {phase === "waiting" && (
            <div className="max-w-3xl mx-auto w-full py-5 px-1">
              {/* header */}
              <div className="text-center mb-5">
                <BombIcon className="h-10 w-10 mx-auto mb-1.5" style={{ color: "hsl(210 10% 55%)" }} />
                <h1 className="text-2xl font-black tracking-widest" style={{ color: "hsl(210 10% 82%)" }}>PASS IT</h1>
                {session?.quizzes?.title && (
                  <p className="text-muted-foreground/60 text-xs font-mono mt-1 truncate max-w-[240px] mx-auto">{session.quizzes.title}</p>
                )}
              </div>

              {/* counter strip */}
              <div
                className="flex items-center justify-between text-xs font-mono px-3 py-2 mb-3"
                style={{
                  borderTop: "1px solid hsl(210 18% 30%)",
                  borderBottom: "1px solid hsl(210 18% 30%)",
                  color: "hsl(210 10% 55%)",
                }}
              >
                <span className="tracking-widest">PLAYERS_ONLINE</span>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: "hsl(210 10% 70%)" }} />
                  <span className="font-bold tabular-nums text-sm" style={{ color: "hsl(210 10% 85%)" }}>
                    {students.length.toString().padStart(2, "0")}
                  </span>
                </span>
              </div>

              {/* roster grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {students.map((s, i) => {
                  const isMe = s.id === me?.id;
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl transition-all"
                      style={{
                        ...metalPanel,
                        border: `1px solid hsl(210 18% ${isMe ? 42 : 26}%)`,
                        boxShadow: isMe ? "inset 0 1px 0 rgba(255,255,255,0.08), 0 0 14px rgba(255,255,255,0.06)" : (metalPanel as any).boxShadow,
                        animation: `fade-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${Math.min(i * 60, 600)}ms both`,
                      }}
                    >
                      <Avatar name={s.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold truncate font-mono" style={{ color: isMe ? "hsl(210 10% 90%)" : "hsl(210 10% 72%)" }}>
                          {s.name}
                        </div>
                        {isMe && (
                          <div className="font-mono text-[9px]" style={{ color: "hsl(210 10% 55%)" }}>أنت</div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {students.length < 4 && Array.from({ length: 4 - students.length }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl"
                    style={{
                      border: "1px dashed hsl(210 18% 22%)",
                      opacity: 0.5,
                    }}
                  >
                    <div className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center"
                      style={{ background: "hsl(210 18% 14%)", color: "hsl(210 10% 35%)" }}>
                      ?
                    </div>
                    <div className="font-mono text-xs" style={{ color: "hsl(210 10% 30%)" }}>waiting...</div>
                  </div>
                ))}
              </div>

              <p className="mt-6 font-mono text-xs text-center animate-pulse" style={{ color: "hsl(210 10% 45%)" }}>
                {">"} بانتظار المعلّم...
              </p>
            </div>
          )}

          {/* ── DONE ── */}
          {phase === "done" && (() => {
            const sorted = [...students].sort((a, b) => (b.crypto ?? 0) - (a.crypto ?? 0));
            const rank   = sorted.findIndex(s => s.id === studentId) + 1 || sorted.length;
            const medalC = rank === 1 ? "hsl(48 90% 58%)" : rank === 2 ? "hsl(210 18% 68%)" : rank === 3 ? "hsl(25 75% 52%)" : "hsl(210 10% 50%)";
            const top5   = sorted.slice(0, 5);
            const rankLabel = (n: number) => { const s = ["th","st","nd","rd"], v = n%100; return n+(s[(v-20)%10]||s[v]||s[0]); };
            return (
              <div className="flex-1 flex flex-col items-center pt-6 pb-4 px-4 gap-5 overflow-y-auto">
                <div style={{ animation: "result-crash-in 0.55s cubic-bezier(0.34,1.4,0.64,1) both" }} className="text-center">
                  <div className="text-[80px] leading-none font-black tabular-nums" style={{ color: medalC, textShadow: `0 0 50px ${medalC}cc` }}>#{rank}</div>
                  <div className="text-sm font-mono tracking-widest mt-1" style={{ color: medalC }}>{rankLabel(rank)} place</div>
                </div>
                <div className="animate-fade-up text-center" style={{ animationDelay: "0.15s" }}>
                  <div className="text-4xl font-black tabular-nums text-success">{fmt(points)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 tracking-widest">نقطة</div>
                </div>
                <div className="w-full max-w-xs space-y-1.5 animate-fade-up" style={{ animationDelay: "0.3s" }}>
                  {top5.map((s, i) => {
                    const isMe = s.id === studentId;
                    const mc   = i === 0 ? "hsl(48 90% 58%)" : i === 1 ? "hsl(210 18% 68%)" : i === 2 ? "hsl(25 75% 52%)" : "hsl(210 10% 45%)";
                    return (
                      <div key={s.id} className={cn("relative flex items-center gap-3 px-3 py-2.5 rounded-xl", isMe ? "ring-1 ring-white/20" : "")}
                        style={metalPanel}>
                        <span className="font-mono text-sm font-black w-5 text-center shrink-0" style={{ color: mc }}>{i + 1}</span>
                        <span className={cn("flex-1 text-sm font-bold truncate")} style={{ color: isMe ? "hsl(210 10% 88%)" : "hsl(210 10% 68%)" }}>{s.name}</span>
                        <span className="font-mono text-sm tabular-nums text-muted-foreground">{fmt(s.crypto ?? 0)}</span>
                      </div>
                    );
                  })}
                  {rank > 5 && (
                    <>
                      <div className="text-center text-muted-foreground/40 text-xs py-0.5">···</div>
                      <div className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl ring-1 ring-white/20" style={metalPanel}>
                        <span className="font-mono text-sm font-black w-5 text-center shrink-0" style={{ color: "hsl(210 10% 68%)" }}>{rank}</span>
                        <span className="flex-1 text-sm font-bold truncate" style={{ color: "hsl(210 10% 88%)" }}>{me?.name}</span>
                        <span className="font-mono text-sm tabular-nums text-muted-foreground">{fmt(points)}</span>
                      </div>
                    </>
                  )}
                </div>
                <Button onClick={() => navigate("/play")} className="mt-auto px-8 animate-fade-up" style={{ animationDelay: "0.4s" }}>خروج</Button>
              </div>
            );
          })()}

          {/* ── EXPLODED ── */}
          {phase === "exploded" && (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-5 animate-hp-explode">
              <BombIcon className="h-24 w-24" style={{ color: "hsl(0 70% 60%)" }} />
              <h2 className="text-3xl font-black" style={{ color: "hsl(0 70% 65%)", textShadow: "0 0 20px hsl(0 80% 50% / 0.6)" }}>انفجرت!</h2>
              <p className="text-muted-foreground text-base">تم تصفير نقاطك</p>
              <p className="text-muted-foreground/50 text-xs">تعود للعبة الآن...</p>
            </div>
          )}

          {/* ── QUESTION ── */}
          {(phase === "question" || phase === "answered") && currentQ && (
            <div key={qSeed} className="flex-1 flex flex-col max-w-2xl mx-auto w-full pt-3 animate-question-in">

              {/* Bomb holder alert — metal warning panel */}
              {hasBomb && phase === "question" && (
                <div className="relative mb-3 flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{
                  background: "linear-gradient(160deg, hsl(0 30% 13%), hsl(210 20% 11%))",
                  border: "1.5px solid hsl(0 40% 28%)",
                  boxShadow: `inset 0 1px 0 hsl(0 30% 25%), 0 0 ${8 + (1 - fusePct/100) * 14}px hsl(0 80% 40% / ${(0.2 + (1 - fusePct/100) * 0.35).toFixed(2)})`,
                  transition: "box-shadow 0.5s ease",
                }}>
                  <BombIcon className={cn("h-5 w-5 shrink-0", fuseMs < 12_000 && "animate-fuse-critical")} style={{ color: fuseColor }} />
                  <span className="text-sm font-bold flex-1" style={{ color: "hsl(0 60% 72%)" }}>لديك القنبلة</span>
                  <span className="font-mono tabular-nums text-sm font-bold" style={{ color: fuseColor }}>{Math.ceil(fuseMs / 1000)}s</span>
                  {/* Fuse bar */}
                  <div className="absolute bottom-0 inset-x-0 h-[3px] rounded-b-xl overflow-hidden">
                    <div className="h-full transition-all duration-300" style={{ width: `${fusePct}%`, background: `linear-gradient(90deg, ${fuseColor}66, ${fuseColor})` }} />
                  </div>
                </div>
              )}

              {/* Non-bomb: who has it */}
              {!hasBomb && bombHolder && phase === "question" && (
                <div className="relative mb-2 flex items-center gap-2 px-3 py-1.5 rounded-lg" style={metalPanel}>
                  <BombIcon className="h-3.5 w-3.5 shrink-0" style={{ color: "hsl(210 10% 50%)" }} />
                  <span className="flex-1 truncate text-xs font-mono" style={{ color: "hsl(210 10% 58%)" }}>{bombHolder.name} يحمل القنبلة</span>
                  <span className="tabular-nums text-xs font-mono font-bold" style={{ color: fuseColor }}>{Math.ceil(fuseMs / 1000)}s</span>
                </div>
              )}

              {/* Arc timer */}
              <div className="flex justify-center mb-2">
                <svg width="60" height="60" viewBox="0 0 60 60">
                  <circle cx="30" cy="30" r="26" fill="none" stroke="hsl(210 18% 20%)" strokeWidth="3.5" />
                  <circle cx="30" cy="30" r="26" fill="none" stroke="hsl(210 10% 60%)" strokeWidth="3.5"
                    strokeDasharray="163.36" strokeDashoffset={163.36 * (1 - timeLeft / duration)}
                    strokeLinecap="round" transform="rotate(-90 30 30)"
                    style={{ transition: "stroke-dashoffset 0.18s linear" }} />
                  <text x="30" y="35" textAnchor="middle" fill="hsl(210 10% 75%)" fontSize="15" fontWeight="bold" fontFamily="monospace">{timeLeft}</text>
                </svg>
              </div>

              {/* Question card — full metal panel */}
              <div className="relative mb-3 rounded-xl px-5 py-5 text-center" style={metalPanel}>
                {currentQ.image_url && (
                  <img src={currentQ.image_url} alt="" className="mx-auto mb-4 max-h-36 rounded-lg" style={{ border: "1px solid hsl(210 18% 22%)" }} />
                )}
                <p className="text-lg md:text-xl font-bold leading-relaxed" style={{ color: "hsl(210 10% 88%)" }}>{currentQ.text}</p>
              </div>

              {/* Answer buttons */}
              <div className="grid grid-cols-2 gap-2 flex-1">
                {currentQ.options.map((opt, i) => {
                  const isCorrect = i === currentQ.correct_index;
                  const isPicked  = picked === i;
                  const show      = picked !== null;
                  return (
                    <button key={i} disabled={picked !== null} onClick={() => submit(i)}
                      className={cn(
                        "btn-panel min-h-[88px] px-3 py-4 text-center text-base font-bold rounded-xl",
                        show && isCorrect              && "btn-panel-correct animate-answer-correct",
                        show && isPicked && !isCorrect && "btn-panel-wrong animate-answer-wrong",
                        show && !isPicked && !isCorrect && "opacity-20"
                      )}>
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── PASSING ── */}
          {phase === "passing" && (
            <div className="flex-1 flex flex-col pt-4 gap-4 max-w-md mx-auto w-full">
              <div className="text-center">
                <BombIcon className="h-12 w-12 mx-auto mb-2" style={{ color: fuseColor }} />
                <h2 className="text-xl font-black" style={{ color: "hsl(210 10% 82%)" }}>مرّر القنبلة!</h2>
                <p className="text-sm text-muted-foreground mt-1">عندك {passSecsLeft}ث — اختر من تعطيها</p>
                <svg className="mx-auto mt-2" width="48" height="48" viewBox="0 0 44 44">
                  <circle cx="22" cy="22" r="20" fill="none" stroke="hsl(210 18% 20%)" strokeWidth="3" />
                  <circle cx="22" cy="22" r="20" fill="none" stroke="hsl(210 10% 60%)" strokeWidth="3"
                    strokeDasharray="126" strokeDashoffset={126 - (passSecsLeft / PASS_SECONDS) * 126}
                    strokeLinecap="round" transform="rotate(-90 22 22)"
                    style={{ transition: "stroke-dashoffset 0.9s linear" }} />
                  <text x="22" y="26" textAnchor="middle" fill="hsl(210 10% 72%)" fontSize="13" fontWeight="bold" fontFamily="monospace">{passSecsLeft}</text>
                </svg>
              </div>
              <div className="flex flex-col gap-2.5">
                {passTargets.map(target => (
                  <button key={target.id} onClick={() => passBomb(target.id)}
                    className="relative group btn-panel rounded-xl p-4 flex items-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.97]">
                    <Avatar name={target.name} size="md" />
                    <div className="flex-1 min-w-0 text-left">
                      <div className="font-bold text-base truncate" style={{ color: "hsl(210 10% 82%)" }}>{target.name}</div>
                      <div className="text-success/80 text-xs font-mono tabular-nums">{fmt(target.crypto ?? 0)} pts</div>
                    </div>
                    <BombIcon className="h-6 w-6 shrink-0 opacity-40 group-hover:opacity-90 transition-opacity" style={{ color: fuseColor }} />
                  </button>
                ))}
              </div>
              <p className="text-center text-xs text-muted-foreground/50">إذا لم تختر — تبقى القنبلة معك</p>
            </div>
          )}

        </main>
      </div>
    </div>
  );
};

export default HotPotatoGame;
