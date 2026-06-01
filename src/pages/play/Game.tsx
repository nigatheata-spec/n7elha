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

  // realtime
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
          const hacker = students.find(x => x.id === ev.hacker_id)?.name ?? "?";
          const target = students.find(x => x.id === ev.target_id)?.name ?? "?";
          if (ev.success) {
            if (ev.target_id === studentId) setPhase("breach");
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, studentId, students]);

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
        {phase === "waiting" && (
          <div className="text-center py-24 md:py-32">
            <div className="text-xl md:text-2xl text-[hsl(120_100%_55%)] animate-pulse">{"> بانتظار المعلّم..."}</div>
            <p className="text-muted-foreground mt-3 text-sm">{students.length} لاعب متصل</p>
          </div>
        )}

        {phase === "done" && (() => {
          const myRank   = students.findIndex(s => s.id === studentId) + 1 || 1;
          const total    = students.length || 1;
          const top3     = students.slice(0, 3);
          const rankColor =
            myRank === 1 ? "hsl(45 100% 58%)"
            : myRank === 2 ? "hsl(220 12% 76%)"
            : myRank === 3 ? "hsl(24 70% 56%)"
            : "hsl(120 60% 60%)";
          const rankGlow =
            myRank === 1 ? "hsl(45 100% 50% / 0.55)"
            : myRank === 2 ? "hsl(220 12% 70% / 0.35)"
            : myRank === 3 ? "hsl(24 70% 46% / 0.45)"
            : "transparent";
          const rankLabel =
            myRank === 1 ? "المركز الأول" : myRank === 2 ? "المركز الثاني"
            : myRank === 3 ? "المركز الثالث" : `المركز ${myRank}`;
          const AV_COLORS = ["#2563eb","#16a34a","#b45309","#dc2626","#7c3aed","#0891b2","#c2410c","#0f766e"];
          const av = (name: string) => {
            let h = 0;
            for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
            return AV_COLORS[Math.abs(h) % AV_COLORS.length];
          };
          return (
            <div className="flex flex-col items-center justify-center text-center gap-4 py-12 px-4">
              <div className="flex flex-col items-center gap-1">
                <Trophy className="h-10 w-10 mb-1" style={{ color: rankColor, filter: `drop-shadow(0 0 14px ${rankGlow})` }} />
                <div className="font-black text-lg" style={{ color: "hsl(120 100% 60%)" }}>انتهت اللعبة</div>
              </div>

              <div className="rounded-2xl px-8 py-5 flex flex-col items-center gap-1"
                style={{
                  background: `${rankColor}0f`,
                  border: `1.5px solid ${rankColor}50`,
                  boxShadow: myRank <= 3 ? `0 0 28px ${rankGlow}` : undefined,
                }}>
                <div className="font-black tabular-nums leading-none"
                  style={{ fontSize: "3.5rem", color: rankColor, textShadow: `0 0 28px ${rankGlow}` }}>
                  #{myRank}
                </div>
                <div className="font-bold text-sm" style={{ color: rankColor }}>{rankLabel}</div>
                <div className="text-xs mt-0.5" style={{ color: "hsl(120 20% 50%)" }}>من {total} طالب</div>
              </div>

              <div className="flex flex-col items-center gap-0.5">
                <span className="font-black text-2xl tabular-nums" style={{ color: "hsl(120 100% 60%)" }}>
                  ₿ {(me?.crypto ?? 0).toLocaleString()}
                </span>
                <span className="text-[10px]" style={{ color: "hsl(120 20% 50%)" }}>رصيدك النهائي</span>
              </div>

              {total > 1 && (
                <div className="w-full max-w-xs flex flex-col gap-1">
                  {top3.map((s: any, i: number) => {
                    const mc = i === 0 ? "hsl(45 100% 58%)" : i === 1 ? "hsl(220 12% 76%)" : "hsl(24 70% 56%)";
                    const isMe = s.id === studentId;
                    return (
                      <div key={s.id} className="flex items-center gap-2.5 rounded-xl px-3 py-2"
                        style={{
                          background: isMe ? `${mc}14` : "hsl(199 28% 14%)",
                          border: `1px solid ${isMe ? `${mc}40` : "hsl(199 20% 22%)"}`,
                        }}>
                        <span className="font-black text-xs w-5 tabular-nums text-right" style={{ color: mc }}>#{i + 1}</span>
                        <div style={{ background: av(s.name) }}
                          className="h-7 w-7 rounded-full flex items-center justify-center font-black text-white text-xs shrink-0">
                          {(s.name?.charAt(0) ?? "?").toUpperCase()}
                        </div>
                        <span className="flex-1 text-right text-xs font-bold truncate" style={{ color: isMe ? mc : "hsl(120 20% 72%)" }}>{s.name}</span>
                        <span className="text-xs font-black tabular-nums" style={{ color: "hsl(120 80% 55%)" }}>₿{s.crypto ?? 0}</span>
                      </div>
                    );
                  })}
                  {myRank > 3 && (
                    <div className="flex items-center gap-2.5 rounded-xl px-3 py-2 mt-0.5"
                      style={{ background: `${rankColor}0f`, border: `1px solid ${rankColor}40` }}>
                      <span className="font-black text-xs w-5 tabular-nums text-right" style={{ color: rankColor }}>#{myRank}</span>
                      <div style={{ background: av(me?.name ?? "?") }}
                        className="h-7 w-7 rounded-full flex items-center justify-center font-black text-white text-xs shrink-0">
                        {(me?.name?.charAt(0) ?? "?").toUpperCase()}
                      </div>
                      <span className="flex-1 text-right text-xs font-bold truncate" style={{ color: rankColor }}>{me?.name}</span>
                      <span className="text-xs font-black tabular-nums" style={{ color: "hsl(120 80% 55%)" }}>₿{me?.crypto ?? 0}</span>
                    </div>
                  )}
                </div>
              )}

              <Button className="mt-2 bg-primary text-primary-foreground" onClick={() => navigate("/play")}>خروج</Button>
            </div>
          );
        })()}

        {(phase === "question" || phase === "answered") && currentQ && (
          <div className="max-w-6xl mx-auto h-full flex flex-col">
            <div className="border-y-2 border-primary/40 bg-primary/5 px-4 py-6 md:py-12 text-center shadow-[inset_0_0_30px_hsl(var(--primary)/0.12)]">
              {(currentQ as any).image_url && (
                <img src={(currentQ as any).image_url} alt="" className="mx-auto mb-4 max-h-40 md:max-h-56 rounded-md border border-primary/30" />
              )}
              <p className="text-xl md:text-3xl lg:text-4xl text-[hsl(120_100%_75%)] font-medium leading-relaxed">
                {currentQ.text}
              </p>
              <div className="mt-3 text-xs text-[hsl(120_100%_45%)]">⏱ {timeLeft}s</div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2 flex-1">
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
                      "min-h-[110px] md:min-h-[180px] px-3 py-4 md:py-6 text-center text-base md:text-2xl text-primary font-medium border-2 border-primary/60 transition-all break-words active:scale-[0.98] rounded-none",
                      "bg-primary/10 hover:bg-primary/20 shadow-[inset_0_0_18px_hsl(var(--primary)/0.12)]",
                      showResult && isCorrect && "bg-[hsl(120_100%_50%)]",
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
