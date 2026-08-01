import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { HackingFlow } from "@/components/game/HackingFlow";
import { BreachModal } from "@/components/game/BreachModal";
import { OutputCards, OutputResult } from "@/components/game/OutputCards";
import DodgeballGame from "./DodgeballGame";
import HotPotatoGame from "./HotPotatoGame";
import LavaFloorGame from "./LavaFloorGame";
import { playSelect, playCorrect, playWrong, playHackAlert, playGameOver, primeAudio } from "@/lib/sound";

type Q = { id: string; text: string; options: string[]; correct_index: number; position: number };

const fmt = (n: number) => n.toLocaleString();

// DEV-ONLY preview harness — lets us view any phase at /play/preview?preview=1&phase=waiting|question|done
const MOCK_STUDENTS = [
  { id: "s1", name: "Sara",   crypto: 4200, correct_answers: 8, total_answers: 9 },
  { id: "s2", name: "Omar",   crypto: 3100, correct_answers: 6, total_answers: 9 },
  { id: "me", name: "You",    crypto: 2750, correct_answers: 5, total_answers: 9 },
  { id: "s4", name: "Lina",   crypto: 1900, correct_answers: 4, total_answers: 9 },
  { id: "s5", name: "Yousef", crypto:  900, correct_answers: 2, total_answers: 9 },
];
const MOCK_Q: Q = {
  id: "q1", position: 0, correct_index: 1,
  text: "Which port does HTTPS traffic use by default?",
  options: ["21", "443", "8080", "22"],
};
const MOCK_SESSION = { id: "preview", code: "DEMO", quiz_id: "mock", status: "running", settings: { lang: "en", timePerQ: 25 } };

const Game = () => {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get("preview") === "1";
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const [session,   setSession]   = useState<any>(isPreview ? MOCK_SESSION : null);
  const [questions, setQuestions] = useState<Q[]>(isPreview ? [MOCK_Q] : []);
  const [students,  setStudents]  = useState<any[]>(isPreview ? MOCK_STUDENTS : []);
  const [me,        setMe]        = useState<any>(isPreview ? MOCK_STUDENTS[2] : null);
  const [phase, setPhase] = useState<"waiting"|"question"|"answered"|"output"|"hacking"|"breach"|"done">(
    isPreview ? ((searchParams.get("phase") as any) ?? "waiting") : "waiting"
  );
  const [picked,   setPicked]   = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [output,   setOutput]   = useState<OutputResult | null>(null);
  const [currentQ, setCurrentQ] = useState<Q | null>(isPreview ? MOCK_Q : null);
  const [qSeed,    setQSeed]    = useState(0);
  const studentId      = sessionId ? localStorage.getItem(`hash_student_${sessionId}`) : null;
  const startedAtRef   = useRef<number>(0);
  const askedCount     = useRef(0);
  const studentsRef    = useRef<any[]>([]);

  // paint root black while in game
  useEffect(() => {
    const prevHtml = document.documentElement.style.background;
    const prevBody = document.body.style.background;
    document.documentElement.style.background = "#050505";
    document.body.style.background = "#050505";
    const onFirstTouch = () => { primeAudio(); window.removeEventListener("pointerdown", onFirstTouch); };
    window.addEventListener("pointerdown", onFirstTouch, { once: true });
    return () => {
      document.documentElement.style.background = prevHtml;
      document.body.style.background = prevBody;
      window.removeEventListener("pointerdown", onFirstTouch);
    };
  }, []);

  // initial load
  useEffect(() => {
    if (!sessionId || isPreview) return;
    (async () => {
      const { data: s } = await supabase.from("game_sessions").select("*, quizzes(id, title)").eq("id", sessionId).maybeSingle();
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

  studentsRef.current = students;

  // realtime
  useEffect(() => {
    if (!sessionId || isPreview) return;
    const ch = supabase.channel(`game-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_sessions", filter: `id=eq.${sessionId}` },
        (p: any) => setSession((prev: any) => ({ ...prev, ...p.new })))
      .on("postgres_changes", { event: "*", schema: "public", table: "game_students", filter: `session_id=eq.${sessionId}` },
        async () => {
          const { data: ss } = await supabase.from("game_students").select("*").eq("session_id", sessionId).order("crypto", { ascending: false });
          setStudents(ss ?? []);
          const m = (ss ?? []).find((x: any) => x.id === studentId);
          if (m) setMe(m);
        })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "hack_events", filter: `session_id=eq.${sessionId}` },
        (p: any) => {
          const ev = p.new;
          const hacker = studentsRef.current.find((x: any) => x.id === ev.hacker_id)?.name ?? "?";
          const target = studentsRef.current.find((x: any) => x.id === ev.target_id)?.name ?? "?";
          if (ev.success) {
            if (ev.target_id === studentId) { playHackAlert(); setPhase("breach"); }
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, studentId]);

  // status sync
  useEffect(() => {
    if (!session || isPreview) return;
    if (session.status === "lobby") setPhase("waiting");
    else if (session.status === "finished") setPhase("done");
    else if (session.status === "running") {
      setPhase(prev => prev === "waiting" ? "question" : prev);
    } else if (session.status === "cancelled") {
      const ar = (session.settings?.lang ?? i18n.language) === "ar";
      toast.error(ar ? "أغلق المعلّم الردهة" : "The teacher closed the lobby");
      navigate("/play");
    }
  }, [session?.status]);

  useEffect(() => {
    if (phase === "done") playGameOver();
  }, [phase]);

  // pick question
  useEffect(() => {
    if (phase !== "question" || questions.length === 0) return;
    const next = questions[Math.floor(Math.random() * questions.length)];
    setCurrentQ(next);
    setPicked(null);
    setOutput(null);
    askedCount.current += 1;
    startedAtRef.current = Date.now();
  }, [phase, qSeed, questions]);

  const duration = session?.settings?.timePerQ ?? 25;

  // countdown
  useEffect(() => {
    if (phase !== "question" || !currentQ) return;
    const t = setInterval(() => {
      const elapsed = (Date.now() - startedAtRef.current) / 1000;
      const left = Math.max(0, Math.ceil(duration - elapsed));
      setTimeLeft(left);
      if (left <= 0) { setPicked(p => p ?? -1); setPhase("answered"); clearInterval(t); }
    }, 200);
    return () => clearInterval(t);
  }, [phase, currentQ, duration]);

  // auto-advance after wrong/timeout
  useEffect(() => {
    if (phase !== "answered") return;
    const t  = setTimeout(() => setQSeed(s => s + 1), 1400);
    const t2 = setTimeout(() => setPhase("question"), 1450);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [phase]);

  const submit = async (idx: number) => {
    if (picked !== null || !currentQ || !me || !sessionId) return;
    playSelect();
    setPicked(idx);
    const correct = idx === currentQ.correct_index;
    if (correct) playCorrect(); else playWrong();
    await supabase.from("question_responses").insert({
      session_id: sessionId, student_id: me.id, question_id: currentQ.id,
      question_index: askedCount.current, answer_index: idx, is_correct: correct,
    });
    await supabase.from("game_students").update({
      total_answers: me.total_answers + 1,
      correct_answers: me.correct_answers + (correct ? 1 : 0),
    }).eq("id", me.id);
    if (correct) setTimeout(() => setPhase("output"), 700);
    else setTimeout(() => setPhase("answered"), 700);
  };

  const onOutput = async (r: OutputResult) => {
    setOutput(r);
    if (!me) return;
    let delta = 0;
    if (r.kind === "flat") delta = r.value;
    if (r.kind === "mult") delta = Math.floor(me.crypto * (r.value - 1));
    if (delta !== 0) {
      await supabase.from("game_students").update({ crypto: me.crypto + delta }).eq("id", me.id);
    }
    if (r.kind === "hack") { setTimeout(() => setPhase("hacking"), 700); return; }
    setTimeout(() => { setQSeed(s => s + 1); setPhase("question"); }, 1200);
  };

  if (!session) return (
    <div className="theme-game terminal-screen min-h-screen text-foreground flex items-center justify-center font-mono"
      style={{ color: "var(--g-dim)" }}>
      $ connecting...
    </div>
  );

  const ar = session.settings?.lang === "ar";

  if (session.settings?.mode === "dodgeball" && studentId)
    return <DodgeballGame sessionId={sessionId!} studentId={studentId} />;
  if (session.settings?.mode === "hotpotato" && studentId)
    return <HotPotatoGame sessionId={sessionId!} studentId={studentId} />;
  if (session.settings?.mode === "lavafloor" && studentId)
    return <LavaFloorGame sessionId={sessionId!} studentId={studentId} />;

  // ─── Answer key labels ───────────────────────────────────────────────────────
  const KEYS = ["A", "B", "C", "D"];

  return (
    <div className="theme-game terminal-screen min-h-[100dvh] font-mono flex flex-col overflow-hidden"
      style={{ color: "var(--g-mid)" }}>
      <div className="pointer-events-none fixed inset-0 terminal-scanlines" />

      {/* ── TOP STATUS BAR ──────────────────────────────────────────────────── */}
      <header
        className="relative shrink-0 flex items-center justify-between px-4 py-2.5 sticky top-0 z-10"
        style={{
          background: "hsl(0 0% 2% / 0.92)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid hsl(120 100% 55% / 0.18)",
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[10px] tracking-widest shrink-0" style={{ color: "var(--g-dim)" }}>
            [{session.code}]
          </span>
          <span className="text-sm font-bold truncate" style={{ color: "var(--g-mid)" }}>
            {me?.name ?? "—"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px]" style={{ color: "var(--g-dim)" }}>₿</span>
          <span className="text-base font-bold tabular-nums" style={{ color: "var(--g-bright)" }}>
            {fmt(me?.crypto ?? 0)}
          </span>
        </div>
      </header>

      {/* ── MAIN CONTENT ────────────────────────────────────────────────────── */}
      <main className="relative flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* WAITING ──────────────────────────────────────────────────────────── */}
        {phase === "waiting" && (
          <div className="flex-1 flex flex-col max-w-xl mx-auto w-full px-4 py-5 overflow-y-auto">
            {/* terminal prompt */}
            <div className="mb-6 space-y-0.5 text-xs" style={{ color: "var(--g-dim)" }}>
              <div>$ ./connect --session={session.code} --user=&quot;{me?.name}&quot;</div>
              <div style={{ color: "var(--g-mid)" }}>
                {">"} {ar ? "اتصال ناجح. بانتظار بدء الجلسة." : "connection established. awaiting session start."}
                <span className="animate-pulse">█</span>
              </div>
            </div>

            {/* peers header */}
            <div
              className="flex items-center justify-between text-[11px] mb-1 pb-1.5 tracking-widest"
              style={{ borderBottom: "1px solid hsl(120 100% 55% / 0.15)", color: "var(--g-dim)" }}
            >
              <span>{ar ? "الأقران" : "PEERS"}</span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ background: "hsl(120 100% 55%)" }} />
                <span className="font-bold tabular-nums" style={{ color: "var(--g-bright)" }}>
                  {students.length.toString().padStart(2, "0")}
                </span>
              </span>
            </div>

            {/* player rows — monospace, no colored circles */}
            <div className="flex-1 space-y-px">
              {students.map((s, i) => {
                const isMe = s.id === studentId;
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 px-3 py-2 text-sm"
                    style={{
                      background: isMe ? "hsl(120 100% 55% / 0.06)" : "transparent",
                      borderLeft: `2px solid hsl(120 100% 55% / ${isMe ? 0.65 : 0.14})`,
                      animation: `fade-up 0.28s cubic-bezier(0.16,1,0.3,1) ${Math.min(i * 45, 450)}ms both`,
                    }}
                  >
                    <span
                      className="text-[11px] tabular-nums w-6 shrink-0"
                      style={{ color: "var(--g-dim)" }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className="flex-1 truncate font-bold"
                      style={{ color: isMe ? "var(--g-bright)" : "var(--g-mid)" }}
                    >
                      {s.name}
                    </span>
                    {isMe && (
                      <span className="text-[10px] tracking-widest shrink-0" style={{ color: "var(--g-dim)" }}>
                        {ar ? "[أنت]" : "[you]"}
                      </span>
                    )}
                  </div>
                );
              })}
              {/* empty slots */}
              {students.length < 3 && Array.from({ length: 3 - students.length }).map((_, i) => (
                <div
                  key={`e-${i}`}
                  className="flex items-center gap-3 px-3 py-2 text-sm"
                  style={{ borderLeft: "2px dashed hsl(120 100% 55% / 0.08)", opacity: 0.4 }}
                >
                  <span className="text-[11px] tabular-nums w-6 shrink-0" style={{ color: "var(--g-dim)" }}>
                    {String(students.length + i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[11px]" style={{ color: "var(--g-dim)" }}>
                    {ar ? "بانتظار..." : "waiting..."}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 text-[10px] text-center animate-pulse" style={{ color: "var(--g-dim)" }}>
              {ar ? "[ اضغط ابدأ على شاشة المعلّم ]" : "[ waiting for teacher to start the session ]"}
            </div>
          </div>
        )}

        {/* QUESTION / ANSWERED ──────────────────────────────────────────────── */}
        {(phase === "question" || phase === "answered") && currentQ && (
          <div className="flex-1 flex flex-col max-w-xl mx-auto w-full px-4 py-4 gap-4 overflow-hidden">

            {/* question text */}
            <div className="shrink-0 pt-1">
              <div className="text-[11px] mb-2" style={{ color: "var(--g-dim)" }}>
                {ar ? "$ السؤال" : "$ prompt.txt"}
              </div>
              {(currentQ as any).image_url && (
                <img
                  src={(currentQ as any).image_url}
                  alt=""
                  className="mb-3 max-h-[26vh] w-auto object-contain"
                  style={{ border: "1px solid hsl(120 100% 55% / 0.22)" }}
                />
              )}
              <p
                className="text-xl md:text-2xl font-medium leading-snug"
                style={{ color: "hsl(120 100% 82%)" }}
              >
                {currentQ.text}
              </p>
            </div>

            {/* answer rows [A] [B] [C] [D] */}
            <div className="flex flex-col gap-1.5 flex-1 min-h-0">
              {currentQ.options.map((opt, i) => {
                const isCorrect = i === currentQ.correct_index;
                const isPicked  = picked === i;
                const showResult = picked !== null;

                let bg      = "transparent";
                let border  = "hsl(120 100% 55% / 0.18)";
                let color   = "var(--g-mid)";
                let keyBg   = "hsl(120 100% 55% / 0.07)";
                let keyColor = "hsl(120 50% 48%)";
                let opacity  = 1;
                let animClass = "";

                if (showResult) {
                  if (isCorrect) {
                    border   = "hsl(120 100% 55% / 0.85)";
                    color    = "var(--g-bright)";
                    keyBg    = "hsl(120 100% 55%)";
                    keyColor = "hsl(120 5% 5%)";
                    animClass = "ans-correct";
                  } else if (isPicked) {
                    border   = "hsl(0 85% 60% / 0.65)";
                    color    = "hsl(0 80% 75%)";
                    keyBg    = "hsl(0 80% 55% / 0.25)";
                    keyColor = "hsl(0 80% 75%)";
                    animClass = "ans-wrong";
                  } else {
                    opacity = 0.28;
                  }
                }

                return (
                  <button
                    key={i}
                    disabled={picked !== null}
                    onClick={() => submit(i)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3.5 text-left w-full transition-all active:scale-[0.99]",
                      animClass
                    )}
                    style={{
                      background: bg,
                      border: `1px solid ${border}`,
                      color,
                      opacity,
                      transition: "border-color 0.2s, opacity 0.2s",
                    }}
                    onMouseEnter={e => {
                      if (picked === null)
                        (e.currentTarget as HTMLElement).style.background = "hsl(120 100% 55% / 0.06)";
                    }}
                    onMouseLeave={e => {
                      if (picked === null)
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    <span
                      className="shrink-0 w-7 h-7 flex items-center justify-center text-xs font-bold"
                      style={{
                        background: keyBg,
                        color: keyColor,
                        border: `1px solid ${border}`,
                        transition: "all 0.2s",
                      }}
                    >
                      {KEYS[i]}
                    </span>
                    <span className="font-medium text-base md:text-lg leading-snug flex-1">
                      {opt}
                    </span>
                    {showResult && isCorrect && (
                      <span className="text-xs shrink-0 font-bold" style={{ color: "var(--g-bright)" }}>
                        {ar ? "✓ صحيح" : "✓ correct"}
                      </span>
                    )}
                    {showResult && isPicked && !isCorrect && (
                      <span className="text-xs shrink-0 font-bold" style={{ color: "hsl(0 80% 70%)" }}>
                        {ar ? "✗ خطأ" : "✗ wrong"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* DONE ─────────────────────────────────────────────────────────────── */}
        {phase === "done" && (() => {
          const myRank    = students.findIndex(s => s.id === studentId) + 1 || 1;
          const total     = students.length || 1;
          const top       = students.slice(0, 5);
          const isTop     = myRank === 1;
          const myBal     = me?.crypto ?? 0;
          const totalLoot = students.reduce((a, s) => a + (s.crypto || 0), 0);

          return (
            <div className="flex-1 max-w-xl mx-auto w-full px-4 py-5 flex flex-col gap-5 overflow-y-auto">

              {/* terminal shutdown log */}
              <div className="space-y-0.5 text-xs" style={{ color: "var(--g-dim)" }}>
                <div>$ session.end --code={session.code}</div>
                <div>{">"} {ar ? "تفريغ المحافظ..." : "flushing wallets..."}</div>
                <div>{">"} {ar ? "حساب الترتيب..." : "computing leaderboard..."}</div>
                <div style={{ color: "var(--g-bright)" }}>
                  {">"} {ar ? "تم إنهاء الاتصال" : "CONNECTION_TERMINATED"}
                </div>
              </div>

              {/* rank badge */}
              <div>
                <span
                  className="inline-block text-[11px] px-2.5 py-1 tracking-widest font-bold"
                  style={{
                    background: isTop ? "hsl(120 100% 55% / 0.13)" : "hsl(120 100% 55% / 0.05)",
                    color: isTop ? "var(--g-bright)" : "var(--g-mid)",
                    border: `1px solid hsl(120 100% 55% / ${isTop ? 0.5 : 0.18})`,
                    boxShadow: isTop ? "0 0 18px hsl(120 100% 55% / 0.12)" : "none",
                  }}
                >
                  {isTop
                    ? (ar ? "[ أفضل مخترق ]" : "[ TOP_HACKER ]")
                    : (ar ? `[ الترتيب #${myRank} ]` : `[ RANK_${String(myRank).padStart(2, "0")} ]`)}
                </span>
              </div>

              {/* stats as terminal key-value output */}
              <div className="text-xs space-y-0.5">
                <div className="mb-2" style={{ color: "var(--g-dim)" }}>$ session.stats --me</div>
                {[
                  { k: ar ? "الرصيد_النهائي"   : "WALLET_BALANCE", v: `₿ ${myBal.toLocaleString()}` },
                  { k: ar ? "الترتيب_النهائي"  : "FINAL_RANK",     v: `#${myRank} of ${total}` },
                  { k: ar ? "إجابات_صحيحة"     : "CORRECT_ANS",    v: `${me?.correct_answers ?? 0} / ${me?.total_answers ?? 0}` },
                  { k: ar ? "حصة_من_المجموع"   : "POOL_SHARE",     v: `${Math.round((myBal / Math.max(totalLoot, 1)) * 100)}%` },
                ].map(row => (
                  <div key={row.k} className="flex items-baseline gap-2">
                    <span className="w-40 shrink-0 text-[11px]" style={{ color: "var(--g-dim)" }}>{row.k}</span>
                    <span className="font-bold" style={{ color: "var(--g-bright)" }}>{row.v}</span>
                  </div>
                ))}
              </div>

              {/* leaderboard */}
              <div>
                <div className="text-[11px] mb-1.5" style={{ color: "var(--g-dim)" }}>
                  $ tail -5 leaderboard.log
                </div>
                <div className="space-y-px">
                  {top.map((s: any, i: number) => {
                    const isMe = s.id === studentId;
                    return (
                      <div
                        key={s.id}
                        className="flex items-center gap-2 text-xs px-3 py-2"
                        style={{
                          background: isMe ? "hsl(120 100% 55% / 0.07)" : "transparent",
                          borderLeft: `2px solid hsl(120 100% 55% / ${i === 0 ? 0.75 : isMe ? 0.45 : 0.13})`,
                          color: i === 0 ? "var(--g-bright)" : "var(--g-mid)",
                        }}
                      >
                        <span className="w-5 tabular-nums shrink-0" style={{ color: "var(--g-dim)" }}>
                          {i + 1}.
                        </span>
                        <span className="flex-1 truncate font-bold">
                          {s.name}{isMe && " ←"}
                        </span>
                        <span className="tabular-nums font-bold">
                          ₿{(s.crypto ?? 0).toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                  {myRank > 5 && (
                    <>
                      <div className="text-center text-[10px] py-0.5" style={{ color: "var(--g-dim)" }}>...</div>
                      <div
                        className="flex items-center gap-2 text-xs px-3 py-2"
                        style={{
                          background: "hsl(120 100% 55% / 0.07)",
                          borderLeft: "2px solid hsl(120 100% 55% / 0.45)",
                          color: "var(--g-bright)",
                        }}
                      >
                        <span className="w-5 tabular-nums shrink-0" style={{ color: "var(--g-dim)" }}>{myRank}.</span>
                        <span className="flex-1 truncate font-bold">{me?.name} ←</span>
                        <span className="tabular-nums font-bold">₿{myBal.toLocaleString()}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <button
                onClick={() => navigate("/play")}
                className="mt-auto w-full py-2.5 text-[11px] font-bold tracking-widest transition-all"
                style={{
                  background: "hsl(120 100% 55% / 0.07)",
                  color: "var(--g-mid)",
                  border: "1px solid hsl(120 100% 55% / 0.28)",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "hsl(120 100% 55% / 0.13)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "hsl(120 100% 55% / 0.07)"; }}
              >
                {ar ? "[ قطع الاتصال ]" : "[ disconnect ]"}
              </button>
            </div>
          );
        })()}

        {phase === "output" && me && (
          <OutputCards onPick={onOutput} picked={output} ar={ar} />
        )}

        {phase === "hacking" && me && (
          <HackingFlow
            me={me}
            students={students.filter(s => s.id !== me.id)}
            sessionId={sessionId!}
            onDone={() => { setQSeed(s => s + 1); setPhase("question"); }}
            ar={ar}
          />
        )}
      </main>

      {/* ── BOTTOM STATUS BAR ───────────────────────────────────────────────── */}
      <footer
        className="shrink-0 flex items-center justify-between px-4 py-1.5 text-[10px]"
        style={{
          background: "hsl(0 0% 2%)",
          borderTop: "1px solid hsl(120 100% 55% / 0.10)",
          color: "var(--g-dim)",
        }}
      >
        <span>
          {ar ? "الجلسة:" : "session:"}
          {" "}<span style={{ color: "hsl(120 60% 44%)" }}>{session.code}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full" style={{ background: "hsl(120 80% 42%)" }} />
          {ar ? "متصل" : "online"}
        </span>
        <span>
          {ar ? "الأقران:" : "peers:"}
          {" "}<span style={{ color: "hsl(120 60% 44%)" }}>{students.length}</span>
        </span>
      </footer>

      {phase === "breach" && me && (
        <BreachModal me={me} ar={ar} onDone={async () => {
          await supabase.from("game_students").update({ is_breached: false }).eq("id", me.id);
          setQSeed(s => s + 1); setPhase("question");
        }} />
      )}
    </div>
  );
};
export default Game;
