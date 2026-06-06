import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { HackingFlow } from "@/components/game/HackingFlow";
import { BreachModal } from "@/components/game/BreachModal";
import { OutputCards, OutputResult } from "@/components/game/OutputCards";
import DodgeballGame from "./DodgeballGame";
import HotPotatoGame from "./HotPotatoGame";
import LavaFloorGame from "./LavaFloorGame";

type Q = { id: string; text: string; options: string[]; correct_index: number; position: number };

const fmt = (n: number) => n.toLocaleString();

const Game = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
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

  // paint root black while in game so cream body never bleeds through
  useEffect(() => {
    const prevHtml = document.documentElement.style.background;
    const prevBody = document.body.style.background;
    document.documentElement.style.background = "#050505";
    document.body.style.background = "#050505";
    return () => {
      document.documentElement.style.background = prevHtml;
      document.body.style.background = prevBody;
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
            if (ev.target_id === studentId) setPhase("breach");
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
    }
  }, [session?.status]);

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
    setPicked(idx);
    const correct = idx === currentQ.correct_index;
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

  if (!session) return <div className="theme-game terminal-screen min-h-screen text-foreground flex items-center justify-center font-mono">...</div>;

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
    <div className="theme-game terminal-screen min-h-[100dvh] text-foreground font-mono flex flex-col overflow-hidden">
      <div className="pointer-events-none fixed inset-0 terminal-scanlines" />
      {/* Minimal sticky top bar — name left, ₿ crypto right */}
      <header className="relative flex items-center justify-between px-4 py-3 text-primary border-b border-primary/30 sticky top-0 bg-background/75 backdrop-blur-sm z-10">
        <div className="font-medium text-sm md:text-base truncate max-w-[55%]">{me?.name ?? "—"}</div>
        <div className="text-lg md:text-xl font-bold tracking-wider whitespace-nowrap">
          ₿ {fmt(me?.crypto ?? 0)}
        </div>
      </header>

      <main className="relative flex-1 px-3 md:px-6 pb-4">
        {phase === "waiting" && (() => {
          const AV_COLORS = ["#16a34a","#0891b2","#7c3aed","#dc2626","#b45309","#2563eb","#c2410c","#0f766e"];
          const av = (name: string) => {
            let h = 0;
            for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
            return AV_COLORS[Math.abs(h) % AV_COLORS.length];
          };
          return (
            <div className="max-w-3xl mx-auto py-8 md:py-12 px-2">
              {/* terminal header */}
              <div className="mb-6 font-mono text-xs" style={{ color: "hsl(120 60% 38%)" }}>
                $ ./connect --session={session.code}
              </div>

              <div className="text-center mb-8">
                <div
                  className="font-mono text-2xl md:text-3xl font-bold mb-2"
                  style={{ color: "hsl(120 100% 60%)", textShadow: "0 0 20px hsl(120 100% 55% / 0.5)" }}
                >
                  {"> awaiting handshake"}<span className="animate-pulse">█</span>
                </div>
                <p className="font-mono text-xs md:text-sm" style={{ color: "hsl(120 40% 45%)" }}>
                  بانتظار المعلّم لبدء الجلسة
                </p>
              </div>

              {/* live joiner count */}
              <div
                className="flex items-center justify-between font-mono text-xs px-3 py-2 mb-3"
                style={{
                  borderTop: "1px solid hsl(120 100% 55% / 0.18)",
                  borderBottom: "1px solid hsl(120 100% 55% / 0.18)",
                  color: "hsl(120 60% 50%)",
                }}
              >
                <span>HACKERS_ONLINE</span>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: "hsl(120 100% 55%)" }} />
                  <span className="font-bold tabular-nums" style={{ color: "hsl(120 100% 60%)" }}>
                    {students.length.toString().padStart(2, "0")}
                  </span>
                </span>
              </div>

              {/* student grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {students.map((s, i) => {
                  const isMe = s.id === studentId;
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-2.5 p-2.5 rounded-md transition-all"
                      style={{
                        background: isMe ? "hsl(120 100% 55% / 0.10)" : "hsl(120 100% 55% / 0.03)",
                        border: `1px solid hsl(120 100% 55% / ${isMe ? 0.5 : 0.18})`,
                        animation: `fade-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${Math.min(i * 60, 600)}ms both`,
                      }}
                    >
                      <div
                        className="h-8 w-8 rounded-full flex items-center justify-center font-black text-white text-xs shrink-0 font-mono"
                        style={{ background: av(s.name) }}
                      >
                        {(s.name?.charAt(0) ?? "?").toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className="font-mono text-xs font-bold truncate"
                          style={{ color: isMe ? "hsl(120 100% 65%)" : "hsl(120 60% 55%)" }}
                        >
                          {s.name}
                        </div>
                        {isMe && (
                          <div className="font-mono text-[9px]" style={{ color: "hsl(120 60% 38%)" }}>
                            [ you ]
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
                    className="flex items-center gap-2.5 p-2.5 rounded-md"
                    style={{
                      background: "transparent",
                      border: "1px dashed hsl(120 100% 55% / 0.10)",
                      opacity: 0.5,
                    }}
                  >
                    <div
                      className="h-8 w-8 rounded-full shrink-0 font-mono flex items-center justify-center"
                      style={{ background: "hsl(120 100% 55% / 0.05)", color: "hsl(120 40% 30%)" }}
                    >
                      ?
                    </div>
                    <div
                      className="font-mono text-xs"
                      style={{ color: "hsl(120 40% 25%)" }}
                    >
                      waiting...
                    </div>
                  </div>
                ))}
              </div>

              {/* footer status */}
              <div
                className="mt-6 font-mono text-[10px] text-center animate-pulse"
                style={{ color: "hsl(120 40% 35%)" }}
              >
                [ press start on teacher's screen to begin ]
              </div>
            </div>
          );
        })()}

        {phase === "done" && (() => {
          const myRank = students.findIndex(s => s.id === studentId) + 1 || 1;
          const total  = students.length || 1;
          const top    = students.slice(0, 5);
          const isTop  = myRank === 1;
          const myBal  = me?.crypto ?? 0;
          const totalLoot = students.reduce((a, s) => a + (s.crypto || 0), 0);

          return (
            <div className="max-w-2xl mx-auto py-6 px-2 font-mono">
              {/* boot terminal log */}
              <div className="space-y-1 text-xs mb-5" style={{ color: "hsl(120 60% 38%)" }}>
                <div>$ session.disconnect --code={session.code}</div>
                <div>{">"} flushing wallets...</div>
                <div>{">"} computing leaderboard...</div>
                <div style={{ color: "hsl(120 100% 60%)" }}>{">"} CONNECTION_TERMINATED</div>
              </div>

              {/* status badge */}
              <div className="mb-5">
                <div
                  className="inline-block text-xs px-3 py-1.5 rounded-sm font-bold tracking-widest"
                  style={{
                    background: isTop ? "hsl(120 100% 55% / 0.18)" : "hsl(120 100% 55% / 0.06)",
                    color: isTop ? "hsl(120 100% 70%)" : "hsl(120 60% 55%)",
                    border: `1px solid hsl(120 100% 55% / ${isTop ? 0.6 : 0.25})`,
                    textShadow: isTop ? "0 0 12px hsl(120 100% 55% / 0.5)" : "none",
                  }}
                >
                  {isTop ? "[ TOP_HACKER ]" : `[ RANK_${String(myRank).padStart(2, "0")} ]`}
                </div>
              </div>

              {/* main ascii box: balance display */}
              <pre
                className="text-xs md:text-sm leading-tight overflow-x-auto whitespace-pre mb-4"
                style={{ color: "hsl(120 100% 55%)" }}
              >
{`╔══════════════════════════════════════════╗
║  WALLET_BAL    ₿ ${myBal.toLocaleString().padStart(18, " ")}  ║
║  YOUR_RANK     ${`#${myRank}`.padStart(20, " ")}  ║
║  HACKERS       ${`${total}`.padStart(20, " ")}  ║
╚══════════════════════════════════════════╝`}
              </pre>

              {/* stats row */}
              <div className="grid grid-cols-3 gap-2 mb-5 text-xs">
                {[
                  { label: "correct", value: me?.correct_answers ?? 0 },
                  { label: "answered", value: me?.total_answers ?? 0 },
                  { label: "of_pool", value: `${Math.round((myBal / Math.max(totalLoot, 1)) * 100)}%` },
                ].map(s => (
                  <div
                    key={s.label}
                    className="p-2.5 rounded-sm"
                    style={{
                      background: "hsl(120 100% 55% / 0.04)",
                      border: "1px solid hsl(120 100% 55% / 0.18)",
                    }}
                  >
                    <div className="text-[10px] tracking-widest" style={{ color: "hsl(120 60% 38%)" }}>
                      {s.label.toUpperCase().replace("_", "_")}
                    </div>
                    <div className="text-base font-bold tabular-nums" style={{ color: "hsl(120 100% 65%)" }}>
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* leaderboard as tail output */}
              <div className="mb-5">
                <div className="text-xs mb-2 tracking-widest" style={{ color: "hsl(120 60% 38%)" }}>
                  $ tail leaderboard.log
                </div>
                <div className="space-y-0.5">
                  {top.map((s: any, i: number) => {
                    const isMe = s.id === studentId;
                    return (
                      <div
                        key={s.id}
                        className="flex items-center gap-3 text-xs md:text-sm px-3 py-1.5 rounded-sm"
                        style={{
                          background: isMe ? "hsl(120 100% 55% / 0.10)" : "transparent",
                          border: `1px solid hsl(120 100% 55% / ${isMe ? 0.45 : 0.10})`,
                          color: i === 0 ? "hsl(120 100% 70%)" : "hsl(120 60% 55%)",
                          textShadow: i === 0 ? "0 0 10px hsl(120 100% 55% / 0.4)" : "none",
                        }}
                      >
                        <span className="w-6 tabular-nums font-bold">#{i + 1}</span>
                        <span className="flex-1 truncate font-bold">{s.name}{isMe && " ←"}</span>
                        <span className="tabular-nums font-bold">₿{(s.crypto ?? 0).toLocaleString()}</span>
                      </div>
                    );
                  })}
                  {myRank > 5 && (
                    <>
                      <div className="text-center text-xs" style={{ color: "hsl(120 40% 30%)" }}>...</div>
                      <div
                        className="flex items-center gap-3 text-xs md:text-sm px-3 py-1.5 rounded-sm"
                        style={{
                          background: "hsl(120 100% 55% / 0.10)",
                          border: "1px solid hsl(120 100% 55% / 0.45)",
                          color: "hsl(120 100% 65%)",
                        }}
                      >
                        <span className="w-6 tabular-nums font-bold">#{myRank}</span>
                        <span className="flex-1 truncate font-bold">{me?.name} ←</span>
                        <span className="tabular-nums font-bold">₿{myBal.toLocaleString()}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <button
                onClick={() => navigate("/play")}
                className="w-full py-2.5 text-sm font-bold tracking-widest transition-all rounded-sm"
                style={{
                  background: "hsl(120 100% 55% / 0.10)",
                  color: "hsl(120 100% 65%)",
                  border: "1px solid hsl(120 100% 55% / 0.5)",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "hsl(120 100% 55% / 0.20)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "hsl(120 100% 55% / 0.10)"; }}
              >
                [ disconnect ]
              </button>
            </div>
          );
        })()}

        {(phase === "question" || phase === "answered") && currentQ && (
          <div className="max-w-6xl mx-auto h-full w-full flex flex-col gap-3 pb-safe">
            <div className="border-y-2 border-primary/40 bg-primary/5 px-4 py-4 md:py-12 text-center shadow-[inset_0_0_30px_hsl(var(--primary)/0.12)] shrink-0">
              {(currentQ as any).image_url && (
                <img
                  src={(currentQ as any).image_url}
                  alt=""
                  className="mx-auto mb-3 max-h-[28vh] md:max-h-56 w-auto object-contain rounded-md border border-primary/30"
                />
              )}
              <p className="text-lg md:text-3xl lg:text-4xl text-[hsl(120_100%_75%)] font-medium leading-relaxed">
                {currentQ.text}
              </p>
              <div className="mt-2 text-xs text-[hsl(120_100%_45%)] tabular-nums">⏱ {timeLeft}s</div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 px-2 md:px-0 flex-1 min-h-0">
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
                      "min-h-[96px] md:min-h-[180px] px-3 py-3 md:py-6 text-center text-base md:text-2xl text-primary font-medium border-2 border-primary/60 transition-all break-words active:scale-[0.98] rounded-xl leading-snug",
                      "bg-primary/10 hover:bg-primary/20 shadow-[inset_0_0_18px_hsl(var(--primary)/0.12)]",
                      showResult && isCorrect && "bg-[hsl(120_100%_50%)] text-black",
                      showResult && isPicked && !isCorrect && "bg-[hsl(0_85%_55%)] text-white",
                      showResult && !isPicked && !isCorrect && "opacity-40"
                    )}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {phase === "output" && me && (
          <OutputCards onPick={onOutput} picked={output} />
        )}

        {phase === "hacking" && me && (
          <HackingFlow
            me={me}
            students={students.filter(s => s.id !== me.id)}
            sessionId={sessionId!}
            onDone={() => { setQSeed(s => s + 1); setPhase("question"); }}
          />
        )}
      </main>

      {phase === "breach" && me && (
        <BreachModal me={me} onDone={async () => {
          await supabase.from("game_students").update({ is_breached: false }).eq("id", me.id);
          setQSeed(s => s + 1); setPhase("question");
        }} />
      )}
    </div>
  );
};
export default Game;
