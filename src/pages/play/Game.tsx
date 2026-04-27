import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { HackingFlow } from "@/components/game/HackingFlow";
import { BreachModal } from "@/components/game/BreachModal";
import { OutputCards, OutputResult } from "@/components/game/OutputCards";

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

        {phase === "done" && (
          <div className="text-center py-20">
            <Trophy className="h-16 w-16 mx-auto" style={{color:"hsl(120 100% 50%)"}} />
            <h2 className="text-3xl mt-3 text-[hsl(120_100%_60%)]">انتهت اللعبة</h2>
            <Button className="mt-6 bg-primary text-primary-foreground" onClick={() => navigate("/play")}>خروج</Button>
          </div>
        )}

        {(phase === "question" || phase === "answered") && currentQ && (
          <div className="max-w-6xl mx-auto h-full flex flex-col">
            <div className="border-y-2 border-primary/40 bg-primary/5 px-4 py-6 md:py-12 text-center shadow-[inset_0_0_30px_hsl(var(--primary)/0.12)]">
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
