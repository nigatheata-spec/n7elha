import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Users } from "lucide-react";
import { BitcoinIcon } from "@/components/game/icons";
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

const AV_COLORS = ["#2563eb", "#16a34a", "#b45309", "#dc2626", "#7c3aed", "#0891b2", "#c2410c", "#0f766e"];
const av = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AV_COLORS[Math.abs(h) % AV_COLORS.length];
};

const CRYPTO_GREEN = "#3a9e6e";
const TEAL = "#3F5A63";

const Game = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const [session, setSession] = useState<any>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  const [phase, setPhase] = useState<"waiting"|"question"|"answered"|"output"|"hacking"|"breach"|"done">("waiting");
  const [picked, setPicked] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [output, setOutput] = useState<OutputResult | null>(null);
  const [currentQ, setCurrentQ] = useState<Q | null>(null);
  const [qSeed, setQSeed] = useState(0);
  const studentId = sessionId ? localStorage.getItem(`hash_student_${sessionId}`) : null;
  const startedAtRef = useRef<number>(0);
  const askedCount = useRef(0);
  // Keep a ref to students so hack_events callback can read current names
  // without causing the realtime channel to tear down on every score update.
  const studentsRef = useRef<any[]>([]);

  // paint root cream while in game so no theme flash bleeds through
  useEffect(() => {
    const prevHtml = document.documentElement.style.background;
    const prevBody = document.body.style.background;
    document.documentElement.style.background = "hsl(40 47% 85%)";
    document.body.style.background = "hsl(40 47% 85%)";
    // Prime audio on first user gesture (required by iOS Safari)
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
    if (!sessionId) return;
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

  // Keep studentsRef in sync every render so closures always see current list
  studentsRef.current = students;

  // realtime — deps contain only stable values so the channel is created once
  // and never torn down mid-game due to score updates changing `students`.
  useEffect(() => {
    if (!sessionId) return;
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
          // Use ref — not state — so this callback never causes channel re-creation
          const hacker = studentsRef.current.find((x: any) => x.id === ev.hacker_id)?.name ?? "?";
          const target = studentsRef.current.find((x: any) => x.id === ev.target_id)?.name ?? "?";
          if (ev.success) {
            if (ev.target_id === studentId) { playHackAlert(); setPhase("breach"); }
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, studentId]); // ← `students` removed: channel stays alive for the whole session

  // status sync
  useEffect(() => {
    if (!session) return;
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

  // Play game-over fanfare once when teacher ends the session
  useEffect(() => {
    if (phase === "done") playGameOver();
  }, [phase]);

  // pick a random new question whenever entering "question" phase
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

  // per-question countdown
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
    const t = setTimeout(() => setQSeed(s => s + 1), 1400);
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

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(40 47% 85%)" }}>
        <div className="h-8 w-8 rounded-full border-2 border-[hsl(var(--nb-border))] border-t-transparent animate-spin" />
      </div>
    );
  }

  const ar = session.settings?.lang === "ar";

  // Route to mode-specific game
  if (session.settings?.mode === "dodgeball" && studentId) {
    return <DodgeballGame sessionId={sessionId!} studentId={studentId} />;
  }
  if (session.settings?.mode === "hotpotato" && studentId) {
    return <HotPotatoGame sessionId={sessionId!} studentId={studentId} />;
  }
  if (session.settings?.mode === "lavafloor" && studentId) {
    return <LavaFloorGame sessionId={sessionId!} studentId={studentId} />;
  }

  return (
    <div
      className="min-h-[100dvh] flex flex-col"
      style={{ background: "hsl(40 47% 85%)", fontFamily: "'Outfit', 'Almarai', system-ui, sans-serif" }}
    >
      {/* HEADER */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-white/90 backdrop-blur-sm border-b-2 border-[hsl(var(--nb-border))]">
        <div className="font-semibold text-sm md:text-base truncate max-w-[55%]" style={{ color: TEAL }}>{me?.name ?? "—"}</div>
        <div className="flex items-center gap-1.5 rounded-full border-2 border-[hsl(var(--nb-border))] bg-white px-3 py-1 shadow-[2px_2px_0_0_hsl(var(--nb-border))]">
          <BitcoinIcon className="h-4 w-4" style={{ color: CRYPTO_GREEN }} strokeWidth={2} />
          <span className="font-bold text-sm md:text-base tabular-nums" style={{ color: TEAL }}>{fmt(me?.crypto ?? 0)}</span>
        </div>
      </header>

      <main className="relative flex-1 px-3 md:px-6 py-5">
        {phase === "waiting" && (
          <div className="max-w-3xl mx-auto py-4 md:py-8 px-2">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 rounded-full border-2 border-[hsl(var(--nb-border))] bg-white px-4 py-1.5 shadow-[2px_2px_0_0_hsl(var(--nb-border))] mb-5">
                <span className="font-mono text-xs tracking-[0.2em]" style={{ color: TEAL }}>{session.code}</span>
              </div>
              <h1 className="text-[24px] sm:text-[32px] font-bold leading-tight" style={{ color: TEAL, fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}>
                {ar ? "بانتظار المعلّم لبدء الجلسة" : "Waiting for your teacher to start"}
              </h1>
              <p className="mt-2 text-sm text-black/50">
                {ar ? "استعد لكسب أول عملات الكريبتو" : "Get ready to earn your first crypto"}
              </p>
            </div>

            {/* live joiner count */}
            <div className="flex items-center justify-between text-xs font-semibold px-4 py-2.5 mb-4 rounded-xl border-2 border-[hsl(var(--nb-border))] bg-white shadow-[2px_2px_0_0_hsl(var(--nb-border))]">
              <span className="flex items-center gap-1.5" style={{ color: TEAL }}>
                <Users className="h-3.5 w-3.5" />
                {ar ? "اللاعبون المتصلون" : "Players online"}
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: CRYPTO_GREEN }} />
                <span className="font-bold tabular-nums" style={{ color: TEAL }}>{students.length}</span>
              </span>
            </div>

            {/* student grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {students.map((s, i) => {
                const isMe = s.id === studentId;
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-2.5 p-3 rounded-xl border-2 bg-white transition-all"
                    style={{
                      borderColor: isMe ? CRYPTO_GREEN : "hsl(199 23% 18% / 0.18)",
                      boxShadow: isMe ? `2px 2px 0 0 ${CRYPTO_GREEN}` : "2px 2px 0 0 hsl(199 23% 18% / 0.12)",
                      animation: `fade-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${Math.min(i * 60, 600)}ms both`,
                    }}
                  >
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0"
                      style={{ background: av(s.name) }}
                    >
                      {(s.name?.charAt(0) ?? "?").toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold truncate" style={{ color: TEAL }}>
                        {s.name}
                      </div>
                      {isMe && (
                        <div className="text-[10px] font-medium" style={{ color: CRYPTO_GREEN }}>
                          {ar ? "أنت" : "you"}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* empty slots placeholder if very few players */}
              {students.length < 4 && Array.from({ length: 4 - students.length }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="flex items-center gap-2.5 p-3 rounded-xl border-2 border-dashed border-black/10 opacity-50"
                >
                  <div className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center bg-black/5 text-black/30 text-xs">
                    ?
                  </div>
                  <div className="text-xs text-black/30">
                    {ar ? "بالانتظار..." : "waiting..."}
                  </div>
                </div>
              ))}
            </div>

            {/* footer status */}
            <p className="mt-6 text-xs text-center text-black/40">
              {ar ? "سيبدأ المعلّم اللعبة قريباً" : "Your teacher will start the game shortly"}
            </p>
          </div>
        )}

        {phase === "done" && (() => {
          const myRank = students.findIndex(s => s.id === studentId) + 1 || 1;
          const total  = students.length || 1;
          const top    = students.slice(0, 5);
          const isTop  = myRank === 1;
          const myBal  = me?.crypto ?? 0;

          return (
            <div className="max-w-xl mx-auto py-6 px-2">
              <div className="text-center mb-6">
                <div
                  className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-[hsl(var(--nb-border))] bg-white shadow-[3px_3px_0_0_hsl(var(--nb-border))] mb-3"
                  style={{ color: isTop ? CRYPTO_GREEN : TEAL }}
                >
                  <Trophy className="h-8 w-8" />
                </div>
                <h1 className="text-[24px] sm:text-[30px] font-bold leading-tight" style={{ color: TEAL, fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}>
                  {isTop
                    ? (ar ? "أنت أفضل لاعب!" : "You're the top earner!")
                    : (ar ? `حللت في المركز #${myRank}` : `You finished #${myRank}`)}
                </h1>
                <p className="mt-2 text-sm text-black/50">
                  {ar ? `من أصل ${total} لاعب` : `out of ${total} players`}
                </p>
              </div>

              {/* balance card */}
              <div className="rounded-2xl border-2 border-[hsl(var(--nb-border))] bg-white shadow-[4px_4px_0_0_hsl(var(--nb-border))] p-5 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-black/45">{ar ? "رصيدك النهائي" : "Final balance"}</span>
                  <div className="flex items-center gap-1.5">
                    <BitcoinIcon className="h-4 w-4" style={{ color: CRYPTO_GREEN }} strokeWidth={2} />
                    <span className="font-bold text-lg" style={{ color: TEAL }}>{fmt(myBal)}</span>
                  </div>
                </div>
              </div>

              {/* stats row */}
              <div className="grid grid-cols-2 gap-2.5 mb-6">
                <div className="rounded-xl border-2 border-[hsl(var(--nb-border))] bg-white shadow-[2px_2px_0_0_hsl(var(--nb-border))] p-3 text-center">
                  <div className="text-2xl font-bold" style={{ color: TEAL }}>{me?.correct_answers ?? 0}</div>
                  <div className="text-[11px] text-black/45 mt-0.5">{ar ? "إجابات صحيحة" : "correct answers"}</div>
                </div>
                <div className="rounded-xl border-2 border-[hsl(var(--nb-border))] bg-white shadow-[2px_2px_0_0_hsl(var(--nb-border))] p-3 text-center">
                  <div className="text-2xl font-bold" style={{ color: TEAL }}>{me?.total_answers ?? 0}</div>
                  <div className="text-[11px] text-black/45 mt-0.5">{ar ? "مجموع الإجابات" : "total answered"}</div>
                </div>
              </div>

              {/* leaderboard */}
              <div className="mb-6">
                <div className="text-xs font-semibold text-black/45 mb-2 uppercase tracking-wide">
                  {ar ? "الترتيب" : "Leaderboard"}
                </div>
                <div className="space-y-1.5">
                  {top.map((s: any, i: number) => {
                    const isMe = s.id === studentId;
                    return (
                      <div
                        key={s.id}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl border-2"
                        style={{
                          background: isMe ? `${CRYPTO_GREEN}14` : "white",
                          borderColor: isMe ? CRYPTO_GREEN : "hsl(199 23% 18% / 0.15)",
                        }}
                      >
                        <span className="w-5 text-center font-bold text-sm" style={{ color: i === 0 ? CRYPTO_GREEN : TEAL }}>{i + 1}</span>
                        <span className="flex-1 truncate text-sm font-semibold" style={{ color: TEAL }}>
                          {s.name}{isMe && (ar ? " (أنت)" : " (you)")}
                        </span>
                        <span className="font-bold text-sm" style={{ color: TEAL }}>{fmt(s.crypto ?? 0)}</span>
                      </div>
                    );
                  })}
                  {myRank > 5 && (
                    <div
                      className="flex items-center gap-3 px-3 py-2 rounded-xl border-2"
                      style={{ background: `${CRYPTO_GREEN}14`, borderColor: CRYPTO_GREEN }}
                    >
                      <span className="w-5 text-center font-bold text-sm" style={{ color: TEAL }}>{myRank}</span>
                      <span className="flex-1 truncate text-sm font-semibold" style={{ color: TEAL }}>
                        {me?.name}{ar ? " (أنت)" : " (you)"}
                      </span>
                      <span className="font-bold text-sm" style={{ color: TEAL }}>{fmt(myBal)}</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => navigate("/play")}
                className="w-full py-3 rounded-full border-2 border-[hsl(var(--nb-border))] text-white font-semibold shadow-[3px_3px_0_0_hsl(var(--nb-border))] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_0_hsl(var(--nb-border))] transition-all"
                style={{ background: TEAL }}
              >
                {ar ? "العودة" : "Back to home"}
              </button>
            </div>
          );
        })()}

        {(phase === "question" || phase === "answered") && currentQ && (
          <div className="max-w-3xl mx-auto h-full w-full flex flex-col gap-3 pb-safe">
            <div className="rounded-2xl border-2 border-[hsl(var(--nb-border))] bg-white shadow-[4px_4px_0_0_hsl(var(--nb-border))] px-4 py-5 md:py-8 text-center shrink-0">
              {(currentQ as any).image_url && (
                <img
                  src={(currentQ as any).image_url}
                  alt=""
                  className="mx-auto mb-3 max-h-[26vh] md:max-h-56 w-auto object-contain rounded-lg border-2 border-[hsl(var(--nb-border))]"
                />
              )}
              <p className="text-lg md:text-2xl lg:text-3xl font-semibold leading-relaxed" style={{ color: TEAL }}>
                {currentQ.text}
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border-2 border-[hsl(var(--nb-border))] px-3 py-1" style={{ background: "hsl(40 47% 85%)" }}>
                <span className="text-xs font-bold tabular-nums" style={{ color: TEAL }}>{timeLeft}s</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 px-1 flex-1 min-h-0">
              {currentQ.options.map((opt, i) => {
                const isCorrect = i === currentQ.correct_index;
                const isPicked = picked === i;
                const showResult = picked !== null;
                return (
                  <button
                    key={i}
                    disabled={picked !== null}
                    onClick={() => submit(i)}
                    className={cn(
                      "min-h-[96px] md:min-h-[176px] px-3 py-3 md:py-6 text-center text-base md:text-xl font-semibold border-2 rounded-2xl transition-all break-words active:scale-[0.98] leading-snug",
                      !showResult && "bg-white border-[hsl(var(--nb-border))] shadow-[3px_3px_0_0_hsl(var(--nb-border))] hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_0_hsl(var(--nb-border))]",
                      showResult && isCorrect && "bg-[#16a34a] text-white border-[hsl(var(--nb-border))] shadow-[3px_3px_0_0_hsl(var(--nb-border))]",
                      showResult && isPicked && !isCorrect && "bg-[#dc2626] text-white border-[hsl(var(--nb-border))] shadow-[3px_3px_0_0_hsl(var(--nb-border))]",
                      showResult && !isPicked && !isCorrect && "bg-white border-black/10 opacity-30"
                    )}
                    style={!showResult ? { color: TEAL } : undefined}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        )}

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
