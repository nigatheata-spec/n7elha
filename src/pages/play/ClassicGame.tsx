import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";
import { playSelect, playCorrect, playWrong, playGameOver, primeAudio } from "@/lib/sound";

type Q = { id: string; text: string; options: string[]; correct_index: number; position: number; image_url?: string };
type Phase = "waiting" | "question" | "answered" | "done";

const fmt = (n: number) => n.toLocaleString();

const AV_COLORS = ["#FF8254", "#3F5A63", "#2563eb", "#16a34a", "#b45309", "#7c3aed", "#0891b2", "#c2410c"];
const av = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return { bg: AV_COLORS[Math.abs(h) % AV_COLORS.length], letter: (name.charAt(0) || "?").toUpperCase() };
};
const Avatar = ({ name, size = "md" }: { name: string; size?: "sm" | "md" | "xl" }) => {
  const { bg, letter } = av(name);
  const cls = size === "xl" ? "h-16 w-16 text-2xl" : size === "md" ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs";
  return (
    <div style={{ background: bg }}
      className={cn("rounded-full flex items-center justify-center font-black text-white select-none shrink-0 border-2 border-[hsl(var(--nb-border))]", cls)}>
      {letter}
    </div>
  );
};

// Kahoot-style speed scoring: faster correct answers earn more, floor at MIN_POINTS
const MAX_POINTS = 1000;
const MIN_POINTS = 100;

// DEV-ONLY PREVIEW HARNESS — /play/preview?preview=1&mode=classic&phase=waiting|question|done
const MOCK_STUDENTS = [
  { id: "s1", name: "Sara",   crypto: 3840, correct_answers: 8, total_answers: 9 },
  { id: "s2", name: "Omar",   crypto: 3100, correct_answers: 7, total_answers: 9 },
  { id: "me", name: "You",    crypto: 2750, correct_answers: 5, total_answers: 9 },
  { id: "s4", name: "Lina",   crypto: 1900, correct_answers: 4, total_answers: 9 },
  { id: "s5", name: "Yousef", crypto:  900, correct_answers: 2, total_answers: 9 },
];
const MOCK_Q: Q = {
  id: "q1", position: 0, correct_index: 1,
  text: "Which planet is known as the Red Planet?",
  options: ["Venus", "Mars", "Jupiter", "Saturn"],
};
const MOCK_SESSION = { id: "preview", code: "DEMO", quiz_id: "mock", status: "running", settings: { lang: "en", timePerQ: 20 } };

interface Props { sessionId: string; studentId: string; }

const ClassicGame = ({ sessionId, studentId }: Props) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get("preview") === "1" && searchParams.get("mode") === "classic";
  const { i18n } = useTranslation();
  const [session,   setSession]   = useState<any>(isPreview ? MOCK_SESSION : null);
  const [questions, setQuestions] = useState<Q[]>(isPreview ? [MOCK_Q] : []);
  const [students,  setStudents]  = useState<any[]>(isPreview ? MOCK_STUDENTS : []);
  const [me,        setMe]        = useState<any>(isPreview ? MOCK_STUDENTS[2] : null);
  const [phase, setPhase] = useState<Phase>(isPreview ? ((searchParams.get("phase") as any) ?? "waiting") : "waiting");
  const [picked,   setPicked]   = useState<number | null>(null);
  const [lastGain, setLastGain] = useState<number | null>(null);
  const [currentQ, setCurrentQ] = useState<Q | null>(isPreview ? MOCK_Q : null);
  const [qSeed,    setQSeed]    = useState(0);
  const startedAtRef = useRef<number>(0);
  const askedCount   = useRef(0);
  const studentsRef  = useRef<any[]>([]);
  const submitRef     = useRef<(idx: number) => void>(() => {});

  useEffect(() => {
    const onFirstTouch = () => { primeAudio(); window.removeEventListener("pointerdown", onFirstTouch); };
    window.addEventListener("pointerdown", onFirstTouch, { once: true });
    return () => window.removeEventListener("pointerdown", onFirstTouch);
  }, []);

  // initial load
  useEffect(() => {
    if (!sessionId) return;
    if (isPreview) {
      setPhase((searchParams.get("phase") as any) ?? "waiting");
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
    setLastGain(null);
    askedCount.current += 1;
    startedAtRef.current = Date.now();
  }, [phase, qSeed, questions]);

  const duration = session?.settings?.timePerQ ?? 20;

  const submit = async (idx: number) => {
    if (picked !== null || !currentQ || !me || !sessionId) return;
    playSelect();
    setPicked(idx);
    const correct = idx === currentQ.correct_index;
    const elapsed = (Date.now() - startedAtRef.current) / 1000;
    const timeFrac = Math.max(0, Math.min(1, 1 - elapsed / duration));
    const points = correct ? Math.round(MIN_POINTS + (MAX_POINTS - MIN_POINTS) * timeFrac) : 0;
    setLastGain(points);
    if (correct) playCorrect(); else playWrong();
    if (!isPreview) {
      await supabase.from("question_responses").insert({
        session_id: sessionId, student_id: me.id, question_id: currentQ.id,
        question_index: askedCount.current, answer_index: idx, is_correct: correct,
      });
      await supabase.from("game_students").update({
        crypto: me.crypto + points,
        total_answers: me.total_answers + 1,
        correct_answers: me.correct_answers + (correct ? 1 : 0),
      }).eq("id", me.id);
    } else {
      setMe((prev: any) => ({ ...prev, crypto: prev.crypto + points, total_answers: prev.total_answers + 1, correct_answers: prev.correct_answers + (correct ? 1 : 0) }));
    }
    setTimeout(() => setPhase("answered"), 700);
  };
  submitRef.current = submit;

  // countdown -> auto-submit on timeout
  useEffect(() => {
    if (phase !== "question" || !currentQ) return;
    const t = setInterval(() => {
      const elapsed = (Date.now() - startedAtRef.current) / 1000;
      if (elapsed >= duration) { submitRef.current(-1); clearInterval(t); }
    }, 200);
    return () => clearInterval(t);
  }, [phase, currentQ, duration]);

  // auto-advance after reveal
  useEffect(() => {
    if (phase !== "answered") return;
    const t = setTimeout(() => { setQSeed(s => s + 1); setPhase("question"); }, 1600);
    return () => clearTimeout(t);
  }, [phase]);

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center font-bold text-lg" style={{ background: "hsl(var(--background))", color: "hsl(var(--foreground))" }}>
      ...
    </div>
  );

  const ar = session.settings?.lang === "ar";
  const NB = "border-2 border-[hsl(var(--nb-border))]";

  return (
    <div className="min-h-[100dvh] flex flex-col overflow-hidden" style={{ background: "hsl(var(--background))", color: "hsl(var(--foreground))" }}>

      {/* top strip */}
      <header className="shrink-0 flex items-center justify-between px-4 py-3">
        <span className="font-bold text-sm truncate max-w-[50%]" style={{ color: "#3F5A63" }}>{me?.name ?? "—"}</span>
        <span className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full font-black text-sm tabular-nums bg-white", NB, "shadow-[3px_3px_0_0_hsl(var(--nb-border))]")} style={{ color: "#3F5A63" }}>
          ⭐ {fmt(me?.crypto ?? 0)}
        </span>
      </header>

      <main className="relative flex-1 flex flex-col min-h-0 overflow-hidden px-4">

        {/* WAITING ──────────────────────────────────────────────────────────── */}
        {phase === "waiting" && (
          <div className="flex-1 flex flex-col max-w-md mx-auto w-full py-4 overflow-y-auto">
            <h1 className="text-3xl font-black text-center mb-1" style={{ color: "#3F5A63" }}>
              {ar ? "استعد!" : "Get Ready!"}
            </h1>
            <p className="text-center text-sm mb-6" style={{ color: "hsl(199 15% 45%)" }}>
              {ar ? `جلسة #${session.code}` : `session #${session.code}`}
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              {students.map((s, i) => {
                const isMe = s.id === studentId;
                return (
                  <div
                    key={s.id}
                    className={cn("flex items-center gap-2.5 px-3 py-2.5 rounded-2xl bg-white", NB,
                      isMe ? "shadow-[4px_4px_0_0_hsl(var(--nb-border))]" : "shadow-[3px_3px_0_0_hsl(var(--nb-border))]")}
                    style={{ animation: `fade-up 0.3s cubic-bezier(0.16,1,0.3,1) ${Math.min(i * 50, 500)}ms both` }}
                  >
                    <Avatar name={s.name} size="sm" />
                    <span className="font-bold text-sm truncate" style={{ color: "#3F5A63" }}>{s.name}</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-auto pt-8 text-center text-xs font-medium" style={{ color: "hsl(199 15% 55%)" }}>
              {ar ? "بانتظار المعلّم لبدء الجلسة" : "waiting for the host to start"}
            </div>
          </div>
        )}

        {/* QUESTION / ANSWERED ──────────────────────────────────────────────── */}
        {(phase === "question" || phase === "answered") && currentQ && (
          <div className="flex-1 flex flex-col max-w-md mx-auto w-full py-4 gap-4 overflow-hidden">
            <div className={cn("rounded-2xl bg-white p-5 shrink-0", NB, "shadow-[4px_4px_0_0_hsl(var(--nb-border))]")}>
              {currentQ.image_url && (
                <img src={currentQ.image_url} alt="" className={cn("mb-3 max-h-[22vh] w-auto object-contain rounded-xl mx-auto", NB)} />
              )}
              <p className="text-lg font-bold text-center leading-snug" style={{ color: "#3F5A63" }}>
                {currentQ.text}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 auto-rows-min content-center flex-1 min-h-0 overflow-y-auto">
              {currentQ.options.map((opt, i) => {
                const isCorrect = i === currentQ.correct_index;
                const isPicked  = picked === i;
                const showResult = picked !== null;

                let bg = "white";
                let color = "#3F5A63";
                let shadowColor = "hsl(var(--nb-border))";
                let opacity = 1;
                let shadow = "shadow-[4px_4px_0_0_hsl(var(--nb-border))]";

                if (showResult) {
                  if (isCorrect) {
                    bg = "#FF8254"; color = "white";
                    shadow = "shadow-[5px_5px_0_0_hsl(var(--nb-border))] scale-[1.02]";
                  } else if (isPicked) {
                    bg = "hsl(0 84% 60%)"; color = "white";
                  } else {
                    opacity = 0.4;
                  }
                }

                return (
                  <button
                    key={i}
                    disabled={picked !== null}
                    onClick={() => submit(i)}
                    className={cn(
                      "relative rounded-2xl px-3 py-4 min-h-[84px] flex items-center justify-center font-bold text-sm md:text-base leading-snug text-center transition-all active:scale-[0.97]",
                      NB, shadow
                    )}
                    style={{ background: bg, color, opacity }}
                  >
                    {opt}
                    {showResult && isPicked && lastGain !== null && (
                      <span className="absolute -top-2.5 -right-2 px-2 py-0.5 rounded-full text-[11px] font-black bg-white text-[#3F5A63] border-2 border-[hsl(var(--nb-border))]">
                        +{lastGain}
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
          const ranked = [...students].sort((a, b) => (b.crypto ?? 0) - (a.crypto ?? 0));
          const myRank = ranked.findIndex(s => s.id === studentId) + 1 || 1;
          const winner = ranked[0];
          const rest   = ranked.slice(1, 6);

          return (
            <div className="flex-1 max-w-md mx-auto w-full py-4 flex flex-col gap-4 overflow-y-auto">
              <h1 className="text-2xl font-black text-center" style={{ color: "#3F5A63" }}>
                {ar ? "انتهى الوقت!" : "Time's Up!"}
              </h1>

              {winner && (
                <div className={cn("rounded-2xl bg-[#FF8254] p-5 flex flex-col items-center gap-2 text-center", NB, "shadow-[5px_5px_0_0_hsl(var(--nb-border))]")}>
                  <Trophy className="h-6 w-6 text-white" />
                  <Avatar name={winner.name} size="xl" />
                  <div className="font-black text-lg text-white">{winner.name}</div>
                  <div className="font-black text-2xl tabular-nums text-white">{fmt(winner.crypto ?? 0)} pts</div>
                </div>
              )}

              <div className="space-y-2">
                {rest.map((s, i) => {
                  const isMe = s.id === studentId;
                  return (
                    <div key={s.id} className={cn("flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-white", NB,
                      isMe ? "shadow-[4px_4px_0_0_hsl(var(--nb-border))]" : "shadow-[3px_3px_0_0_hsl(var(--nb-border))]")}>
                      <span className="font-black tabular-nums w-5 text-center text-sm" style={{ color: "hsl(199 15% 55%)" }}>{i + 2}</span>
                      <Avatar name={s.name} size="sm" />
                      <span className="font-bold text-sm flex-1 truncate" style={{ color: "#3F5A63" }}>{s.name}{isMe && " ←"}</span>
                      <span className="font-black tabular-nums text-sm" style={{ color: "#3F5A63" }}>{fmt(s.crypto ?? 0)}</span>
                    </div>
                  );
                })}
                {myRank > 6 && me && (
                  <div className={cn("flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-white", NB, "shadow-[4px_4px_0_0_hsl(var(--nb-border))]")}>
                    <span className="font-black tabular-nums w-5 text-center text-sm" style={{ color: "hsl(199 15% 55%)" }}>{myRank}</span>
                    <Avatar name={me.name} size="sm" />
                    <span className="font-bold text-sm flex-1 truncate" style={{ color: "#3F5A63" }}>{me.name} ←</span>
                    <span className="font-black tabular-nums text-sm" style={{ color: "#3F5A63" }}>{fmt(me.crypto ?? 0)}</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => navigate("/play")}
                className={cn("mt-auto py-3 rounded-2xl font-bold text-sm bg-[#3F5A63] text-white", NB, "shadow-[4px_4px_0_0_hsl(var(--nb-border))] hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_0_hsl(var(--nb-border))] transition-all")}
              >
                {ar ? "خروج" : "exit"}
              </button>
            </div>
          );
        })()}
      </main>
    </div>
  );
};

export default ClassicGame;
