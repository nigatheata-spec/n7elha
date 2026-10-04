import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { playCorrect, playWrong, playBrick, playGameOver, primeAudio } from "@/lib/sound";
import MissedReview from "@/components/game/MissedReview";
import { LavaBackdrop, LavaQuestionView, LavaWrongScreen } from "@/components/game/LavaPhone";
import { LF_MODES, builtHeight, towerName, type LfMode, type Tower } from "@/lib/lavaFloor";

// ── Lava Floor — phone ───────────────────────────────────────────────────────
// Just the questions. The game is played in the room, so the towers and the
// lava are on the projector only. A correct answer lays a brick on the
// student's tower (or, while it's under the lava, counts toward climbing out);
// a wrong one shows the red screen with the right answer. The projector moves
// the lava and referees; this screen only sends answers. Rules: lavaFloor.ts.

type Q = { id: string; text: string; options: string[]; correct_index: number; image_url?: string };
type Phase = "waiting" | "question" | "correct" | "wrong" | "done";
type Student = { id: string; name: string; lf_tower: string | null; crypto: number | null };

const C = {
  bg: "#160C22", card: "#231229", line: "#41244A", text: "#F5EBD2", dim: "rgba(245,235,210,0.55)",
  lime: "#C6F04A",
};

interface Props { sessionId: string; studentId: string; }

const LavaFloorGame = ({ sessionId, studentId }: Props) => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const [session, setSession] = useState<any>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [towers, setTowers] = useState<Tower[]>([]);
  const [phase, setPhase] = useState<Phase>("waiting");
  const [q, setQ] = useState<Q | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  const deckRef = useRef<Q[]>([]);
  const askedRef = useRef(0);
  const qStartRef = useRef(0);
  const pickedRef = useRef<number | null>(null);
  const assignedRef = useRef(false);
  const statusRef = useRef<string | undefined>();
  statusRef.current = session?.status;

  const settings = session?.settings ?? {};
  const ar = (settings.lang ?? i18n.language) === "ar";
  const mode: LfMode = settings.lfMode ?? "class";
  const me = students.find(s => s.id === studentId) ?? null;
  const myTower = towers.find(t => t.id === me?.lf_tower) ?? null;

  // ── load + realtime ────────────────────────────────────────────────────────
  useEffect(() => {
    const onFirstTouch = () => primeAudio();
    window.addEventListener("pointerdown", onFirstTouch, { once: true });
    const loadStudents = async () => {
      const { data } = await supabase.from("game_students")
        .select("id,name,lf_tower,crypto").eq("session_id", sessionId).order("joined_at");
      setStudents((data ?? []) as Student[]);
    };
    const loadTowers = async () => {
      const { data } = await supabase.from("lava_towers").select("*").eq("session_id", sessionId).order("idx");
      setTowers((data ?? []) as Tower[]);
    };
    (async () => {
      const { data: s } = await supabase.from("game_sessions").select("*").eq("id", sessionId).maybeSingle();
      setSession(s);
      if (s?.quiz_id) {
        const { data: qs } = await supabase.from("questions").select("*").eq("quiz_id", s.quiz_id).order("position");
        setQuestions((qs ?? []).map((x: any) => ({ ...x, options: Array.isArray(x.options) ? x.options : [] })));
      }
      await Promise.all([loadStudents(), loadTowers()]);
    })();

    const ch = supabase.channel(`lf-game-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_sessions", filter: `id=eq.${sessionId}` },
        (p: any) => setSession((prev: any) => ({ ...prev, ...p.new })))
      .on("postgres_changes", { event: "*", schema: "public", table: "game_students", filter: `session_id=eq.${sessionId}` }, loadStudents)
      .on("postgres_changes", { event: "*", schema: "public", table: "lava_towers", filter: `session_id=eq.${sessionId}` }, loadTowers)
      .subscribe();
    return () => { window.removeEventListener("pointerdown", onFirstTouch); supabase.removeChannel(ch); };
  }, [sessionId]);

  // Joined after the start (or the host's assignment missed us): get a tower.
  useEffect(() => {
    if (session?.status !== "running" || !me || me.lf_tower || assignedRef.current) return;
    assignedRef.current = true;
    supabase.rpc("lava_floor_assign", { p_session_id: sessionId }).then(undefined, () => { assignedRef.current = false; });
  }, [session?.status, me?.lf_tower]);

  // ── phase from the session ─────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    if (session.status === "lobby") setPhase("waiting");
    else if (session.status === "running") setPhase(p => (p === "waiting" ? "question" : p));
    else if (session.status === "finished") { setPhase("done"); playGameOver(); }
    else if (session.status === "cancelled") {
      toast.error(ar ? "أغلق المعلّم الردهة" : "The teacher closed the lobby");
      navigate("/join");
    }
  }, [session?.status]);

  // ── questions: a shuffled deck, so nothing repeats until all have been seen ─
  const nextQuestion = () => {
    if (!questions.length || statusRef.current !== "running") return;
    if (!deckRef.current.length) deckRef.current = [...questions].sort(() => Math.random() - 0.5);
    setQ(deckRef.current.pop()!);
    setPicked(null);
    setTimedOut(false);
    pickedRef.current = null;
    askedRef.current += 1;
    qStartRef.current = Date.now();
    setPhase("question");
  };
  useEffect(() => { if (phase === "question" && !q) nextQuestion(); }, [phase, questions.length]);

  const timerOn = typeof settings.timePerQ === "number" && settings.timePerQ > 0;
  useEffect(() => {
    if (!timerOn || phase !== "question" || !q) return;
    const t = setInterval(() => {
      const left = Math.max(0, Math.ceil(settings.timePerQ - (Date.now() - qStartRef.current) / 1000));
      setTimeLeft(left);
      if (left <= 0) { clearInterval(t); answer(-1); }
    }, 200);
    return () => clearInterval(t);
  }, [phase, q, timerOn]);

  const answer = (idx: number) => {
    if (!q || !me || pickedRef.current !== null) return;
    pickedRef.current = idx;
    setPicked(idx);
    const correct = idx === q.correct_index;
    if (correct) {
      playCorrect(); playBrick();
      navigator.vibrate?.(30);
      setPhase("correct");
      setTimeout(nextQuestion, 650);
    } else {
      playWrong();
      setTimedOut(idx < 0);
      setPhase("wrong");   // straight to the red screen; it moves on by itself
    }
    supabase.rpc("lava_floor_answer", { p_student_id: me.id, p_correct: correct }).then(undefined, () => {});
    supabase.from("question_responses").insert({
      session_id: sessionId, student_id: me.id, question_id: q.id,
      question_index: askedRef.current, answer_index: idx, is_correct: correct,
    }).then(undefined, () => {});
  };

  const modeInfo = LF_MODES.find(m => m.id === mode)!;
  const font = { fontFamily: "'Outfit', 'Almarai', system-ui, sans-serif" };

  // ── waiting ────────────────────────────────────────────────────────────────
  if (phase === "waiting") {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center" style={{ ...font, background: C.bg, color: C.text }} dir={ar ? "rtl" : "ltr"}>
        <div className="text-sm tracking-widest opacity-60">{ar ? "الأرضية حمم" : "The floor is lava"}</div>
        <div className="text-3xl font-black">{me?.name ?? ""}</div>
        <div className="rounded-2xl px-5 py-4 max-w-sm" style={{ background: C.card, border: `2px solid ${C.line}` }}>
          <div className="font-bold" style={{ color: C.lime }}>{ar ? modeInfo.nameAr : modeInfo.nameEn}</div>
          <div className="text-sm mt-1.5 leading-relaxed" style={{ color: C.dim }}>{ar ? modeInfo.descAr : modeInfo.descEn}</div>
        </div>
        <div className="text-sm" style={{ color: C.dim }}>
          {ar ? `${students.length} في الغرفة · ننتظر المعلم` : `${students.length} in the room · waiting for the teacher`}
        </div>
      </div>
    );
  }

  // ── done ───────────────────────────────────────────────────────────────────
  if (phase === "done") {
    return (
      <div className="fixed inset-0 overflow-y-auto" style={{ ...font, background: C.bg, color: C.text }} dir={ar ? "rtl" : "ltr"}>
        <div className="max-w-md mx-auto px-5 py-10 flex flex-col items-center gap-5 text-center">
          <div className="text-sm opacity-60">{ar ? "انتهى الوقت" : "Time's up"}</div>
          <div className="text-4xl font-black" style={{ color: C.lime }}>
            {ar ? `وضعت ${me?.crypto ?? 0} طوبة` : `You laid ${me?.crypto ?? 0} bricks`}
          </div>
          {myTower && (
            <div className="text-sm" style={{ color: C.dim }}>
              {mode === "solo" ? "" : `${towerName(mode, myTower, ar)} · `}{ar ? `بنى ${builtHeight(myTower)} م` : `built ${builtHeight(myTower)} m`}
            </div>
          )}
          <MissedReview sessionId={sessionId} studentId={studentId} ar={ar} tone="dark" className="mx-auto mt-2" />
          <button onClick={() => navigate("/join")} className="mt-2 rounded-full px-8 py-3 font-bold" style={{ background: C.text, color: C.bg }}>
            {ar ? "خروج" : "Exit"}
          </button>
        </div>
      </div>
    );
  }

  // ── playing ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 flex flex-col" dir={ar ? "rtl" : "ltr"}>
      <LavaBackdrop />
      {q && (
        <LavaQuestionView q={q} picked={picked} correct={phase === "correct"} onAnswer={answer} ar={ar}
          timerFrac={timerOn && phase === "question" ? timeLeft / settings.timePerQ : null} />
      )}
      {phase === "wrong" && q && (
        <LavaWrongScreen ar={ar} answer={q.options[q.correct_index]} timedOut={timedOut} onDone={nextQuestion} />
      )}
    </div>
  );
};

export default LavaFloorGame;
