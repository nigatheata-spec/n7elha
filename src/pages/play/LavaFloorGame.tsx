import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { PixelShield, PixelFlame } from "@/components/PixelIcons";
import { PixelVolcano } from "@/components/PixelVolcano";
import { PixelLavaCrest, PixelLavaBody } from "@/components/PixelLava";
import { PixelRockCeiling } from "@/components/PixelRockCeiling";
import { playSelect, playCorrect, playWrong, playBrick, playGameOver, primeAudio } from "@/lib/sound";

type Q = { id: string; text: string; options: string[]; correct_index: number; image_url?: string };
type Phase = "waiting" | "question" | "answered" | "done";

const BRICKS_PER_CORRECT = 5;
const SPEND_COST = 5;
const SPEND_LAVA_REDUCTION = 2;

const AV_COLORS = ["#2563eb","#16a34a","#b45309","#dc2626","#7c3aed","#0891b2","#c2410c","#0f766e"];
const av = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return { bg: AV_COLORS[Math.abs(h) % AV_COLORS.length], letter: (name.charAt(0) || "?").toUpperCase() };
};
const Avatar = ({ name, size = "md" }: { name: string; size?: "sm" | "md" | "xl" }) => {
  const { bg, letter } = av(name);
  const cls = size === "xl" ? "h-16 w-16 text-2xl" : size === "md" ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs";
  return (
    <div style={{ background: bg, borderColor: bg }}
      className={cn("pixel-avatar flex items-center justify-center font-black text-white select-none shrink-0", cls)}>
      {letter}
    </div>
  );
};

// Pre-computed ember positions — stable, no random in render
const EMBERS = [
  { left: 7,  delay: 0,    dur: 1.9, size: 3, bright: true  },
  { left: 19, delay: 0.65, dur: 2.3, size: 2, bright: false },
  { left: 34, delay: 1.15, dur: 1.7, size: 4, bright: true  },
  { left: 49, delay: 0.35, dur: 2.0, size: 2, bright: false },
  { left: 63, delay: 0.9,  dur: 1.8, size: 3, bright: true  },
  { left: 77, delay: 0.2,  dur: 2.4, size: 2, bright: false },
  { left: 89, delay: 1.45, dur: 1.6, size: 3, bright: true  },
];

interface Props { sessionId: string; studentId: string; }

const LavaFloorGame = ({ sessionId, studentId }: Props) => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const [session, setSession]         = useState<any>(null);
  const [questions, setQuestions]     = useState<Q[]>([]);
  const [me, setMe]                   = useState<any>(null);
  const [students, setStudents]       = useState<any[]>([]);
  const [phase, setPhase]             = useState<Phase>("waiting");
  const [currentQ, setCurrentQ]       = useState<Q | null>(null);
  const [picked, setPicked]           = useState<number | null>(null);
  const [timeLeft, setTimeLeft]       = useState(20);
  const [qSeed, setQSeed]             = useState(0);
  const [displayLava, setDisplayLava] = useState(0);
  const [spendFlash, setSpendFlash]   = useState(false);

  const qStartRef  = useRef(Date.now());
  const askedRef   = useRef(0);
  const pickedRef  = useRef<number | null>(null);

  const settings = session?.settings ?? {};
  const bricks   = me?.crypto ?? 0;
  const lavaPct  = Math.min(100, displayLava);
  const danger   = lavaPct > 60;
  const critical = lavaPct > 82;

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    // Prime audio on first user gesture (required by iOS Safari)
    const onFirstTouch = () => { primeAudio(); window.removeEventListener("pointerdown", onFirstTouch); };
    window.addEventListener("pointerdown", onFirstTouch, { once: true });

    (async () => {
      const { data: s } = await supabase.from("game_sessions").select("*, quizzes(id,title)").eq("id", sessionId).maybeSingle();
      setSession(s);
      if (s?.quiz_id) {
        const { data: qs } = await supabase.from("questions").select("*").eq("quiz_id", s.quiz_id).order("position");
        setQuestions((qs ?? []).map((q: any) => ({ ...q, options: Array.isArray(q.options) ? q.options : [] })));
      }
      const { data: ss } = await supabase.from("game_students").select("*").eq("session_id", sessionId);
      const sorted = (ss ?? []).sort((a: any, b: any) => (b.crypto ?? 0) - (a.crypto ?? 0));
      setStudents(sorted);
      setMe(sorted.find((x: any) => x.id === studentId) ?? null);
    })();

    return () => { window.removeEventListener("pointerdown", onFirstTouch); };
  }, [sessionId, studentId]);

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel(`lf-game-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_sessions", filter: `id=eq.${sessionId}` },
        (p: any) => setSession((prev: any) => ({ ...prev, ...p.new })))
      .on("postgres_changes", { event: "*", schema: "public", table: "game_students", filter: `session_id=eq.${sessionId}` },
        async () => {
          const { data: ss } = await supabase.from("game_students").select("*").eq("session_id", sessionId);
          const sorted = (ss ?? []).sort((a: any, b: any) => (b.crypto ?? 0) - (a.crypto ?? 0));
          setStudents(sorted);
          const m = sorted.find((x: any) => x.id === studentId);
          if (m) setMe(m);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, studentId]);

  // ── Status sync ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    if (session.status === "lobby")          setPhase("waiting");
    else if (session.status === "finished")  setPhase("done");
    else if (session.status === "running")
      setPhase(prev => prev === "waiting" ? "question" : prev);
    else if (session.status === "cancelled") {
      const arLang = (session.settings?.lang ?? i18n.language) === "ar";
      toast.error(arLang ? "أغلق المعلّم الردهة" : "The teacher closed the lobby");
      navigate("/play");
    }
  }, [session?.status]);

  // Play game-over fanfare once when teacher ends the session
  useEffect(() => {
    if (phase === "done") playGameOver();
  }, [phase]);

  // ── Lava interpolation ────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => {
      if (!session || session.status !== "running") return;
      const base   = settings.lavaLevel ?? 0;
      const snapAt = settings.lavaSnapshotAt;
      const rate   = settings.lavaRate ?? 0.08;
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
    playSelect();
    if (correct) { playCorrect(); playBrick(); } else playWrong();
    setPicked(idx);
    setTimeout(() => setPhase("answered"), 700);
    const updates: any = { total_answers: (me.total_answers ?? 0) + 1 };
    if (correct) {
      updates.correct_answers = (me.correct_answers ?? 0) + 1;
      updates.crypto = (me.crypto ?? 0) + BRICKS_PER_CORRECT;
    } else {
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
    if (!me || bricks < SPEND_COST || phase !== "question") return;
    supabase.from("game_students").update({
      crypto: Math.max(0, bricks - SPEND_COST),
      hacks_made: (me.hacks_made ?? 0) + SPEND_COST,
    }).eq("id", me.id).then(undefined, () => {});
    setSpendFlash(true);
    setTimeout(() => setSpendFlash(false), 600);
  };

  // Derived visual values
  const timerFrac    = timeLeft / duration;
  const timerColor   = timerFrac > 0.5 ? "#e67e22" : timerFrac > 0.25 ? "#e74c3c" : "#ff3322";
  const glowStrength = Math.min(1, lavaPct / 55); // 0→1 as lava rises
  const ar = (session?.settings?.lang ?? i18n.language) === "ar";

  return (
    <div className="theme-lavafloor fixed inset-0 text-foreground overflow-hidden"
      style={{ fontFamily: "'JetBrains Mono', monospace", background: "#0A0610",
        boxShadow: danger ? `inset 0 0 ${critical ? 80 : 40}px hsl(14 100% ${critical ? 45 : 35}% / ${critical ? 0.6 : 0.35})` : "none",
        transition: "box-shadow 0.8s ease" }}>

      {/* ── CAVE ROCK CEILING — static pixel-art background ──────────── */}
      <PixelRockCeiling className="absolute inset-0" />

      {/* ── SPEND BRICKS — fixed floating button, never affects layout ── */}
      {(() => {
        const canSpend = bricks >= SPEND_COST && phase === "question";
        const fillPct  = Math.min(100, (bricks / SPEND_COST) * 100);
        const btnColor = canSpend
          ? (spendFlash ? "hsl(142 60% 45%)" : "hsl(142 45% 35%)")
          : "hsl(0 0% 22%)";
        return (
          <button
            onClick={spendBricks}
            disabled={!canSpend}
            className="fixed right-3 z-30 flex flex-col items-center gap-1 rounded-2xl px-3 py-2.5 transition-all active:scale-95"
            style={{
              top: "50%", transform: "translateY(-50%)",
              background: canSpend ? (spendFlash ? "hsl(142 55% 12%)" : "hsl(142 40% 8%)") : "hsl(0 0% 7%)",
              border: `2px solid ${btnColor}`,
              color: canSpend ? "hsl(142 65% 60%)" : "hsl(0 0% 32%)",
              minWidth: 56,
              cursor: canSpend ? "pointer" : "default",
              transition: "background 0.25s, border-color 0.25s, color 0.25s",
            }}>
            <PixelShield className="h-5 w-5 shrink-0" color="currentColor" />
            {/* Brick progress */}
            <div className="pixel-progress w-full" style={{ height: 4, borderColor: canSpend ? "hsl(142 55% 45%)" : "hsl(0 0% 30%)", background: "hsl(0 0% 15%)" }}>
              <div className="pixel-progress-fill"
                style={{ width: `${fillPct}%`, background: canSpend ? "hsl(142 55% 45%)" : "hsl(0 0% 30%)" }} />
            </div>
            <span className="text-[10px] font-black tabular-nums leading-none">{bricks}/{SPEND_COST}</span>
            {canSpend && (
              <span className="text-[9px] font-bold leading-none opacity-80">−{SPEND_LAVA_REDUCTION}%</span>
            )}
          </button>
        );
      })()}

      {/* ── RISING LAVA BODY (GPU: transform translateY) ──────────────── */}
      <div className="absolute inset-x-0 bottom-0 h-full pointer-events-none"
        style={{ transform: `translateY(${100 - lavaPct}%)`, transition: "transform 0.55s cubic-bezier(0.25,0.46,0.45,0.94)", willChange: "transform" }}>

        <PixelLavaCrest className="absolute inset-x-0 -top-16 h-16" />
        <PixelLavaBody className="absolute inset-0" />
      </div>

      {/* ── EMBER PARTICLES (rise from surface) ──────────────────────── */}
      {lavaPct > 4 && EMBERS.map((e, i) => (
        <div key={i} className="absolute pointer-events-none rounded-full"
          style={{
            left: `${e.left}%`,
            bottom: `${Math.max(0, lavaPct - 1)}%`,
            width:  `${e.size}px`,
            height: `${e.size}px`,
            background: e.bright ? "#ff9500" : "#ffdd44",
            boxShadow: `0 0 ${e.size * 2}px ${e.bright ? "#ff7700" : "#ffaa00"}`,
            animation: `ember-float ${e.dur}s ease-out ${e.delay}s infinite`,
          }} />
      ))}

      {/* ── LAVA HEAT GLOW — floods upward into content ───────────────── */}
      <div className="absolute inset-x-0 pointer-events-none transition-all duration-500"
        style={{
          bottom: 0,
          height: `${Math.min(55, lavaPct * 0.75)}%`,
          background: "linear-gradient(to top, hsl(14 90% 18% / 0.65), hsl(14 80% 10% / 0.2), transparent)",
          opacity: lavaPct > 5 ? 1 : 0,
        }} />

      {/* ── DANGER FLICKER overlay ────────────────────────────────────── */}
      {critical && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "hsl(0 90% 45% / 0.06)", animation: "heat-flicker 1.2s ease-in-out infinite" }} />
      )}

      {/* ── CONTENT LAYER ─────────────────────────────────────────────── */}
      <div className="absolute inset-0 flex flex-col" style={{ zIndex: 2 }}>

        {/* HEADER */}
        <header className="shrink-0 flex items-center justify-between px-4 py-2.5 safe-top"
          style={{
            borderBottom: `1px solid hsl(14 ${danger ? 90 : 40}% ${danger ? 40 : 20}% / ${danger ? 0.55 : 0.3})`,
            background: "hsl(0 0% 4% / 0.9)",
            backdropFilter: "blur(10px)",
            transition: "border-color 0.4s",
          }}>
          <div className="flex items-center gap-2 min-w-0">
            <Avatar name={me?.name ?? "?"} size="sm" />
            <span className="text-sm font-bold truncate" style={{ color: "hsl(30 18% 82%)" }}>
              {me?.name ?? "—"}
            </span>
          </div>

          {/* Danger label — always in DOM, visibility toggled to prevent layout shift */}
          <div className="flex items-center gap-1 text-[10px] font-black tracking-[0.35em] uppercase"
            style={{ color: "hsl(14 72% 62%)", animation: danger ? "heat-flicker 0.7s ease-in-out infinite" : "none", visibility: danger ? "visible" : "hidden" }}>
            <PixelFlame className="h-3 w-3" color="currentColor" />
            {ar ? (critical ? "حرج" : "خطر") : (critical ? "CRITICAL" : "DANGER")}
          </div>

          {/* Bricks */}
          <div className="flex items-center gap-1.5 shrink-0">
            <PixelShield className="h-3.5 w-3.5" color="hsl(33 78% 58%)" />
            <span className="font-black tabular-nums text-sm" style={{ color: "hsl(33 78% 64%)" }}>{bricks}</span>
          </div>
        </header>

        {/* LAVA LEVEL STRIP */}
        <div className="shrink-0 relative h-1.5 w-full overflow-hidden" style={{ background: "hsl(0 0% 7%)" }}>
          <div className="absolute inset-y-0 left-0 lava-fill transition-all duration-500"
            style={{ width: `${lavaPct}%` }} />
          {lavaPct > 0 && (
            <div className="absolute inset-y-0 right-0 flex items-center pe-2">
              <span className="text-[8px] font-black tabular-nums" style={{ color: danger ? "hsl(14 72% 62%)" : "hsl(14 60% 50%)" }}>
                {Math.round(lavaPct)}%
              </span>
            </div>
          )}
        </div>

        {/* MAIN */}
        <main className="flex-1 flex flex-col px-3 py-3 pb-safe overflow-hidden min-h-0">

          {/* WAITING */}
          {phase === "waiting" && (
            <div className="max-w-3xl mx-auto w-full py-4 px-1 overflow-y-auto">
              {/* header */}
              <div className="text-center mb-5">
                <div className="text-[10px] tracking-[0.55em] uppercase mb-2" style={{ color: "hsl(14 60% 50%)" }}>
                  {ar ? "الأرضية حمم" : "THE FLOOR IS LAVA"}
                </div>
                <Avatar name={me?.name ?? "?"} size="xl" />
                <div className="font-black text-base tracking-tight mt-2" style={{ color: "hsl(30 18% 85%)" }}>
                  {me?.name ?? "—"}
                </div>
              </div>

              {/* counter strip */}
              <div
                className="flex items-center justify-between text-xs font-mono px-3 py-2 mb-3"
                style={{
                  borderTop: "1px solid hsl(14 50% 35%)",
                  borderBottom: "1px solid hsl(14 50% 35%)",
                  color: "hsl(14 50% 60%)",
                }}
              >
                <span className="tracking-widest">{ar ? "الناجون" : "SURVIVORS"}</span>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: "hsl(14 72% 52%)" }} />
                  <span className="font-bold tabular-nums text-sm" style={{ color: "hsl(30 80% 75%)" }}>
                    {students.length.toString().padStart(2, "0")}
                  </span>
                </span>
              </div>

              {/* roster grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {students.map((s, i) => {
                  const isMe = s.id === studentId;
                  return (
                    <div
                      key={s.id}
                      className="pixel-panel flex items-center gap-2.5 p-2 transition-all"
                      style={{
                        background: isMe ? "hsl(14 72% 52% / 0.14)" : "hsl(14 60% 35% / 0.10)",
                        borderColor: `hsl(14 72% 52% / ${isMe ? 0.55 : 0.25})`,
                        animation: `fade-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${Math.min(i * 60, 600)}ms both`,
                      }}
                    >
                      <Avatar name={s.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold truncate" style={{ color: isMe ? "hsl(30 62% 80%)" : "hsl(30 18% 75%)" }}>
                          {s.name}
                        </div>
                        {isMe && (
                          <div className="font-mono text-[9px]" style={{ color: "hsl(14 80% 65%)" }}>{ar ? "أنت" : "you"}</div>
                        )}
                      </div>
                      {isMe && <PixelFlame className="h-3.5 w-3.5 shrink-0" color="hsl(14 72% 62%)" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* DONE */}
          {phase === "done" && (() => {
            const myRank  = students.findIndex(s => s.id === studentId) + 1 || 1;
            const total   = students.length || 1;
            const top3    = students.slice(0, 3);
            const survived = myRank <= 3;
            const verdict = ar
              ? (myRank === 1 ? "سيد البركان" : survived ? "نجوت من الحمم" : "التهمتك الحمم")
              : (myRank === 1 ? "VOLCANO MASTER" : survived ? "ESCAPED THE LAVA" : "CONSUMED BY LAVA");
            const subtitle = ar
              ? (myRank === 1 ? "تحدّيت الحمم" : survived ? "نجوت من الحريق" : "ابتلعتك الحمم")
              : (myRank === 1 ? "YOU DEFIED THE LAVA" : survived ? "YOU SURVIVED THE FIRE" : "THE LAVA GOT YOU");
            const rankColor = myRank === 1 ? "hsl(45 76% 56%)"
              : survived    ? "hsl(30 80% 65%)"
              :               "hsl(14 80% 55%)";
            return (
              <div className="max-w-md mx-auto w-full px-4 py-5 flex flex-col gap-4 overflow-y-auto">
                {/* hero: erupting volcano */}
                <div className="relative flex flex-col items-center pt-2">
                  {/* heat halo */}
                  <div
                    className="absolute top-0 w-44 h-44 rounded-full"
                    style={{
                      background: "radial-gradient(circle, hsl(14 72% 52% / 0.22) 0%, transparent 65%)",
                      animation: "heat-flicker 2s ease-in-out infinite",
                    }}
                  />
                  <div
                    className="relative"
                    style={{
                      color: rankColor,
                      animation: "fade-up 0.6s cubic-bezier(0.34,1.4,0.64,1) both",
                    }}
                  >
                    <PixelVolcano size={120} />
                  </div>
                  <div className="text-center mt-3">
                    <div
                      className="text-2xl md:text-3xl font-black tracking-tight"
                      style={{ color: rankColor }}
                    >
                      {verdict}
                    </div>
                    <div className="text-xs mt-1.5 tracking-[0.3em]" style={{ color: "hsl(30 30% 60%)" }}>
                      {ar ? subtitle : subtitle.toUpperCase()}
                    </div>
                  </div>
                </div>

                {/* rank tile */}
                <div
                  className="pixel-panel p-4 flex items-center gap-4"
                  style={{
                    background: `${rankColor}10`,
                    borderColor: `${rankColor}`,
                  }}
                >
                  <div className="flex flex-col items-center justify-center min-w-[3.5rem]">
                    <div className="text-3xl font-pixel font-black tabular-nums leading-none" style={{ color: rankColor }}>
                      #{myRank}
                    </div>
                    <div className="text-[9px] tracking-widest mt-1" style={{ color: "hsl(30 25% 55%)" }}>
                      {ar ? `من ${total}` : `OF ${total}`}
                    </div>
                  </div>
                  <div className="h-12 w-px" style={{ background: `${rankColor}30` }} />
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[9px] tracking-widest" style={{ color: "hsl(30 25% 55%)" }}>{ar ? "الطوب" : "BRICKS"}</div>
                      <div className="flex items-center gap-1">
                        <PixelShield className="h-3.5 w-3.5" color="hsl(33 78% 58%)" />
                        <span className="text-xl font-black tabular-nums" style={{ color: "hsl(33 78% 66%)" }}>{bricks}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] tracking-widest" style={{ color: "hsl(30 25% 55%)" }}>{ar ? "صحيح" : "CORRECT"}</div>
                      <div className="text-xl font-black tabular-nums" style={{ color: "hsl(142 50% 62%)" }}>
                        {me?.correct_answers ?? 0}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Survivor stack — top 3 + you */}
                {total > 1 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] tracking-[0.3em] uppercase pb-1 text-center" style={{ color: "hsl(30 30% 55%)" }}>
                      {ar ? "━ الناجون ━" : "━ SURVIVORS ━"}
                    </div>
                    {top3.map((s: any, i: number) => {
                      const mc = i === 0 ? "hsl(45 76% 56%)" : i === 1 ? "hsl(220 12% 76%)" : "hsl(24 70% 56%)";
                      const isMe = s.id === studentId;
                      return (
                        <div
                          key={s.id}
                          className="pixel-panel flex items-center gap-2.5 px-3 py-2"
                          style={{
                            background: isMe ? `${mc}18` : "hsl(14 35% 9%)",
                            borderColor: isMe ? `${mc}` : "hsl(14 25% 18%)",
                          }}
                        >
                          <span className="font-black text-sm w-5 tabular-nums text-center" style={{ color: mc }}>{i + 1}</span>
                          <Avatar name={s.name} size="sm" />
                          <span className="flex-1 text-sm font-bold truncate" style={{ color: isMe ? "hsl(30 35% 88%)" : "hsl(30 18% 72%)" }}>
                            {s.name}{isMe && " ←"}
                          </span>
                          <PixelFlame className="h-3.5 w-3.5" color={i === 0 ? mc : "hsl(14 60% 45%)"} />
                          <span className="text-sm font-black tabular-nums" style={{ color: "hsl(33 78% 62%)" }}>{s.crypto ?? 0}</span>
                        </div>
                      );
                    })}
                    {myRank > 3 && (
                      <>
                        <div className="text-center text-xs" style={{ color: "hsl(14 30% 30%)" }}>···</div>
                        <div
                          className="pixel-panel flex items-center gap-2.5 px-3 py-2"
                          style={{ background: `${rankColor}18`, borderColor: `${rankColor}` }}
                        >
                          <span className="font-black text-sm w-5 tabular-nums text-center" style={{ color: rankColor }}>{myRank}</span>
                          <Avatar name={me?.name ?? "?"} size="sm" />
                          <span className="flex-1 text-sm font-bold truncate" style={{ color: "hsl(30 35% 88%)" }}>{me?.name} ←</span>
                          <PixelFlame className="h-3.5 w-3.5" color={rankColor} />
                          <span className="text-sm font-black tabular-nums" style={{ color: "hsl(33 78% 62%)" }}>{bricks}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <button
                  onClick={() => navigate("/play")}
                  className="pixel-button mt-2 px-6 py-3"
                  style={{
                    background: "hsl(14 72% 52% / 0.15)",
                    borderColor: "hsl(14 72% 52%)",
                    color: "hsl(14 70% 72%)",
                  }}
                >
                  {ar ? "خروج" : "EXIT"}
                </button>
              </div>
            );
          })()}

          {/* QUESTION */}
          {(phase === "question" || phase === "answered") && currentQ && (
            /* pe-[72px] on mobile gives clearance for the fixed spend button on the right */
            <div className="flex-1 flex flex-col gap-2.5 max-w-2xl mx-auto w-full min-h-0 pe-[72px] lg:pe-0">

              {/* Question card */}
              <div className="pixel-panel shrink-0 px-4 py-4 relative"
                style={{
                  background: `hsl(0 0% ${6 + glowStrength * 2}%)`,
                  borderColor: `hsl(14 ${55 + glowStrength * 30}% ${22 + glowStrength * 20}%)`,
                  transition: "border-color 0.4s, background 0.4s",
                }}>
                {currentQ.image_url && (
                  <img
                    src={currentQ.image_url}
                    alt=""
                    className="mx-auto max-h-[24vh] w-auto object-contain mb-3 border-2 border-white/20"
                  />
                )}
                <p className="text-base md:text-lg font-bold leading-snug text-center"
                  style={{ color: "hsl(30 18% 88%)" }}>
                  {currentQ.text}
                </p>

                {/* Timer bar — stepped segments */}
                <div className="pixel-progress mt-3 h-2" style={{ background: "hsl(0 0% 10%)", borderColor: timerColor }}>
                  <div className="pixel-progress-fill"
                    style={{
                      width: `${timerFrac * 100}%`,
                      background: timerColor,
                      transition: "width 0.2s linear, background 0.5s",
                    }} />
                </div>
                <div className="mt-1.5 text-right text-[10px] font-pixel font-black tabular-nums"
                  style={{ color: timerColor, transition: "color 0.5s" }}>
                  {timeLeft}s
                </div>
              </div>

              {/* Answer buttons — obsidian stone platforms */}
              <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
                {currentQ.options.map((opt, i) => {
                  const isCorrect = i === currentQ.correct_index;
                  const isPicked  = picked === i;
                  const show      = picked !== null;

                  let bg          = "hsl(0 0% 7%)";
                  let borderColor = `hsl(14 35% ${18 + glowStrength * 8}% / ${0.5 + glowStrength * 0.3})`;
                  let color       = "hsl(30 14% 80%)";

                  if (show && isCorrect)       { bg = "hsl(142 55% 9%)";  borderColor = "hsl(142 60% 38%)"; color = "hsl(142 80% 72%)"; }
                  else if (show && isPicked)    { bg = "hsl(0 55% 10%)";   borderColor = "hsl(0 65% 48%)";   color = "hsl(0 80% 70%)"; }
                  else if (show && !isCorrect)  { bg = "hsl(0 0% 5%)";     borderColor = "hsl(0 0% 12%)";    color = "hsl(30 8% 35%)"; }

                  return (
                    <button key={i} disabled={picked !== null} onClick={() => submit(i)}
                      className="pixel-button relative flex items-center justify-center px-3 py-3 text-sm font-bold text-center transition-all duration-200"
                      style={{
                        minHeight: "72px",
                        background: bg,
                        borderColor: borderColor,
                        color,
                        transition: "background 0.25s, border-color 0.25s, color 0.25s, transform 0.08s",
                      }}>
                      <span className="absolute top-2 left-2.5 text-[9px] font-black opacity-35 tracking-widest">
                        {["A","B","C","D"][i]}
                      </span>
                      {opt}
                    </button>
                  );
                })}
              </div>

            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default LavaFloorGame;
