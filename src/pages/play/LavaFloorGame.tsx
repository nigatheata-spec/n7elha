import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { FACES } from "@/lib/avatarIdentity";
import { playCorrect, playWrong, playBrick, playGameOver, primeAudio } from "@/lib/sound";
import MissedReview from "@/components/game/MissedReview";
import {
  LF_MODES, climbNeed, lavaNow, towerHeight, towerName, ERUPT_SECS, LAVA_START,
  type LavaState, type LfMode, type Tower,
} from "@/lib/lavaFloor";
import { drawBoard, fitCamera, faceImage, toBoard, type Camera, type LfStudent } from "@/lib/lavaFloorRender";

// ── Lava Floor — phone ───────────────────────────────────────────────────────
// Your tower and the lava on top, the question underneath. A correct answer
// lays a brick under your feet (or, while your tower is under the lava, counts
// toward climbing out). The projector moves the lava and referees; this screen
// only sends answers. Rules: lavaFloor.ts.

type Q = { id: string; text: string; options: string[]; correct_index: number; image_url?: string };
type Phase = "waiting" | "question" | "feedback" | "done";
type Student = LfStudent & { correct_answers: number | null; total_answers: number | null };

const C = {
  bg: "#160C22", card: "#231229", line: "#41244A", text: "#F5EBD2", dim: "rgba(245,235,210,0.55)",
  lime: "#C6F04A", coral: "#FF6B4F", amber: "#FFB347",
};

interface Props { sessionId: string; studentId: string; }

const LavaFloorGame = ({ sessionId, studentId }: Props) => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const [session, setSession] = useState<any>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [towers, setTowers] = useState<Tower[]>([]);
  const [lava, setLava] = useState<LavaState | null>(null);
  const [phase, setPhase] = useState<Phase>("waiting");
  const [q, setQ] = useState<Q | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [margin, setMargin] = useState(0);
  const [erupting, setErupting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camRef = useRef<Camera | null>(null);
  const landRef = useRef<Map<string, number>>(new Map());
  const deckRef = useRef<Q[]>([]);
  const askedRef = useRef(0);
  const qStartRef = useRef(0);
  const pickedRef = useRef<number | null>(null);
  const assignedRef = useRef(false);
  const stateRef = useRef({ towers, students, lava });
  stateRef.current = { towers, students, lava };
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
        .select("id,name,avatar_color,avatar_face,lf_tower,crypto,correct_answers,total_answers").eq("session_id", sessionId).order("joined_at");
      setStudents((data ?? []) as Student[]);
    };
    const loadTowers = async () => {
      const { data } = await supabase.from("lava_towers").select("*").eq("session_id", sessionId).order("idx");
      setTowers((data ?? []) as Tower[]);
    };
    const loadLava = async () => {
      const { data } = await supabase.from("lava_state").select("*").eq("session_id", sessionId).maybeSingle();
      if (data) setLava(data as LavaState);
    };
    (async () => {
      const { data: s } = await supabase.from("game_sessions").select("*").eq("id", sessionId).maybeSingle();
      setSession(s);
      if (s?.quiz_id) {
        const { data: qs } = await supabase.from("questions").select("*").eq("quiz_id", s.quiz_id).order("position");
        setQuestions((qs ?? []).map((x: any) => ({ ...x, options: Array.isArray(x.options) ? x.options : [] })));
      }
      await Promise.all([loadStudents(), loadTowers(), loadLava()]);
    })();
    FACES.forEach((_, i) => faceImage(i));

    const ch = supabase.channel(`lf-game-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_sessions", filter: `id=eq.${sessionId}` },
        (p: any) => setSession((prev: any) => ({ ...prev, ...p.new })))
      .on("postgres_changes", { event: "*", schema: "public", table: "game_students", filter: `session_id=eq.${sessionId}` }, loadStudents)
      .on("postgres_changes", { event: "*", schema: "public", table: "lava_towers", filter: `session_id=eq.${sessionId}` }, loadTowers)
      .on("postgres_changes", { event: "*", schema: "public", table: "lava_state", filter: `session_id=eq.${sessionId}` },
        (p: any) => p.new && setLava(p.new as LavaState))
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
    if (!questions.length) return;
    if (!deckRef.current.length) deckRef.current = [...questions].sort(() => Math.random() - 0.5);
    const next = deckRef.current.pop()!;
    setQ(next);
    setPicked(null);
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
      if (!myTower?.dunked) landRef.current.set(me.id, Date.now());
      navigator.vibrate?.(30);
    } else playWrong();
    supabase.rpc("lava_floor_answer", { p_student_id: me.id, p_correct: correct }).then(undefined, () => {});
    supabase.from("question_responses").insert({
      session_id: sessionId, student_id: me.id, question_id: q.id,
      question_index: askedRef.current, answer_index: idx, is_correct: correct,
    }).then(undefined, () => {});
    setPhase("feedback");
    setTimeout(() => { if (statusRef.current === "running") nextQuestion(); }, correct ? 650 : 1700);
  };

  // ── the strip: my tower and the lava ───────────────────────────────────────
  const running = phase === "question" || phase === "feedback";
  useEffect(() => {
    if (!running) return;
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    let raf = 0, lastHud = 0, wasErupting = false;
    const frame = (pt: number) => {
      const now = Date.now();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const { towers, students, lava } = stateRef.current;
      const level = lava ? lavaNow(lava, now) : LAVA_START;
      const eruptAge = lava?.erupt_at ? (now - new Date(lava.erupt_at).getTime()) / 1000 : Infinity;
      const surge = eruptAge >= 0 && eruptAge < ERUPT_SECS ? Math.sin((eruptAge / ERUPT_SECS) * Math.PI) : 0;

      const board = toBoard(towers, students, landRef.current, mode, ar);
      const mine = students.find(s => s.id === studentId)?.lf_tower;
      const focus = board.filter(b => b.id === mine);
      camRef.current = fitCamera(camRef.current, focus.length ? focus : board, level, h, 34, 34);
      drawBoard(ctx, w, h, {
        towers: board, lava: level, cam: camRef.current, t: pt / 1000, now,
        erupting: surge, shake: surge * 5, ar, meId: studentId, padX: 16, minSlot: 46, rulerTop: 8, scenery: false,
      });

      if (now - lastHud > 250) {
        lastHud = now;
        const t = towers.find(x => x.id === mine);
        if (t) setMargin(towerHeight(t) - level);
        const on = surge > 0;
        if (on && !wasErupting) navigator.vibrate?.([120, 60, 120]);
        wasErupting = on;
        setErupting(on);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running, mode, ar, studentId]);

  const modeInfo = LF_MODES.find(m => m.id === mode)!;
  const myLabel = myTower && mode !== "solo" ? towerName(mode, myTower, ar) : null;
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
    const ranked = [...towers].sort((a, b) => towerHeight(b) - towerHeight(a));
    const rank = myTower ? ranked.findIndex(t => t.id === myTower.id) + 1 : 0;
    const headline = mode === "class"
      ? (ar ? `بنيتم ${myTower ? towerHeight(myTower) : 0} متر معًا` : `You built ${myTower ? towerHeight(myTower) : 0} meters together`)
      : rank === 1 ? (ar ? "أعلى برج!" : "Tallest tower!")
      : (ar ? `المركز ${rank} من ${ranked.length}` : `Place ${rank} of ${ranked.length}`);
    return (
      <div className="fixed inset-0 overflow-y-auto" style={{ ...font, background: C.bg, color: C.text }} dir={ar ? "rtl" : "ltr"}>
        <div className="max-w-md mx-auto px-5 py-10 flex flex-col items-center gap-5 text-center">
          <div className="text-sm opacity-60">{ar ? "انتهى الوقت" : "Time's up"}</div>
          <div className="text-4xl font-black" style={{ color: C.lime }}>{headline}</div>
          {myLabel && <div className="text-sm" style={{ color: C.dim }}>{myLabel}</div>}
          <div className="grid grid-cols-2 gap-3 w-full mt-2">
            <Stat label={ar ? "طوب وضعته" : "Bricks you laid"} value={me?.crypto ?? 0} />
            <Stat label={ar ? "ارتفاع البرج" : "Tower height"} value={`${myTower ? towerHeight(myTower) : 0}${ar ? "م" : "m"}`} />
          </div>
          <MissedReview sessionId={sessionId} studentId={studentId} ar={ar} tone="dark" className="mx-auto mt-2" />
          <button onClick={() => navigate("/join")} className="mt-2 rounded-full px-8 py-3 font-bold" style={{ background: C.text, color: C.bg }}>
            {ar ? "خروج" : "Exit"}
          </button>
        </div>
      </div>
    );
  }

  // ── playing ────────────────────────────────────────────────────────────────
  const dunked = !!myTower?.dunked;
  const need = myTower ? climbNeed(myTower.width) : 2;
  const marginColor = margin > 3 ? C.lime : margin > 1.2 ? C.amber : C.coral;

  return (
    <div className="fixed inset-0 flex flex-col" style={{ ...font, background: C.bg, color: C.text }} dir={ar ? "rtl" : "ltr"}>
      {/* the strip */}
      <div className="relative shrink-0 h-[38vh] min-h-[220px] overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        <div className="absolute top-3 inset-x-3 flex items-start justify-between gap-2">
          {dunked ? (
            <div className="rounded-full px-3.5 py-1.5 text-sm font-black text-white" style={{ background: C.coral }}>
              {ar ? `تحت الحمم! جاوب لتخرج ${myTower!.climb}/${need}` : `In the lava! Answer to climb out ${myTower!.climb}/${need}`}
            </div>
          ) : (
            <div className="rounded-full px-3.5 py-1.5 text-sm font-bold bg-[#140A14]/80 backdrop-blur-sm">
              <span className="opacity-70">{ar ? "فوق الحمم" : "Above lava"} </span>
              <b style={{ color: marginColor }} dir="ltr">{Math.max(0, margin).toFixed(1)}{ar ? "م" : "m"}</b>
            </div>
          )}
          {myLabel && <div className="rounded-full px-3 py-1.5 text-xs font-bold bg-[#140A14]/80 backdrop-blur-sm">{myLabel}</div>}
        </div>
        {erupting && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-5xl font-black text-[#FFD04A] animate-in zoom-in-50 fade-in duration-300" style={{ textShadow: "0 4px 0 #B72A1E" }}>
              {ar ? "ثوران!" : "ERUPTION!"}
            </div>
          </div>
        )}
      </div>

      {/* the question */}
      <div className="flex-1 min-h-0 flex flex-col gap-3 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] overflow-y-auto" style={{ borderTop: `3px solid #FF8A1F` }}>
        {q && (
          <>
            <div className="rounded-2xl px-4 py-4" style={{ background: C.card, border: `2px solid ${C.line}` }}>
              {q.image_url && <img src={q.image_url} alt="" className="mx-auto max-h-[18vh] w-auto object-contain mb-3 rounded-lg" />}
              <p className="text-lg font-bold leading-snug text-center">{q.text}</p>
              {timerOn && phase === "question" && (
                <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: C.line }}>
                  <div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${(timeLeft / settings.timePerQ) * 100}%`, background: timeLeft <= 5 ? C.coral : C.amber }} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2.5 flex-1 min-h-[150px]">
              {q.options.map((opt, i) => {
                const show = picked !== null;
                const right = i === q.correct_index;
                const mine = picked === i;
                const bg = show && right ? C.lime : show && mine ? C.coral : C.card;
                const fg = show && right ? "#1A1A12" : show && mine ? "#fff" : C.text;
                return (
                  <button key={i} disabled={show} onClick={() => answer(i)}
                    className="rounded-2xl px-3 py-3 text-base font-bold leading-snug transition-colors active:scale-[0.98]"
                    style={{ background: bg, color: fg, border: `2px solid ${show && (right || mine) ? "transparent" : C.line}`, opacity: show && !right && !mine ? 0.45 : 1 }}>
                    {opt}
                  </button>
                );
              })}
            </div>
            {phase === "feedback" && picked !== null && (
              <div className="text-center text-sm font-bold" style={{ color: picked === q.correct_index ? C.lime : C.coral }}>
                {picked === q.correct_index
                  ? (dunked ? (ar ? "خطوة للخروج" : "One step out") : (ar ? "+1 طوبة" : "+1 brick"))
                  : (ar ? "خطأ، لا طوبة هذه المرة" : "Wrong, no brick this time")}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-2xl px-4 py-3" style={{ background: C.card, border: `2px solid ${C.line}` }}>
    <div className="text-xs" style={{ color: C.dim }}>{label}</div>
    <div className="text-2xl font-black mt-0.5" dir="ltr">{value}</div>
  </div>
);

export default LavaFloorGame;
