import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Trophy, Zap, Shield, Clock, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { HackingFlow } from "@/components/game/HackingFlow";
import { BreachModal } from "@/components/game/BreachModal";
import { OutputCards, OutputResult } from "@/components/game/OutputCards";

type Q = { id: string; text: string; options: string[]; correct_index: number; position: number };
type Student = any;

const fmt = (n: number) => n.toLocaleString();

const Game = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [me, setMe] = useState<Student | null>(null);
  const [hackEvents, setHackEvents] = useState<any[]>([]);
  const [phase, setPhase] = useState<"waiting"|"question"|"answered"|"output"|"hacking"|"breach"|"done">("waiting");
  const [picked, setPicked] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [output, setOutput] = useState<OutputResult | null>(null);
  const [feed, setFeed] = useState<{id:string;text:string;kind:"good"|"bad"|"info"}[]>([]);
  const studentId = sessionId ? localStorage.getItem(`hash_student_${sessionId}`) : null;

  // initial load
  useEffect(() => {
    if (!sessionId) return;
    const load = async () => {
      const { data: s } = await supabase.from("game_sessions").select("*, quizzes(id, title)").eq("id", sessionId).maybeSingle();
      setSession(s);
      if (s?.quiz_id) {
        const { data: qs } = await supabase.from("questions").select("*").eq("quiz_id", s.quiz_id).order("position");
        setQuestions((qs ?? []).map((q: any) => ({ ...q, options: Array.isArray(q.options) ? q.options : [] })));
      }
      const { data: ss } = await supabase.from("game_students").select("*").eq("session_id", sessionId).order("crypto", { ascending: false });
      setStudents(ss ?? []);
      const m = (ss ?? []).find((x: any) => x.id === studentId);
      setMe(m);
    };
    load();
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
          setHackEvents(prev => [ev, ...prev].slice(0, 50));
          const hacker = students.find(x => x.id === ev.hacker_id)?.name ?? "?";
          const target = students.find(x => x.id === ev.target_id)?.name ?? "?";
          if (ev.success) {
            pushFeed(`${hacker} اخترق ${target} (+${fmt(ev.crypto_transferred)})`, "good");
            if (ev.target_id === studentId && session?.settings?.defenseEnabled) setPhase("breach");
          } else {
            pushFeed(`${hacker} فشل في اختراق ${target}`, "bad");
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, studentId, students, session]);

  const pushFeed = (text: string, kind: "good"|"bad"|"info") => {
    const id = crypto.randomUUID();
    setFeed(f => [{ id, text, kind }, ...f].slice(0, 8));
    setTimeout(() => setFeed(f => f.filter(x => x.id !== id)), 8000);
  };

  // sync phase from session
  useEffect(() => {
    if (!session) return;
    if (session.status === "lobby") setPhase("waiting");
    else if (session.status === "finished") setPhase("done");
    else if (session.status === "running") {
      setPhase(prev => (prev === "waiting" || prev === "done") ? "question" : prev);
    }
  }, [session?.status]);

  // when question index changes, reset
  const qIndex = session?.current_question_index ?? 0;
  const currentQ = questions[qIndex];
  const startedAt = session?.current_question_started_at;
  const duration = session?.settings?.timePerQ ?? 30;

  useEffect(() => {
    if (session?.status !== "running") return;
    setPicked(null);
    setOutput(null);
    setPhase(p => (p === "breach" || p === "hacking") ? p : "question");
  }, [qIndex]);

  // timer
  useEffect(() => {
    if (!startedAt || phase !== "question") return;
    const t = setInterval(() => {
      const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000;
      const left = Math.max(0, Math.ceil(duration - elapsed));
      setTimeLeft(left);
      if (left <= 0) { setPhase("answered"); clearInterval(t); }
    }, 200);
    return () => clearInterval(t);
  }, [startedAt, duration, phase]);

  const submit = async (idx: number) => {
    if (picked !== null || !currentQ || !me || !sessionId) return;
    setPicked(idx);
    const correct = idx === currentQ.correct_index;
    await supabase.from("question_responses").insert({
      session_id: sessionId, student_id: me.id, question_id: currentQ.id,
      question_index: qIndex, answer_index: idx, is_correct: correct,
    });
    await supabase.from("game_students").update({
      total_answers: me.total_answers + 1,
      correct_answers: me.correct_answers + (correct ? 1 : 0),
    }).eq("id", me.id);
    if (correct) {
      setTimeout(() => setPhase("output"), 900);
    } else {
      setTimeout(() => setPhase("answered"), 900);
    }
  };

  const onOutput = async (r: OutputResult) => {
    setOutput(r);
    if (!me) return;
    let delta = 0;
    if (r.kind === "flat") delta = r.value;
    if (r.kind === "mult") delta = Math.floor(me.crypto * (r.value - 1));
    if (delta !== 0) {
      await supabase.from("game_students").update({ crypto: me.crypto + delta }).eq("id", me.id);
      pushFeed(`+${fmt(delta)} 💰`, "good");
    }
    if (r.kind === "hack") { setTimeout(() => setPhase("hacking"), 700); return; }
    setTimeout(() => setPhase("answered"), 1200);
  };

  if (!session) return <div className="theme-game min-h-screen bg-background text-foreground flex items-center justify-center">...</div>;

  return (
    <div className="theme-game min-h-screen bg-background text-foreground bg-grid">
      {/* Top crypto */}
      <header className="sticky top-0 z-20 backdrop-blur bg-background/70 border-b border-primary/20">
        <div className="container py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" /> {me?.name ?? "—"}
          </div>
          <div className="text-center">
            <div className="text-[10px] font-mono text-muted-foreground tracking-widest">CRYPTO</div>
            <div className="font-mono text-3xl md:text-5xl font-black text-glow-amber" style={{color:"hsl(51 100% 50%)"}}>
              <Coins className="inline h-5 w-5 me-1" />{fmt(me?.crypto ?? 0)}
            </div>
          </div>
          <div className="text-xs font-mono text-muted-foreground">
            Q {Math.min(qIndex+1, questions.length)}/{questions.length}
          </div>
        </div>
      </header>

      <div className="container grid md:grid-cols-[220px_1fr] gap-4 py-4">
        {/* Leaderboard */}
        <aside className="space-y-2">
          <div className="text-xs font-mono text-muted-foreground flex items-center gap-2"><Trophy className="h-3 w-3" /> LEADERBOARD</div>
          {students.slice(0, 5).map((s, i) => (
            <div key={s.id} className={cn("flex items-center justify-between px-3 py-2 rounded-lg border text-sm",
              s.id === studentId ? "border-primary bg-primary/10" : "border-border bg-card/40")}>
              <span className="font-mono">#{i+1} {s.name}</span>
              <span className="font-mono text-xs" style={{color:"hsl(51 100% 50%)"}}>{fmt(s.crypto)}</span>
            </div>
          ))}
        </aside>

        {/* Main */}
        <main>
          {phase === "waiting" && (
            <div className="text-center py-20">
              <div className="font-mono text-2xl text-primary text-glow-cyan animate-pulse">{"> WAITING_FOR_HOST..."}</div>
              <p className="text-muted-foreground mt-3 text-sm">{students.length} مخترقين متصلين</p>
            </div>
          )}

          {phase === "done" && (
            <div className="text-center py-12">
              <Trophy className="h-16 w-16 mx-auto" style={{color:"hsl(51 100% 50%)"}} />
              <h2 className="font-mono text-3xl mt-3 text-glow-cyan">GAME OVER</h2>
              <div className="mt-6 max-w-md mx-auto space-y-2">
                {students.map((s, i) => (
                  <div key={s.id} className={cn("flex items-center justify-between p-3 rounded-lg border",
                    s.id === studentId ? "border-primary bg-primary/10" : "border-border bg-card/40")}>
                    <span className="font-mono">#{i+1} {s.name}</span>
                    <span className="font-mono" style={{color:"hsl(51 100% 50%)"}}>{fmt(s.crypto)}</span>
                  </div>
                ))}
              </div>
              <Button className="mt-6 bg-primary text-primary-foreground" onClick={() => navigate("/play")}>خروج</Button>
            </div>
          )}

          {(phase === "question" || phase === "answered") && currentQ && (
            <div>
              <div className="flex items-center justify-between mb-3 font-mono text-xs">
                <span className="text-muted-foreground">QUESTION_{qIndex+1}</span>
                {session.settings?.showTimer !== false && (
                  <span className={cn("flex items-center gap-1 px-2 py-1 rounded border",
                    timeLeft > duration*0.5 ? "border-success text-success" :
                    timeLeft > duration*0.25 ? "border-accent text-accent" : "border-destructive text-destructive animate-pulse")}>
                    <Clock className="h-3 w-3" /> {timeLeft}s
                  </span>
                )}
              </div>
              <div className="border-glow rounded-2xl p-6 bg-card/60 mb-4">
                <p className="text-xl text-center font-medium">{currentQ.text}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentQ.options.map((opt, i) => {
                  const isCorrect = i === currentQ.correct_index;
                  const isPicked = picked === i;
                  const showResult = picked !== null;
                  return (
                    <button key={i} disabled={picked !== null}
                      onClick={() => submit(i)}
                      className={cn("rounded-xl p-4 text-start border-2 font-medium transition-all",
                        !showResult && "border-primary/30 bg-card/40 hover:border-primary hover:bg-primary/10",
                        showResult && isCorrect && "border-success bg-success/20 text-success",
                        showResult && isPicked && !isCorrect && "border-destructive bg-destructive/20 text-destructive",
                        showResult && !isPicked && !isCorrect && "opacity-40")}>
                      <span className="font-mono text-xs me-2 opacity-60">{String.fromCharCode(65+i)}.</span>
                      {opt}
                    </button>
                  );
                })}
              </div>
              {phase === "answered" && (
                <p className="text-center mt-6 font-mono text-sm text-muted-foreground">{"> AWAITING_NEXT_QUESTION..."}</p>
              )}
            </div>
          )}

          {phase === "output" && me && (
            <OutputCards
              hackPct={session.settings?.hackPct ?? 15}
              onPick={onOutput}
              picked={output}
            />
          )}

          {phase === "hacking" && me && (
            <HackingFlow
              me={me}
              students={students.filter(s => s.id !== me.id)}
              sessionId={sessionId!}
              onDone={() => setPhase("answered")}
              passwords={["alpha","bravo","delta","echo","ghost","shadow","matrix","neon","quantum","vortex"]}
            />
          )}
        </main>
      </div>

      {/* Feed */}
      <div className="fixed bottom-3 inset-x-0 px-3 z-30 pointer-events-none">
        <div className="container space-y-1 max-w-md mx-auto">
          {feed.map(f => (
            <div key={f.id} className={cn("font-mono text-xs px-3 py-2 rounded-lg backdrop-blur border",
              f.kind === "good" && "border-success/40 bg-success/10 text-success",
              f.kind === "bad" && "border-destructive/40 bg-destructive/10 text-destructive",
              f.kind === "info" && "border-primary/40 bg-primary/10 text-primary",
              "animate-fade-in")}>
              {f.text}
            </div>
          ))}
        </div>
      </div>

      {phase === "breach" && me && (
        <BreachModal
          me={me}
          onDone={async () => {
            await supabase.from("game_students").update({ is_breached: false }).eq("id", me.id);
            setPhase("answered");
          }}
        />
      )}
    </div>
  );
};
export default Game;
