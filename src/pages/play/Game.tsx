import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import logoLight from "@/assets/logo-light.png";
import { HackingFlow } from "@/components/game/HackingFlow";
import { BreachModal } from "@/components/game/BreachModal";
import { OutputCards, OutputResult } from "@/components/game/OutputCards";
import DodgeballGame from "./DodgeballGame";
import HotPotatoGame from "./HotPotatoGame";
import LavaFloorGame from "./LavaFloorGame";
import ClassicGame from "./ClassicGame";
import HumansVsZombiesGame from "./HumansVsZombiesGame";
import DontLookDownGame from "./DontLookDownGame";
import { playSelect, playCorrect, playWrong, playHackAlert, playGameOver, primeAudio } from "@/lib/sound";

type Q = { id: string; text: string; options: string[]; correct_index: number; position: number };

const fmt = (n: number) => n.toLocaleString();

// DEV-ONLY PREVIEW HARNESS — view any phase at /play/preview?preview=1&phase=waiting|question|done
// No Supabase writes, no accounts. Remove before shipping to production.
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
const getMockSession = () => {
  const previewMode = new URLSearchParams(window.location.search).get("mode") ?? undefined;
  return { id: "preview", code: "DEMO", quiz_id: "mock", status: "running", settings: { lang: "en", timePerQ: 25, mode: previewMode } };
};

const Game = () => {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get("preview") === "1";
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const [session, setSession] = useState<any>(isPreview ? getMockSession() : null);
  const [showLoading, setShowLoading] = useState(false);
  const [questions, setQuestions] = useState<Q[]>(isPreview ? [MOCK_Q] : []);
  const [students, setStudents] = useState<any[]>(isPreview ? MOCK_STUDENTS : []);
  const [me, setMe] = useState<any>(isPreview ? MOCK_STUDENTS[2] : null);
  const [phase, setPhase] = useState<"waiting"|"question"|"answered"|"output"|"hacking"|"breach"|"done">(
    isPreview ? ((searchParams.get("phase") as any) ?? "waiting") : "waiting"
  );
  const [picked, setPicked] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [output, setOutput] = useState<OutputResult | null>(null);
  const [currentQ, setCurrentQ] = useState<Q | null>(isPreview ? MOCK_Q : null);
  const [qSeed, setQSeed] = useState(0);
  const studentId = sessionId ? (localStorage.getItem(`hash_student_${sessionId}`) ?? (isPreview ? "me" : null)) : null;
  const startedAtRef = useRef<number>(0);
  const askedCount = useRef(0);
  // Keep a ref to students so hack_events callback can read current names
  // without causing the realtime channel to tear down on every score update.
  const studentsRef = useRef<any[]>([]);

  // paint root black while in game so cream body never bleeds through
  useEffect(() => {
    const prevHtml = document.documentElement.style.background;
    const prevBody = document.body.style.background;
    document.documentElement.style.background = "#050505";
    document.body.style.background = "#050505";
    // Prime audio on first user gesture (required by iOS Safari)
    const onFirstTouch = () => { primeAudio(); window.removeEventListener("pointerdown", onFirstTouch); };
    window.addEventListener("pointerdown", onFirstTouch, { once: true });
    return () => {
      document.documentElement.style.background = prevHtml;
      document.body.style.background = prevBody;
      window.removeEventListener("pointerdown", onFirstTouch);
    };
  }, []);

  // Only show loading screen if session takes >400ms to load (avoids flash on fast navigation)
  useEffect(() => {
    if (session) { setShowLoading(false); return; }
    const t = setTimeout(() => setShowLoading(true), 400);
    return () => clearTimeout(t);
  }, [session]);

  // initial load
  useEffect(() => {
    if (!sessionId) return;
    if (isPreview) {
      const p = (searchParams.get("phase") as any) ?? "waiting";
      setPhase(p);
      return;
    }
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
    if (!isPreview) {
      await supabase.from("question_responses").insert({
        session_id: sessionId, student_id: me.id, question_id: currentQ.id,
        question_index: askedCount.current, answer_index: idx, is_correct: correct,
      });
      await supabase.from("game_students").update({
        total_answers: me.total_answers + 1,
        correct_answers: me.correct_answers + (correct ? 1 : 0),
      }).eq("id", me.id);
    }
    if (correct) setTimeout(() => setPhase("output"), 700);
    else setTimeout(() => setPhase("answered"), 700);
  };

  const onOutput = async (r: OutputResult) => {
    setOutput(r);
    if (!me) return;
    let delta = 0;
    if (r.kind === "flat") delta = r.value;
    if (r.kind === "mult") delta = Math.floor(me.crypto * (r.value - 1));
    if (delta !== 0 && !isPreview) {
      await supabase.from("game_students").update({ crypto: me.crypto + delta }).eq("id", me.id);
    }
    if (r.kind === "hack") { setTimeout(() => setPhase("hacking"), 700); return; }
    setTimeout(() => { setQSeed(s => s + 1); setPhase("question"); }, 1200);
  };

  if (showLoading) return (
    <div className="theme-game terminal-screen min-h-screen text-foreground flex flex-col items-center justify-center font-mono gap-6">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 bg-[hsl(120_90%_62%)] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
        <div className="w-2 h-2 bg-[hsl(120_90%_62%)] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
        <div className="w-2 h-2 bg-[hsl(120_90%_62%)] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
      <p className="text-[hsl(120_90%_62%)] text-sm tracking-wider opacity-70">Connecting...</p>
    </div>
  );

  if (!session) return null;

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
  if (session.settings?.mode === "classic" && studentId) {
    return <ClassicGame sessionId={sessionId!} studentId={studentId} />;
  }
  if (session.settings?.mode === "humansvszombies" && studentId) {
    return <HumansVsZombiesGame sessionId={sessionId!} studentId={studentId} />;
  }
  if (session.settings?.mode === "dontlookdown" && studentId) {
    return <DontLookDownGame sessionId={sessionId!} studentId={studentId} />;
  }

  return (
    <div className="theme-game terminal-screen crt-flicker min-h-[100dvh] font-mono flex flex-col overflow-hidden"
      style={{ color: "hsl(120 90% 62%)" }}>
      <div className="pointer-events-none fixed inset-0 terminal-scanlines z-20" />
      <div className="pointer-events-none fixed inset-0 terminal-vignette z-20" />

      {/* minimal top strip — logo left, balance right, sits directly on the CRT glass */}
      <header className="relative shrink-0 flex items-center justify-between px-4 pt-3 pb-1 z-10">
        <img src={logoLight} alt="n7elha" className="h-6 w-6 object-contain" />
        <span className="flex items-center gap-1.5 text-sm font-bold tabular-nums" style={{ color: "hsl(120 100% 68%)" }}>
          ₿ {fmt(me?.crypto ?? 0)}
        </span>
      </header>

      <main className="relative flex-1 flex flex-col min-h-0 overflow-hidden z-10">

        {/* WAITING — boot sequence + peer list ─────────────────────────────── */}
        {phase === "waiting" && (
          <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-5 py-4 overflow-y-auto">
            <h1
              className="font-pixel text-center leading-[1.7] mb-4"
              style={{ fontSize: "clamp(13px, 4vw, 18px)" }}
            >
              <span style={{ color: "hsl(120 90% 55%)" }}>WELCOME </span>
              <span style={{ color: "hsl(0 0% 96%)" }}>HACKER</span>
            </h1>

            <div className="space-y-1 text-xs leading-relaxed mb-5" style={{ color: "hsl(120 80% 60%)" }}>
              <div>{">"} {ar ? "تم رصد لاعب جديد!" : "New player detected!"}</div>
              <div>{">"} {ar ? "جلسة #" : "session #"}{session.code}</div>
              <div>{">"} {ar ? "بانتظار بدء المضيف" : "waiting for host to start"}<span className="animate-pulse">_</span></div>
            </div>

            <div className="flex-1 space-y-px">
              {students.map((s, i) => {
                const isMe = s.id === studentId;
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 px-1 py-1.5 text-sm"
                    style={{
                      color: isMe ? "hsl(0 0% 96%)" : "hsl(120 70% 55%)",
                      animation: `fade-up 0.25s cubic-bezier(0.16,1,0.3,1) ${Math.min(i * 45, 450)}ms both`,
                    }}
                  >
                    <span style={{ color: "hsl(120 50% 38%)" }}>{">"}</span>
                    <span className="flex-1 truncate font-bold">{s.name}</span>
                    {isMe && (
                      <span className="text-[10px] tracking-widest" style={{ color: "hsl(120 50% 38%)" }}>
                        {ar ? "[أنت]" : "[you]"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-5 text-[11px] text-center" style={{ color: "hsl(120 50% 38%)" }}>
              {ar ? `[ ${students.length} متصل ]` : `[ ${students.length} connected ]`}
            </div>
          </div>
        )}

        {/* QUESTION / ANSWERED ──────────────────────────────────────────────── */}
        {(phase === "question" || phase === "answered") && currentQ && (
          <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-5 py-4 gap-5 overflow-hidden">
            <div className="shrink-0 pt-2">
              {(currentQ as any).image_url && (
                <img
                  src={(currentQ as any).image_url}
                  alt=""
                  className="mb-3 max-h-[24vh] w-auto object-contain"
                  style={{ border: "1px solid hsl(120 100% 55% / 0.3)" }}
                />
              )}
              <p className="text-lg md:text-xl font-bold leading-snug" style={{ color: "hsl(0 0% 96%)" }}>
                {currentQ.text}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 flex-1 min-h-0 overflow-y-auto auto-rows-max content-center">
              {currentQ.options.map((opt, i) => {
                const isCorrect = i === currentQ.correct_index;
                const isPicked  = picked === i;
                const showResult = picked !== null;

                let border = "hsl(120 100% 55% / 0.55)";
                let color  = "hsl(120 90% 62%)";
                let anim   = "";
                let opacity = 1;
                let shadow = "shadow-[3px_3px_0_0_hsl(120_90%_62%_/_0.5)]";

                if (showResult) {
                  if (isCorrect) {
                    color = "hsl(0 0% 100%)";
                    anim = "ans-correct";
                    shadow = "shadow-[4px_4px_0_0_hsl(120_100%_55%)]";
                  } else if (isPicked) {
                    border = "hsl(0 85% 60%)";
                    color = "hsl(0 0% 100%)";
                    anim = "ans-wrong";
                    shadow = "shadow-[4px_4px_0_0_hsl(0_85%_60%)]";
                  } else {
                    opacity = 0.35;
                  }
                }

                return (
                  <button
                    key={i}
                    disabled={picked !== null}
                    onClick={() => submit(i)}
                    className={cn("relative rounded-xl px-3 py-5 min-h-[72px] flex items-center justify-center font-bold text-sm leading-snug text-center transition-all active:scale-[0.97]", anim, shadow)}
                    style={{ border: `2px solid ${border}`, color, opacity, borderRadius: "12px" }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* DONE — shutdown log + leaderboard ────────────────────────────────── */}
        {phase === "done" && (() => {
          const myRank    = students.findIndex(s => s.id === studentId) + 1 || 1;
          const total     = students.length || 1;
          const top       = students.slice(0, 5);
          const isTop     = myRank === 1;
          const myBal     = me?.crypto ?? 0;

          return (
            <div className="flex-1 max-w-md mx-auto w-full px-5 py-4 flex flex-col gap-4 overflow-y-auto">
              <h1
                className="font-pixel text-center leading-[1.7] mb-1"
                style={{ fontSize: "clamp(12px, 3.6vw, 16px)" }}
              >
                <span style={{ color: "hsl(0 0% 96%)" }}>SESSION </span>
                <span style={{ color: "hsl(120 90% 55%)" }}>OVER</span>
              </h1>

              <div className="space-y-1 text-xs leading-relaxed" style={{ color: "hsl(120 80% 60%)" }}>
                <div>{">"} {ar ? "تفريغ المحافظ..." : "flushing wallets..."}</div>
                <div>{">"} {ar ? "حساب الترتيب..." : "computing leaderboard..."}</div>
                <div style={{ color: "hsl(0 0% 96%)" }}>
                  {">"} {isTop
                    ? (ar ? "أنت أفضل مخترق!" : "you're the top hacker!")
                    : (ar ? `ترتيبك #${myRank} من ${total}` : `you ranked #${myRank} of ${total}`)}
                </div>
              </div>

              <div className="text-sm py-2" style={{ color: "hsl(120 90% 62%)" }}>
                {">"} {ar ? "رصيدك النهائي" : "your final balance"}:{" "}
                <span className="font-bold" style={{ color: "hsl(0 0% 96%)" }}>₿{myBal.toLocaleString()}</span>
              </div>

              <div>
                <div className="text-[11px] mb-1.5" style={{ color: "hsl(120 50% 38%)" }}>
                  {ar ? "الترتيب" : "leaderboard"}
                </div>
                <div className="space-y-1">
                  {top.map((s: any, i: number) => {
                    const isMe = s.id === studentId;
                    return (
                      <div
                        key={s.id}
                        className="flex items-center gap-2 text-sm px-1 py-1"
                        style={{ color: isMe ? "hsl(0 0% 96%)" : "hsl(120 70% 55%)" }}
                      >
                        <span style={{ color: "hsl(120 50% 38%)" }}>{i + 1}.</span>
                        <span className="flex-1 truncate font-bold">{s.name}{isMe && " ←"}</span>
                        <span className="tabular-nums font-bold">₿{(s.crypto ?? 0).toLocaleString()}</span>
                      </div>
                    );
                  })}
                  {myRank > 5 && (
                    <div className="flex items-center gap-2 text-sm px-1 py-1" style={{ color: "hsl(0 0% 96%)" }}>
                      <span style={{ color: "hsl(120 50% 38%)" }}>{myRank}.</span>
                      <span className="flex-1 truncate font-bold">{me?.name} ←</span>
                      <span className="tabular-nums font-bold">₿{myBal.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => navigate("/play")}
                className="mt-auto py-3 text-sm font-bold"
                style={{ border: "2px solid hsl(120 100% 55% / 0.5)", color: "hsl(120 90% 62%)" }}
              >
                [ {ar ? "خروج" : "exit"} ]
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
