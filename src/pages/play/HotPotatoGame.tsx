import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { BombIcon } from "@/components/BombIcon";
import { Trophy, Zap, Check, X as XIcon } from "lucide-react";
import { playSelect, playCorrect, playWrong, playExplode, playGameOver, playHackAlert, primeAudio } from "@/lib/sound";
import { POINTS_PER_CORRECT, PASS_SECONDS, BOOM_KEEP, pickTargets, fuseBurn, type Bomb, type FeedEvent } from "@/lib/passIt";
import { Avatar } from "@/components/Avatar";
import MissedReview from "@/components/game/MissedReview";

type Q = { id: string; text: string; options: string[]; correct_index: number; image_url?: string };
type Phase = "waiting" | "question" | "answered" | "passing" | "exploded" | "done";


interface Props { sessionId: string; studentId: string; }

// Pass It palette: warm night, bomb orange, spark yellow. Answer buttons get
// four loud colors with a darker bottom edge so they read as pressable.
const PI = {
  ink: "#12141C", ink2: "#1C1F2B", line: "rgba(255,255,255,0.1)",
  text: "#F5F2EA", muted: "#969CB0",
  bomb: "#FF6A3D", spark: "#FFD34D", good: "#22C55E", bad: "#F43F5E",
};
const ANSWER_COLORS = [
  { bg: "#EF4F5A", edge: "#B0303A" },
  { bg: "#14A89A", edge: "#0B7469" },
  { bg: "#F29D1B", edge: "#B06C06" },
  { bg: "#7657F5", edge: "#4F35BF" },
];

const HotPotatoGame = ({ sessionId, studentId }: Props) => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const [session, setSession]       = useState<any>(null);
  const [questions, setQuestions]   = useState<Q[]>([]);
  const [students, setStudents]     = useState<any[]>([]);
  const [me, setMe]                 = useState<any>(null);
  const [phase, setPhase]           = useState<Phase>("waiting");
  const [currentQ, setCurrentQ]     = useState<Q | null>(null);
  const [picked, setPicked]         = useState<number | null>(null);
  const [timeLeft, setTimeLeft]     = useState(20);
  const [qSeed, setQSeed]           = useState(0);
  const [passTargets, setPassTargets] = useState<any[]>([]);
  const passTargetsRef = useRef<any[]>([]);
  passTargetsRef.current = passTargets;
  const passBombRef = useRef<(id: string) => void>(() => {});
  const [passSecsLeft, setPassSecsLeft] = useState(PASS_SECONDS);
  const [now, setNow] = useState(Date.now());
  const [showFlash, setShowFlash] = useState(false);
  // "Sara passed you the bomb!" — shown for a moment when a bomb lands on you.
  const [incoming, setIncoming] = useState<{ from: string | null } | null>(null);
  const [blasts, setBlasts] = useState(0);

  const qStartRef    = useRef(Date.now());
  const askedRef     = useRef(0);
  const pickedRef    = useRef<number | null>(null);
  const passedRef    = useRef(false);
  const studentsRef  = useRef<any[]>([]);
  studentsRef.current = students;
  const pointsRef = useRef(0);
  const myBombIdRef = useRef<string | null>(null);
  const passChRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const passTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStatusRef = useRef<string>("lobby");

  const settings        = session?.settings ?? {};
  const bombs: Bomb[]   = useMemo(() => Array.isArray(settings.bombs) ? settings.bombs : [], [settings.bombs]);
  const feed: FeedEvent[] = useMemo(() => Array.isArray(settings.hpFeed) ? settings.hpFeed : [], [settings.hpFeed]);
  const myBomb          = bombs.find(b => b.holderId === studentId) ?? null;
  const hasBomb         = !!myBomb;
  // The fuse is hidden on purpose: the drawing burns down, no seconds.
  const burn            = myBomb ? fuseBurn(myBomb.explodesAt, now) : 0;
  const fusePct         = (1 - burn) * 100;
  const otherHolders    = useMemo(() => bombs.filter(b => b.holderId !== studentId)
    .map(b => students.find(s => s.id === b.holderId)).filter(Boolean), [bombs, students, studentId]);
  const nameOf = (id: string | null) => students.find(s => s.id === id)?.name ?? null;

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    // Prime audio on first user gesture (required by iOS Safari)
    const onFirstTouch = () => { primeAudio(); window.removeEventListener("pointerdown", onFirstTouch); };
    window.addEventListener("pointerdown", onFirstTouch, { once: true });

    (async () => {
      const { data: s } = await supabase.from("game_sessions").select("*, quizzes(id,title)").eq("id", sessionId).maybeSingle();
      setSession(s);
      if (s?.quiz_id) {
        const { data: qs } = await supabase.from("questions").select("*").eq("quiz_id", s.quiz_id).order("position");
        setQuestions((qs ?? []).map((q: any) => ({ ...q, options: Array.isArray(q.options) ? q.options : [] })));
      }
      const { data: ss } = await supabase.from("game_students").select("*").eq("session_id", sessionId).order("crypto", { ascending: false });
      setStudents(ss ?? []);
      setMe((ss ?? []).find((x: any) => x.id === studentId) ?? null);
    })();

    return () => { window.removeEventListener("pointerdown", onFirstTouch); };
  }, [sessionId, studentId]);

  useEffect(() => { if (me) pointsRef.current = me.crypto ?? 0; }, [me?.crypto]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pass requests go to the projector, which moves the bomb (passIt.ts).
  useEffect(() => {
    const ch = supabase.channel(`passit-${sessionId}`).subscribe();
    passChRef.current = ch;
    return () => { supabase.removeChannel(ch); passChRef.current = null; };
  }, [sessionId]);

  // A bomb just landed on me.
  useEffect(() => {
    const id = myBomb?.id ?? null;
    if (id && id !== myBombIdRef.current && session?.status === "running") {
      setIncoming({ from: myBomb!.fromId });
      playHackAlert();
      navigator.vibrate?.([200, 80, 200]);
      const t = setTimeout(() => setIncoming(null), 1800);
      myBombIdRef.current = id;
      return () => clearTimeout(t);
    }
    myBombIdRef.current = id;
  }, [myBomb?.id, myBomb?.holderId]); // eslint-disable-line react-hooks/exhaustive-deps

  // A bomb went off in my hands: I halve my own points (each phone writes only
  // its own row). Handled blast ids are remembered so a reload can't double it.
  useEffect(() => {
    const key = `passit_blasts_${sessionId}`;
    let done: string[] = [];
    try { done = JSON.parse(localStorage.getItem(key) ?? "[]"); } catch { /* fresh */ }
    setBlasts(done.length);
    const mine = feed.filter(e => e.kind === "boom" && e.to === studentId && !done.includes(e.id));
    if (!mine.length) return;
    done = [...done, ...mine.map(e => e.id)];
    try { localStorage.setItem(key, JSON.stringify(done)); } catch { /* private mode */ }
    setBlasts(done.length);
    (async () => {
      const { data: row } = await supabase.from("game_students").select("crypto").eq("id", studentId).maybeSingle();
      let pts = row?.crypto ?? pointsRef.current;
      for (let i = 0; i < mine.length; i++) pts = Math.floor(pts * BOOM_KEEP);
      pointsRef.current = pts;
      await supabase.from("game_students").update({ crypto: pts }).eq("id", studentId);
    })();
    setPhase("exploded");
  }, [feed]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Now ticker (for fuse bar) ────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel(`hp-game-${sessionId}`)
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

  // ── Session status sync ───────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    sessionStatusRef.current = session.status;
    if (session.status === "lobby")      setPhase("waiting");
    else if (session.status === "finished") setPhase("done");
    else if (session.status === "running")
      setPhase(prev => prev === "waiting" ? "question" : prev);
    else if (session.status === "cancelled") {
      const arLang = (session.settings?.lang ?? i18n.language) === "ar";
      toast.error(arLang ? "أغلق المعلّم الردهة" : "The teacher closed the lobby");
      navigate("/join");
    }
  }, [session?.status]);

  // Play game-over fanfare once when teacher ends the session
  useEffect(() => {
    if (phase === "done") playGameOver();
  }, [phase]);

  // ── Auto-advance after exploded + trigger flash ───────────────────────────
  useEffect(() => {
    if (phase !== "exploded") return;
    playExplode();
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 800);
    const t = setTimeout(() => {
      if (sessionStatusRef.current === "finished") return;
      setQSeed(s => s + 1); setPhase("question");
    }, 2200);
    return () => clearTimeout(t);
  }, [phase]);

  // ── Pick question ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "question" || questions.length === 0) return;
    const next = questions[Math.floor(Math.random() * questions.length)];
    setCurrentQ(next);
    setPicked(null);
    pickedRef.current = null;
    askedRef.current += 1;
    qStartRef.current = Date.now();
  }, [phase, qSeed, questions.length]);

  // ── Question countdown ────────────────────────────────────────────────────
  // Opt-in per session (HostGame): absent/null timePerQ means no countdown runs
  // and a question never expires on its own. The bomb fuse is a separate clock
  // and keeps running either way — that's the mode's own pressure, not this one.
  const timerEnabled = typeof settings.timePerQ === "number" && settings.timePerQ > 0;
  const duration = settings.timePerQ ?? 20;
  useEffect(() => {
    if (!timerEnabled || phase !== "question" || !currentQ) return;
    const t = setInterval(() => {
      const elapsed = (Date.now() - qStartRef.current) / 1000;
      const left = Math.max(0, Math.ceil(duration - elapsed));
      setTimeLeft(left);
      if (left <= 0 && pickedRef.current === null) { clearInterval(t); if (sessionStatusRef.current !== "finished") handleAnswer(-1); }
    }, 200);
    return () => clearInterval(t);
  }, [timerEnabled, phase, currentQ, duration]);

  // ── Auto-advance after answered ───────────────────────────────────────────
  useEffect(() => {
    if (phase !== "answered") return;
    const t = setTimeout(() => {
      if (sessionStatusRef.current === "finished") return;
      setQSeed(s => s + 1); setPhase("question");
    }, 1500);
    return () => clearTimeout(t);
  }, [phase]);

  // ── Pass countdown ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "passing") return;
    setPassSecsLeft(PASS_SECONDS);
    passedRef.current = false;
    if (passTimerRef.current) clearInterval(passTimerRef.current);
    passTimerRef.current = setInterval(() => {
      setPassSecsLeft(prev => {
        if (prev <= 1) {
          clearInterval(passTimerRef.current!);
          // Out of time: it goes to one of the choices at random, so the
          // bomb never gets stuck with someone who answered right.
          if (!passedRef.current) {
            const pick = passTargetsRef.current[Math.floor(Math.random() * passTargetsRef.current.length)];
            if (pick) passBombRef.current(pick.id);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (passTimerRef.current) clearInterval(passTimerRef.current); };
  }, [phase]);

  // While choosing, a choice can pick up another bomb from someone else. Swap
  // them for a free player right away so nobody can be handed a second bomb
  // (the projector checks again when it applies the pass).
  useEffect(() => {
    if (phase !== "passing") return;
    const held = new Set(bombs.map(b => b.holderId));
    if (!passTargets.some(t => held.has(t.id))) return;
    const keep = passTargets.filter(t => !held.has(t.id));
    const fresh = pickTargets(studentsRef.current.map((x: any) => x.id), bombs, studentId, Math.random, 99)
      .filter(id => !keep.some(t => t.id === id))
      .map(id => studentsRef.current.find((x: any) => x.id === id))
      .filter(Boolean)
      .slice(0, passTargets.length - keep.length);
    setPassTargets([...keep, ...fresh]);
  }, [bombs, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Answer handler ────────────────────────────────────────────────────────
  const handleAnswer = useCallback((idx: number) => {
    if (!currentQ || !me) return;
    if (pickedRef.current !== null) return;
    pickedRef.current = idx;

    const correct = idx === currentQ.correct_index;
    playSelect();
    if (correct) playCorrect(); else playWrong();
    setPicked(idx);

    if (correct) {
      // Award points fire-and-forget
      pointsRef.current += POINTS_PER_CORRECT;
      supabase.from("game_students").update({
        crypto: pointsRef.current,
        correct_answers: (me.correct_answers ?? 0) + 1,
        total_answers: (me.total_answers ?? 0) + 1,
      }).eq("id", me.id).then(undefined, () => {});

      if (hasBomb) {
        // Choices: players who don't already hold a bomb.
        const ids = pickTargets(studentsRef.current.map((s: any) => s.id), bombs, studentId, Math.random);
        const targets = ids.map(id => studentsRef.current.find((s: any) => s.id === id)).filter(Boolean);
        if (targets.length) {
          setPassTargets(targets);
          setTimeout(() => { if (sessionStatusRef.current !== "finished") setPhase("passing"); }, 600);
        } else {
          setTimeout(() => { if (sessionStatusRef.current !== "finished") setPhase("answered"); }, 700);
        }
      } else {
        setTimeout(() => { if (sessionStatusRef.current !== "finished") setPhase("answered"); }, 700);
      }
    } else {
      supabase.from("game_students").update({
        total_answers: (me.total_answers ?? 0) + 1,
      }).eq("id", me.id).then(undefined, () => {});
      setTimeout(() => { if (sessionStatusRef.current !== "finished") setPhase("answered"); }, 700);
    }

    supabase.from("question_responses").insert({
      session_id: sessionId, student_id: me.id, question_id: currentQ.id,
      question_index: askedRef.current, answer_index: idx, is_correct: correct,
    }).then(undefined, () => {});
  }, [currentQ, me, hasBomb, bombs, studentId, sessionId]);

  const submit = (idx: number) => { if (pickedRef.current !== null) return; handleAnswer(idx); };

  const passBomb = (targetId: string) => {
    if (passedRef.current || !myBomb) return;
    if (bombs.some(b => b.holderId === targetId)) return; // they got one meanwhile
    passedRef.current = true;
    if (passTimerRef.current) clearInterval(passTimerRef.current);
    passChRef.current?.send({ type: "broadcast", event: "pass", payload: { bombId: myBomb.id, from: studentId, to: targetId } });
    setTimeout(() => { if (sessionStatusRef.current !== "finished") { setQSeed(s => s + 1); setPhase("question"); } }, 300);
  };
  passBombRef.current = passBomb;

  const fmt = (n: number) => n.toLocaleString();
  const points = me?.crypto ?? 0;
  const ar = (session?.settings?.lang ?? i18n.language) === "ar";


  const timerLeftPct = timerEnabled ? timeLeft / duration : 1;
  const sorted = [...students].sort((a, b) => (b.crypto ?? 0) - (a.crypto ?? 0));
  const rank = sorted.findIndex(s => s.id === studentId) + 1 || sorted.length;

  return (
    <div className="fixed inset-0 overflow-hidden select-none"
      style={{ background: PI.ink, color: PI.text, fontFamily: "'Almarai', system-ui, sans-serif" }}>
      {/* Danger glow: grows with the fuse while a bomb is in your hands */}
      <div className="pointer-events-none absolute inset-0 transition-opacity duration-700"
        style={{
          opacity: hasBomb && phase !== "done" ? 0.35 + burn * 0.65 : 0,
          background: "radial-gradient(130% 75% at 50% 0%, rgba(255,106,61,0.5), transparent 62%)",
        }} />
      {hasBomb && burn > 0.7 && phase !== "done" && (
        <div className="pointer-events-none absolute inset-0 animate-pulse" style={{ boxShadow: "inset 0 0 90px rgba(255,70,30,0.6)" }} />
      )}

      {/* Explosion flash */}
      {showFlash && (
        <>
          <div className="pointer-events-none absolute inset-0 z-50 animate-screen-flash"
            style={{ background: "radial-gradient(circle at center, #FFF3C4 0%, #FF8A3D 45%, transparent 80%)" }} />
          <div className="pointer-events-none absolute z-[51] rounded-full animate-shockwave"
            style={{ top: "50%", left: "50%", width: 80, height: 80, transform: "translate(-50%,-50%)", border: `4px solid ${PI.spark}` }} />
        </>
      )}

      {/* A bomb just landed on you */}
      {incoming && phase !== "done" && (
        <div className="pointer-events-none absolute inset-0 z-[60] flex flex-col items-center justify-center gap-4 text-center px-8 animate-hp-explode"
          style={{ background: "radial-gradient(circle at 50% 42%, #7A2A12 0%, rgba(18,20,28,0.97) 70%)" }}>
          <BombIcon className="h-28 w-28 animate-fuse-critical" sparks />
          <div className="text-3xl font-extrabold leading-tight" style={{ color: PI.spark }}>
            {nameOf(incoming.from)
              ? (ar ? `${nameOf(incoming.from)} مرّر لك القنبلة!` : `${nameOf(incoming.from)} passed you the bomb!`)
              : (ar ? "معك قنبلة!" : "You got a bomb!")}
          </div>
          <div className="text-base font-bold" style={{ color: PI.text }}>
            {ar ? "أجب صح بسرعة لتتخلص منها" : "Answer right, fast, to get rid of it"}
          </div>
        </div>
      )}

      <div className={cn("relative z-10 flex flex-col h-full", hasBomb && burn > 0.85 && phase === "question" && "animate-screen-shake")}>

        {/* ── Header ── */}
        <header className="shrink-0 flex items-center justify-between gap-3 px-4 pt-3 pb-2 safe-top">
          <div className="flex items-center gap-2.5 min-w-0">
            {me && <Avatar name={me.name} colorIndex={me.avatar_color} faceIndex={me.avatar_face} size={34} />}
            <span className="text-[15px] font-extrabold truncate">{me?.name ?? ""}</span>
          </div>
          <div className="shrink-0 flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[15px] font-extrabold tabular-nums"
            style={{ background: "rgba(255,255,255,0.08)" }}>
            <Zap className="h-4 w-4" style={{ color: PI.spark }} fill={PI.spark} />
            {fmt(points)}
          </div>
        </header>

        <main className="flex-1 min-h-0 px-4 pb-4 safe-bottom flex flex-col overflow-y-auto">

          {/* ── WAITING ── */}
          {phase === "waiting" && (
            <div className="flex-1 flex flex-col items-center pt-8 gap-6 text-center">
              <BombIcon className="h-24 w-24" sparks />
              <div>
                <h1 className="text-4xl font-extrabold">{ar ? "مرّرها" : "Pass It"}</h1>
                {session?.quizzes?.title && <p className="mt-1.5 text-sm font-bold truncate max-w-[280px]" style={{ color: PI.muted }}>{session.quizzes.title}</p>}
              </div>
              <p className="text-sm leading-relaxed max-w-[300px]" style={{ color: PI.muted }}>
                {ar ? "أجب صح لتمرّر القنبلة لغيرك. إذا انفجرت وهي معك تخسر نصف نقاطك." : "Answer right to pass the bomb on. If it blows up in your hands, you lose half your points."}
              </p>
              <div className="flex flex-wrap justify-center gap-3 max-w-sm">
                {students.map((s, i) => (
                  <div key={s.id} className="flex flex-col items-center gap-1 w-14"
                    style={{ animation: `fade-up 0.4s cubic-bezier(0.16,1,0.3,1) ${Math.min(i * 50, 600)}ms both` }}>
                    <Avatar name={s.name} colorIndex={s.avatar_color} faceIndex={s.avatar_face} size={44} />
                    <span className="text-[11px] font-bold truncate w-full" style={{ color: s.id === studentId ? PI.text : PI.muted }}>{s.name}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm font-bold animate-pulse" style={{ color: PI.muted }}>{ar ? "بانتظار المعلّم..." : "Waiting for the teacher..."}</p>
            </div>
          )}

          {/* ── QUESTION ── */}
          {(phase === "question" || phase === "answered") && currentQ && (
            <div key={qSeed} className="flex-1 min-h-0 flex flex-col max-w-2xl mx-auto w-full animate-question-in">

              {/* Bomb bar: same height always, so nothing below it moves. */}
              <div className="h-12 shrink-0 flex items-center gap-2.5 px-3 rounded-2xl transition-colors duration-300"
                style={hasBomb
                  ? { background: "linear-gradient(90deg, #FF6A3D, #E23E2A)", color: "#fff" }
                  : { background: PI.ink2, color: PI.muted }}>
                <BombIcon className="h-7 w-7 shrink-0" burn={hasBomb ? fusePct / 100 : 1} sparks={hasBomb} />
                {hasBomb ? (
                  <span className="flex-1 min-w-0 truncate text-[15px] font-extrabold">
                    {ar ? "معك قنبلة! أجب صح لتمرّرها" : "You have a bomb! Answer right to pass it"}
                  </span>
                ) : (
                  <>
                    <span className="shrink-0 text-[13px] font-bold">{ar ? "القنابل مع" : "Bombs with"}</span>
                    <div className="flex -space-x-2 rtl:space-x-reverse shrink-0">
                      {otherHolders.slice(0, 5).map((h: any) => (
                        <Avatar key={h.id} name={h.name} colorIndex={h.avatar_color} faceIndex={h.avatar_face} size={26} className="ring-2 ring-[#1A1D29]" />
                      ))}
                    </div>
                    <span className="flex-1 min-w-0 truncate text-[13px] font-bold" style={{ color: PI.text }}>
                      {otherHolders.map((h: any) => h.name).join(ar ? "، " : ", ")}
                    </span>
                  </>
                )}
              </div>

              {/* Question */}
              <div className="shrink-0 py-5 text-center">
                {timerEnabled && (
                  <div className="mx-auto mb-3 h-1.5 w-40 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                    <div className="h-full rounded-full transition-[width] duration-200 ease-linear"
                      style={{ width: `${timerLeftPct * 100}%`, background: timerLeftPct < 0.3 ? PI.bad : PI.spark }} />
                  </div>
                )}
                {currentQ.image_url && (
                  <img src={currentQ.image_url} alt="" className="mx-auto mb-3 max-h-[24vh] w-auto object-contain rounded-xl" />
                )}
                <p className="text-xl md:text-2xl font-extrabold leading-relaxed">{currentQ.text}</p>
              </div>

              {/* Answers */}
              <div className="grid grid-cols-2 gap-3 flex-1 min-h-0 auto-rows-fr">
                {currentQ.options.map((opt, i) => {
                  const isCorrect = i === currentQ.correct_index;
                  const isPicked  = picked === i;
                  const show      = picked !== null;
                  const c = show && isCorrect ? { bg: PI.good, edge: "#15925F" }
                    : show && isPicked ? { bg: PI.bad, edge: "#B4213A" }
                    : ANSWER_COLORS[i % ANSWER_COLORS.length];
                  return (
                    <button key={i} disabled={picked !== null} onClick={() => submit(i)}
                      className={cn(
                        "relative min-h-[84px] px-3 py-3 rounded-2xl text-center text-[17px] font-extrabold leading-snug break-words text-white",
                        "transition-all duration-150 active:translate-y-1 active:border-b-[2px] disabled:active:translate-y-0",
                        show && isCorrect && "animate-answer-correct",
                        show && isPicked && !isCorrect && "animate-answer-wrong",
                        show && !isPicked && !isCorrect && "opacity-25",
                      )}
                      style={{ background: c.bg, borderBottom: `6px solid ${c.edge}` }}>
                      {show && isCorrect && <Check className="absolute top-2 end-2 h-5 w-5" strokeWidth={3.5} />}
                      {show && isPicked && !isCorrect && <XIcon className="absolute top-2 end-2 h-5 w-5" strokeWidth={3.5} />}
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── PASSING ── */}
          {phase === "passing" && (
            <div className="flex-1 flex flex-col items-center pt-6 gap-5 max-w-md mx-auto w-full text-center">
              <div className="relative h-32 w-32">
                <svg className="absolute inset-0" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="7" />
                  <circle cx="60" cy="60" r="54" fill="none" stroke={PI.spark} strokeWidth="7" strokeLinecap="round"
                    strokeDasharray="339.3" strokeDashoffset={339.3 * (1 - passSecsLeft / PASS_SECONDS)}
                    transform="rotate(-90 60 60)" style={{ transition: "stroke-dashoffset 0.9s linear" }} />
                </svg>
                <BombIcon className="absolute inset-5 animate-fuse-critical" sparks />
              </div>
              <div>
                <h2 className="text-4xl font-extrabold" style={{ color: PI.spark }}>{ar ? "مرّرها!" : "Pass it!"}</h2>
                <p className="mt-1.5 text-base font-bold" style={{ color: PI.muted }}>{ar ? "من يأخذ القنبلة؟" : "Who gets the bomb?"}</p>
              </div>
              <div className="w-full flex flex-col gap-3">
                {passTargets.map(target => (
                  <button key={target.id} onClick={() => passBomb(target.id)}
                    className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-start transition-transform active:scale-[0.97]"
                    style={{ background: PI.ink2, borderBottom: "5px solid #0C0E14" }}>
                    <Avatar name={target.name} colorIndex={target.avatar_color} faceIndex={target.avatar_face} size={48} />
                    <div className="flex-1 min-w-0">
                      <div className="text-lg font-extrabold truncate">{target.name}</div>
                      <div className="text-xs font-bold tabular-nums" style={{ color: PI.muted }}>{fmt(target.crypto ?? 0)} {ar ? "نقطة" : "pts"}</div>
                    </div>
                    <BombIcon className="h-8 w-8 shrink-0" />
                  </button>
                ))}
              </div>
              <p className="text-xs font-bold" style={{ color: PI.muted }}>
                {ar ? `${passSecsLeft} ث — إذا لم تختر، تذهب لأحدهم عشوائيًا` : `${passSecsLeft}s — if you don't choose, it goes to one of them at random`}
              </p>
            </div>
          )}

          {/* ── EXPLODED ── */}
          {phase === "exploded" && (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 animate-hp-explode">
              <BombIcon className="h-32 w-32" burn={0} sparks />
              <h2 className="text-6xl font-extrabold" style={{ color: PI.bomb }}>{ar ? "بووم!" : "BOOM!"}</h2>
              <p className="text-lg font-bold">{ar ? "انفجرت القنبلة معك، خسرت نصف نقاطك" : "It blew up on you. You lost half your points"}</p>
              <p className="text-sm font-bold" style={{ color: PI.muted }}>{ar ? "تعود للعبة الآن..." : "Back in the game..."}</p>
            </div>
          )}

          {/* ── DONE ── */}
          {phase === "done" && (
            <div className="max-w-md mx-auto w-full pt-6 flex flex-col items-center gap-6 text-center">
              <div className="flex flex-col items-center gap-2">
                {rank === 1 ? <Trophy className="h-16 w-16" style={{ color: PI.spark }} /> : me && <Avatar name={me.name} colorIndex={me.avatar_color} faceIndex={me.avatar_face} size={72} />}
                <div className="text-5xl font-extrabold tabular-nums" style={{ color: rank === 1 ? PI.spark : PI.text }}>#{rank}</div>
                <div className="text-base font-bold" style={{ color: PI.muted }}>
                  {rank === 1 ? (ar ? "الأول! لا أحد مرّرها أفضل منك" : "First place! Nobody passed it better") : ar ? `من ${sorted.length} لاعبين` : `out of ${sorted.length} players`}
                </div>
              </div>

              <div className="w-full grid grid-cols-3">
                {[
                  { label: ar ? "النقاط" : "Points", value: fmt(points), color: PI.spark },
                  { label: ar ? "إجابات صحيحة" : "Right answers", value: me?.correct_answers ?? 0, color: PI.good },
                  { label: ar ? "انفجارات" : "Blasts", value: blasts, color: PI.bomb },
                ].map((s, i) => (
                  <div key={s.label} className="py-1" style={{ borderInlineStart: i ? `1px solid ${PI.line}` : "none" }}>
                    <div className="text-2xl font-extrabold tabular-nums" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-xs font-bold mt-0.5" style={{ color: PI.muted }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="w-full flex flex-col gap-1.5 text-start">
                {sorted.slice(0, 5).map((s, i) => {
                  const isMe = s.id === studentId;
                  return (
                    <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                      style={{ background: isMe ? "rgba(255,211,77,0.12)" : "transparent" }}>
                      <span className="w-6 text-center text-base font-extrabold tabular-nums" style={{ color: i === 0 ? PI.spark : PI.muted }}>{i + 1}</span>
                      <Avatar name={s.name} colorIndex={s.avatar_color} faceIndex={s.avatar_face} size={32} />
                      <span className="flex-1 min-w-0 truncate font-extrabold">{s.name}</span>
                      <span className="font-extrabold tabular-nums" style={{ color: PI.muted }}>{fmt(s.crypto ?? 0)}</span>
                    </div>
                  );
                })}
              </div>

              <MissedReview sessionId={sessionId} studentId={studentId} ar={ar} tone="dark" />
              <button onClick={() => navigate("/join")}
                className="w-full h-13 py-3.5 rounded-2xl text-lg font-extrabold active:translate-y-0.5 transition-transform"
                style={{ background: PI.text, color: PI.ink, borderBottom: "5px solid #B9B4A8" }}>
                {ar ? "خروج" : "Exit"}
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default HotPotatoGame;
