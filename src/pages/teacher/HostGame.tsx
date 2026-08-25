import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Copy, Play, Users, Trash2, Zap, Heart, Skull, Timer, Trophy, Flame, ChevronLeft, Check, Minus, Plus, ListChecks, Biohazard, ChevronUp, QrCode } from "lucide-react";
import { BitcoinIcon, StopwatchIcon, LavaBucketIcon, DynamiteIcon, PaintRollerIcon } from "@/components/game/icons";
import { computeArenaSize } from "@/lib/paintFight";
import { toast } from "@/components/ui/sonner";

const genCode = () => {
  const c = "0123456789";
  return Array.from({ length: 4 }, () => c[Math.floor(Math.random() * c.length)]).join("");
};

type GameMode = "crypto_rush" | "dodgeball" | "hotpotato" | "lavafloor" | "classic" | "humansvszombies" | "dontlookdown" | "paintfight" | "physical";

const MODES: { id: GameMode; icon: React.ReactNode; label: string; labelAr: string; desc: string; descAr: string; accent: string; num: string }[] = [
  {
    id: "classic",
    icon: <ListChecks className="h-6 w-6" strokeWidth={2} />,
    label: "Classic",
    labelAr: "كلاسيكي",
    desc: "Answer fast, earn more — the original quiz race",
    descAr: "أجب بسرعة، اكسب أكثر — سباق الأسئلة الأصلي",
    accent: "#8FC44A",
    num: "00",
  },
  {
    id: "crypto_rush",
    icon: <BitcoinIcon className="h-6 w-6" strokeWidth={2} />,
    label: "Crypto Rush",
    labelAr: "كريبتو رَش",
    desc: "Answer questions, earn crypto, hack rivals",
    descAr: "أجب على الأسئلة، اكسب كريبتو، اخترق منافسيك",
    accent: "#3a9e6e",
    num: "01",
  },
  {
    id: "dodgeball",
    icon: <StopwatchIcon className="h-6 w-6" strokeWidth={2} />,
    label: "Speed Challenge",
    labelAr: "تحدي السرعة",
    desc: "Answer fast or get eliminated — last student standing wins",
    descAr: "أجب بسرعة وإلا ستُستبعد — آخر طالب يبقى يفوز",
    accent: "#3F5A63",
    num: "02",
  },
  {
    id: "hotpotato",
    icon: <DynamiteIcon className="h-6 w-6" strokeWidth={2} />,
    label: "Pass It",
    labelAr: "مرّرها",
    desc: "Live bomb on a fuse — pass it before it blows",
    descAr: "قنبلة موقوتة — مرّرها قبل أن تنفجر",
    accent: "#C8783A",
    num: "03",
  },
  {
    id: "lavafloor",
    icon: <LavaBucketIcon className="h-6 w-6" strokeWidth={2} />,
    label: "Lava Floor",
    labelAr: "أرضية الحمم",
    desc: "Survive together before the lava rises",
    descAr: "اصمدوا معاً قبل أن تبتلعكم الحمم",
    accent: "#8B4A3A",
    num: "04",
  },
  {
    id: "humansvszombies",
    icon: <Biohazard className="h-6 w-6" strokeWidth={2} />,
    label: "Humans vs Zombies",
    labelAr: "البشر ضد الزومبي",
    desc: "Two teams, two health bars — heal, upgrade, sabotage, survive",
    descAr: "فريقان، شريطا صحة — عالج، طوّر، خرّب، انجُ",
    accent: "#4a7a3a",
    num: "05",
  },
  {
    id: "dontlookdown",
    icon: <ChevronUp className="h-6 w-6" strokeWidth={2} />,
    label: "Don't Look Down",
    labelAr: "لا تنظر للأسفل",
    desc: "Climb a tower — answers are the fuel for every jump",
    descAr: "تسلّق البرج — الإجابات هي وقود كل قفزة",
    accent: "#2f6f8f",
    num: "06",
  },
  {
    id: "paintfight",
    icon: <PaintRollerIcon className="h-6 w-6" strokeWidth={2} />,
    label: "Paint Fight",
    labelAr: "معركة الطلاء",
    desc: "Free-for-all territory battle — answers refill your paint",
    descAr: "معركة حرة على الأرض — الإجابات تعيد ملء طلائك",
    accent: "#c2410c",
    num: "07",
  },
  {
    id: "physical",
    icon: <QrCode className="h-6 w-6" strokeWidth={2} />,
    label: "Physical Games",
    labelAr: "الألعاب الفيزيائية",
    desc: "Play on a printed board — scan squares for questions, no student devices needed",
    descAr: "العب على لوحة مطبوعة — امسح المربعات للحصول على أسئلة، بدون أجهزة للطلاب",
    accent: "#5b4636",
    num: "08",
  },
];

const MINUTE_PRESETS = [5, 10, 15, 20, 30];

/* Per-question countdown — off by default. Teachers who want the pressure opt in
   and pick the seconds; everyone else gets questions that simply wait for an
   answer, which is what most classrooms actually want. */
const SECOND_PRESETS = [10, 15, 20, 30, 45, 60];

const QuestionTimerControl = ({ ar, value, onChange }: { ar: boolean; value: number | null; onChange: (v: number | null) => void }) => {
  const on = value !== null;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-xs font-semibold tracking-widest uppercase text-black/40">
          {ar ? "مؤقت لكل سؤال" : "Timer Per Question"}
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={() => onChange(on ? null : 20)}
          className="relative h-7 w-12 shrink-0 rounded-full border-2 border-[hsl(var(--nb-border))] transition-colors"
          style={{ background: on ? "#3F5A63" : "white" }}
        >
          <span
            className="absolute top-[2px] h-4 w-4 rounded-full transition-all"
            style={{ background: on ? "white" : "#3F5A63", left: on ? "22px" : "4px" }}
          />
        </button>
      </div>

      {on ? (
        <div className="flex gap-2 flex-wrap">
          {SECOND_PRESETS.map(s => (
            <button
              key={s}
              onClick={() => onChange(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border-2 border-[hsl(var(--nb-border))] transition-all hover:translate-x-px hover:translate-y-px"
              style={value === s
                ? { background: "#3F5A63", color: "white", boxShadow: "2px 2px 0 0 hsl(var(--nb-border))" }
                : { background: "white", color: "#3F5A63", boxShadow: "2px 2px 0 0 hsl(var(--nb-border))" }
              }
            >
              {s}s
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-black/45 leading-relaxed">
          {ar
            ? "لا مؤقت — يبقى السؤال معروضًا حتى يجيب الطلاب."
            : "No timer — each question stays up until students answer."}
        </p>
      )}
    </div>
  );
};

const MinuteStepper = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => {
  const step = (delta: number) => onChange(Math.min(30, Math.max(2, value + delta)));
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          onClick={() => step(-1)}
          disabled={value <= 2}
          className="h-11 w-11 rounded-xl flex items-center justify-center border-2 border-[hsl(var(--nb-border))] bg-white text-[#3F5A63] shadow-[3px_3px_0_0_hsl(var(--nb-border))] hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_0_hsl(var(--nb-border))] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Minus className="h-4 w-4" />
        </button>

        <div className="flex-1 rounded-xl flex flex-col items-center justify-center py-3 border-2 border-[hsl(var(--nb-border))] bg-white shadow-[3px_3px_0_0_hsl(var(--nb-border))]">
          <span className="font-black text-4xl leading-none text-[#3F5A63]">{value}</span>
          <span className="text-xs mt-1 font-medium text-black/40">min</span>
        </div>

        <button
          onClick={() => step(1)}
          disabled={value >= 30}
          className="h-11 w-11 rounded-xl flex items-center justify-center border-2 border-[hsl(var(--nb-border))] bg-white text-[#3F5A63] shadow-[3px_3px_0_0_hsl(var(--nb-border))] hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_0_hsl(var(--nb-border))] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {MINUTE_PRESETS.map(p => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border-2 border-[hsl(var(--nb-border))] transition-all hover:translate-x-px hover:translate-y-px"
            style={value === p
              ? { background: "#3F5A63", color: "white", boxShadow: "2px 2px 0 0 hsl(var(--nb-border))" }
              : { background: "white", color: "#3F5A63", boxShadow: "2px 2px 0 0 hsl(var(--nb-border))" }
            }
          >
            {p}m
          </button>
        ))}
      </div>
    </div>
  );
};

const HostGame = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const { user } = useAuth();

  const [quiz, setQuiz] = useState<any>(null);
  const [mode, setMode] = useState<GameMode | null>(null);
  const [code, setCode] = useState(genCode());
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [minutes, setMinutes] = useState(7);
  // null = no per-question countdown at all (the default). A number means the
  // teacher explicitly opted in to that many seconds per question. Every mode
  // reads settings.timePerQ with this same contract: absent/null => no timer.
  const [secsPerQ, setSecsPerQ] = useState<number | null>(null);
  const maxStudents = 40;

  useEffect(() => {
    if (!quizId) return;
    supabase.from("quizzes").select("*").eq("id", quizId).maybeSingle().then(({ data }) => setQuiz(data));
  }, [quizId]);

  // Resume an already-open lobby (or running game) after a page refresh —
  // otherwise the teacher's session state resets while the DB session lives on.
  useEffect(() => {
    if (!user || !quizId) return;
    (async () => {
      const { data } = await supabase.from("game_sessions")
        .select("*")
        .eq("teacher_id", user.id)
        .eq("quiz_id", quizId)
        .in("status", ["lobby", "running"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return;
      if (data.status === "running") {
        navigate(`/app/games/${data.id}/monitor`);
        return;
      }
      setMode((data.settings?.mode as GameMode) ?? null);
      setCode(data.code);
      setSessionId(data.id);
      if (data.settings?.minutes) setMinutes(data.settings.minutes);
      setSecsPerQ(typeof data.settings?.timePerQ === "number" ? data.settings.timePerQ : null);
    })();
  }, [user, quizId]);

  useEffect(() => {
    if (!sessionId) return;
    const load = async () => {
      const { data } = await supabase.from("game_students").select("*").eq("session_id", sessionId).order("joined_at");
      setStudents(data ?? []);
    };
    load();
    const ch = supabase.channel(`lobby-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_students", filter: `session_id=eq.${sessionId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId]);

  const openLobby = async () => {
    if (!user || !quizId || !mode) return;
    try {
      const settings: any = { mode, maxStudents };
      if (mode === "dodgeball") {
        settings.timerActive = false;
        settings.timerRoundId = null;
        settings.timerStartedAt = null;
        settings.timerWinnerId = null;
      } else {
        settings.minutes = minutes;
      }
      // Off unless the teacher turned it on — null, not a default number, so the
      // game views can tell "disabled" apart from "set to some duration".
      settings.timePerQ = secsPerQ;
      settings.lang = i18n.language;
      let tryCode = code;
      let data, error;
      for (let attempt = 0; attempt < 5; attempt++) {
        ({ data, error } = await supabase.from("game_sessions")
          .insert({ teacher_id: user.id, quiz_id: quizId, code: tryCode, status: "lobby", settings }).select().single());
        if (!error || error.code !== "23505") break; // 23505 = unique_violation — retry with a fresh code
        tryCode = genCode();
      }
      if (error) throw error;
      setCode(tryCode);
      setSessionId(data.id); // the roster/cancel/start panel appearing is the confirmation
    } catch (e: any) { toast.error(e.message); }
  };

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startGame = async () => {
    if (!sessionId) return;
    const patch: any = {
      status: "running",
      started_at: new Date().toISOString(),
      current_question_started_at: new Date().toISOString(),
    };
    if (mode === "paintfight") {
      // Arena size is fixed for the whole match at the moment of Start, computed
      // from the confirmed roster — so it doesn't sprawl for 5 players or feel
      // cramped for 20, and every client renders an identically-sized grid.
      const { data: cur } = await supabase.from("game_sessions").select("settings").eq("id", sessionId).maybeSingle();
      const { cols, rows } = computeArenaSize(students.length);
      patch.settings = { ...(cur?.settings ?? {}), arenaCols: cols, arenaRows: rows };
    }
    await supabase.from("game_sessions").update(patch).eq("id", sessionId);
    navigate(`/app/games/${sessionId}/monitor`);
  };

  const startPhysical = async () => {
    if (!user || !quizId) return;
    try {
      const settings: any = { mode: "physical", lang: i18n.language };
      let tryCode = code;
      let data, error;
      for (let attempt = 0; attempt < 5; attempt++) {
        ({ data, error } = await supabase.from("game_sessions")
          .insert({ teacher_id: user.id, quiz_id: quizId, code: tryCode, status: "running", started_at: new Date().toISOString(), settings })
          .select().single());
        if (!error || error.code !== "23505") break;
        tryCode = genCode();
      }
      if (error) throw error;
      navigate(`/app/games/${data.id}/monitor`);
    } catch (e: any) { toast.error(e.message); }
  };

  const cancelLobby = async () => {
    if (!sessionId) return;
    await supabase.from("game_sessions").update({ status: "cancelled" }).eq("id", sessionId);
    setSessionId(null);
    setStudents([]);
    setCode(genCode()); // the old code is now taken forever by the cancelled row — never reuse it
    // panel collapsing back to "Open lobby" is the confirmation
  };

  const removeStudent = async (id: string) => {
    await supabase.from("game_students").delete().eq("id", id);
  };

  const selectedMode = mode ? MODES.find(m => m.id === mode)! : null;

  // ── Mode picker ───────────────────────────────────────────────────────────
  if (!mode) {
    return (
      <div className="min-h-full p-6 md:p-10" style={{ background: "hsl(var(--background))" }}>
        <div className="max-w-2xl mx-auto space-y-8">
          <div>
            {quiz && (
              <p className="text-[12px] font-semibold text-[#8FC44A] mb-3">
                {quiz.title}
              </p>
            )}
            <h1 className="text-[28px] sm:text-[36px] font-bold leading-tight text-[#3F5A63]"
              style={{ fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}>
              {ar ? "اختر وضع اللعبة" : "Choose Game Mode"}
            </h1>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className="group text-left rounded-2xl p-6 bg-white border-2 border-[hsl(var(--nb-border))] shadow-[4px_4px_0_0_hsl(var(--nb-border))] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_hsl(var(--nb-border))] transition-all duration-150"
              >
                <div className="flex items-center justify-between mb-6">
                  <span className="font-mono text-[11px] tracking-widest text-black/30">{m.num}</span>
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center border-2 border-[hsl(var(--nb-border))]"
                    style={{ background: m.accent, color: "white" }}
                  >
                    {m.icon}
                  </div>
                </div>

                <div className="text-[20px] font-bold text-[#3F5A63] leading-tight mb-2">
                  {ar ? m.labelAr : m.label}
                </div>

                <div className="text-[13px] leading-relaxed text-black/55">
                  {ar ? m.descAr : m.desc}
                </div>

                <div
                  className="mt-4 text-[11px] font-bold tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                  style={{ color: m.accent }}
                >
                  {ar ? "اختر" : "Select →"}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Settings + lobby ──────────────────────────────────────────────────────
  const selectedAccent = selectedMode!.accent;
  const needsTimer = mode !== "physical";

  return (
    <div className="min-h-full p-6 md:p-10" style={{ background: "hsl(var(--background))" }}>
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Top bar */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setMode(null); setSessionId(null); setStudents([]); }}
            className="flex items-center gap-1.5 text-sm font-medium text-black/50 hover:text-[#3F5A63] transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            {ar ? "تغيير الوضع" : "Change mode"}
          </button>

          <div
            className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border-2 border-[hsl(var(--nb-border))] bg-white shadow-[2px_2px_0_0_hsl(var(--nb-border))]"
            style={{ color: selectedAccent }}
          >
            <span className="h-3.5 w-3.5 [&>svg]:h-full [&>svg]:w-full">{selectedMode!.icon}</span>
            {ar ? selectedMode!.labelAr : selectedMode!.label}
          </div>
        </div>

        <div>
          <h1 className="text-[26px] sm:text-[32px] font-bold text-[#3F5A63] leading-tight"
            style={{ fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}>
            {t("host_game")}
          </h1>
          {quiz && <p className="mt-1 text-sm text-black/45">{quiz.title}</p>}
        </div>

        <div className="grid md:grid-cols-[1fr_340px] gap-5 items-start">

          {/* ── Settings card ── */}
          <div className="rounded-2xl p-6 space-y-6 bg-white border-2 border-[hsl(var(--nb-border))] shadow-[4px_4px_0_0_hsl(var(--nb-border))]">
            <h2 className="font-semibold text-[15px] text-[#3F5A63]">{ar ? "إعدادات اللعبة" : "Game Settings"}</h2>

            {/* Mode description */}
            <div className="rounded-xl p-4 text-sm bg-[hsl(var(--background))] border border-black/[0.06] space-y-3">
              {mode === "classic" && (
                <>
                  <p className="text-black/65 leading-relaxed">
                    {ar
                      ? "أجب على الأسئلة بأسرع ما يمكن. الإجابة الصحيحة السريعة تكسب نقاطاً أكثر من الإجابة الصحيحة البطيئة."
                      : "Answer questions as fast as you can. A quick correct answer earns more points than a slow one."}
                  </p>
                  <div className="flex items-center gap-2 text-black/45">
                    <Trophy className="h-4 w-4 shrink-0" style={{ color: selectedAccent }} />
                    <span>{ar ? "أعلى نقاط عند انتهاء الوقت يفوز" : "Highest points when time runs out wins"}</span>
                  </div>
                </>
              )}
              {mode === "crypto_rush" && (
                <>
                  <p className="text-black/65 leading-relaxed">
                    {ar
                      ? "كل طالب يبدأ برصيد صفر ويكسب عملات كريبتو مقابل كل إجابة صحيحة. يمكن للطلاب اختراق منافسيهم وسرقة جزء من رصيدهم."
                      : "Every student starts at zero and earns crypto for each correct answer. They can also hack rivals to steal part of their balance."}
                  </p>
                  <div className="flex items-center gap-2 text-black/45">
                    <Trophy className="h-4 w-4 shrink-0 text-[#C8783A]" />
                    <span>{ar ? "أعلى رصيد عند انتهاء الوقت يفوز" : "Highest balance when time runs out wins"}</span>
                  </div>
                </>
              )}
              {mode === "dodgeball" && (
                <>
                  <p className="text-black/65 leading-relaxed">
                    {ar
                      ? "كل طالب يدخل بحياة واحدة فقط. كل إجابة خاطئة تُحذفه من الميدان. المتبقون يواصلون حتى يبقى آخر واحد."
                      : "Each student gets one life. A wrong answer knocks them out. Survivors keep going until only one remains standing."}
                  </p>
                  <div className="flex items-center gap-2 text-black/45">
                    <Trophy className="h-4 w-4 shrink-0 text-[#C8783A]" />
                    <span>{ar ? "آخر لاعب يبقى يفوز" : "Last player standing wins"}</span>
                  </div>
                </>
              )}
              {mode === "hotpotato" && (
                <>
                  <p className="text-black/65 leading-relaxed">
                    {ar
                      ? "قنبلة موقوتة تنتقل بين الطلاب. من يجيب صح يمررها لغيره، ومن يجيب خطأ يحتفظ بها. عند الانفجار يخسر من يحملها كل نقاطه."
                      : "A live bomb passes between students. Answer correctly to pass it on, answer wrong and you keep it. When it explodes, whoever's holding it loses all their points."}
                  </p>
                  <div className="flex items-center gap-2 text-black/45">
                    <Timer className="h-4 w-4 shrink-0" style={{ color: selectedAccent }} />
                    <span>{ar ? "أعلى نقاط في النهاية يفوز" : "Most points at the end wins"}</span>
                  </div>
                </>
              )}
              {mode === "lavafloor" && (
                <>
                  <p className="text-black/65 leading-relaxed">
                    {ar
                      ? "الفصل كله يلعب معاً ضد الحمم. كل إجابة صحيحة تُبطئ ارتفاع الحمم، وكل إجابة خاطئة تُسرّعها. عليهم التعاون للصمود حتى انتهاء الوقت."
                      : "The whole class plays together against the rising lava. Correct answers slow it down, wrong answers speed it up. Cooperate to survive until time runs out."}
                  </p>
                  <div className="flex items-center gap-2 text-black/45">
                    <Flame className="h-4 w-4 shrink-0" style={{ color: selectedAccent }} />
                    <span>{ar ? "اصمدوا معاً حتى النهاية" : "Survive together to the end"}</span>
                  </div>
                </>
              )}
              {mode === "humansvszombies" && (
                <>
                  <p className="text-black/65 leading-relaxed">
                    {ar
                      ? "ينقسم الطلاب إلى فريقين، ولكل فريق شريط صحة ينخفض تلقائياً مع الوقت. الإجابات الصحيحة تكسب نقوداً لعلاج فريقك أو لتخريب الفريق الآخر. يفوز الفريق الذي يبقى شريط صحته فوق الصفر — أو صاحب الصحة الأعلى عند نهاية اليوم الخامس."
                      : "Students split into two teams, each with a health bar that drains automatically over time. Correct answers earn cash to heal your own team or sabotage the other side. Whichever team's health survives — or is higher by the end of Day 5 — wins."}
                  </p>
                  <div className="flex items-center gap-2 text-black/45">
                    <Biohazard className="h-4 w-4 shrink-0" style={{ color: selectedAccent }} />
                    <span>{ar ? "فريقان، نتيجة واحدة" : "Two teams, one outcome"}</span>
                  </div>
                </>
              )}
              {mode === "dontlookdown" && (
                <>
                  <p className="text-black/65 leading-relaxed">
                    {ar
                      ? "لعبة منصات جانبية. كل حركة وقفزة تستهلك طاقة، والطريقة الوحيدة لاستعادتها هي الإجابة الصحيحة. النقود تشتري خزانات طاقة أكبر وقفزة مزدوجة وسقوط الريشة. الفائز هو من يصل لأعلى ارتفاع."
                      : "A side-scrolling climb. Running and jumping burn energy, and the only way to refill it is answering correctly. Cash buys bigger tanks, a double jump, and Feather Fall. Highest climber wins."}
                  </p>
                  <div className="flex items-center gap-2 text-black/45">
                    <ChevronUp className="h-4 w-4 shrink-0" style={{ color: selectedAccent }} />
                    <span>{ar ? "أجب لتتسلّق" : "Answer to climb"}</span>
                  </div>
                </>
              )}
              {mode === "paintfight" && (
                <>
                  <p className="text-black/65 leading-relaxed">
                    {ar
                      ? "كل طالب يتحرك بعصا تحكم افتراضية على أرض مشتركة ويطلي أثره بلونه الخاص. التحرك يستهلك طلاءً، والإجابة الصحيحة هي الطريقة الوحيدة لتعبئته. اجمع قوى الدفع لتتحرك أسرع أو تطلي أوسع أو ترش مساحة فورية. الفائز من يطلي أكبر مساحة عند انتهاء الوقت."
                      : "Each student drives a virtual joystick around a shared arena, painting a trail in their own color. Moving burns paint, and the only way to refill it is a correct answer. Power-ups let you move faster, roll wider, or splash an instant burst. Most territory painted when time runs out wins."}
                  </p>
                  <div className="flex items-center gap-2 text-black/45">
                    <PaintRollerIcon className="h-4 w-4 shrink-0" style={{ color: selectedAccent }} />
                    <span>{ar ? "أجب لتملأ الطلاء" : "Answer to refill your paint"}</span>
                  </div>
                </>
              )}
              {mode === "physical" && (
                <>
                  <p className="text-black/65 leading-relaxed">
                    {ar
                      ? "لا حاجة لأكواد أو أجهزة للطلاب. جهاز واحد فقط يمسح رمز اللوحة عند البداية، ثم يمسح رمز كل مربع يهبط عليه الطلاب للحصول على سؤال بمستوى الصعوبة المطابق."
                      : "No codes or student devices needed. One device scans the board's QR to begin, then scans each landed-on square's QR to pull a question at that square's difficulty."}
                  </p>
                  <div className="flex items-center gap-2 text-black/45">
                    <QrCode className="h-4 w-4 shrink-0" style={{ color: selectedAccent }} />
                    <span>{ar ? "امسح، اقرأ، تابعوا اللعب" : "Scan, read aloud, keep playing"}</span>
                  </div>
                </>
              )}
            </div>

            {needsTimer && (
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase text-black/40 mb-3">
                  {ar ? "مدة اللعبة" : "Game Duration"}
                </p>
                <MinuteStepper value={minutes} onChange={setMinutes} />
              </div>
            )}

            {mode !== "physical" && (
              <QuestionTimerControl ar={ar} value={secsPerQ} onChange={setSecsPerQ} />
            )}
          </div>

          {/* ── Code + lobby card ── */}
          {mode === "physical" ? (
            <div className="rounded-2xl p-6 space-y-4 bg-white border-2 border-[hsl(var(--nb-border))] shadow-[4px_4px_0_0_hsl(var(--nb-border))]">
              <h2 className="font-semibold text-[15px] text-[#3F5A63]">{ar ? "جاهز للبدء" : "Ready to start"}</h2>
              <p className="text-sm text-black/55 leading-relaxed">
                {ar
                  ? "لا حاجة لردهة أو رمز مشاركة. اضغط ابدأ ثم مرر الجهاز إلى من سيمسك اللوحة."
                  : "No lobby or share code needed. Press start, then hand the device to whoever's scanning the board."}
              </p>
              <button
                onClick={startPhysical}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-base font-bold border-2 border-[hsl(var(--nb-border))] bg-[#3F5A63] text-white shadow-[4px_4px_0_0_hsl(var(--nb-border))] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_hsl(var(--nb-border))] transition-all active:scale-[0.99]"
              >
                <QrCode className="h-5 w-5" />
                {ar ? "ابدأ اللعبة الفيزيائية" : "Start Physical Game"}
              </button>
            </div>
          ) : (
          <div className="rounded-2xl p-6 space-y-4 bg-white border-2 border-[hsl(var(--nb-border))] shadow-[4px_4px_0_0_hsl(var(--nb-border))]">
            <h2 className="font-semibold text-[15px] text-[#3F5A63]">{t("game_code")}</h2>

            {/* Code display */}
            <div className="rounded-2xl p-6 text-center bg-white border-2 border-[hsl(var(--nb-border))] shadow-[4px_4px_0_0_hsl(var(--nb-border))]">
              <div className="font-mono text-5xl font-black tracking-[0.2em] select-all text-[#3F5A63]">
                {code}
              </div>
              <div className="mt-2 text-xs text-black/35">
                {ar ? "شارك مع طلابك" : "Share with your students"}
              </div>
            </div>

            {/* Copy */}
            <button
              onClick={copy}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold border-2 border-[hsl(var(--nb-border))] transition-all hover:translate-x-px hover:translate-y-px"
              style={copied
                ? { background: "#3F5A63", color: "white", boxShadow: "2px 2px 0 0 hsl(var(--nb-border))" }
                : { background: "white", color: "#3F5A63", boxShadow: "3px 3px 0 0 hsl(var(--nb-border))" }
              }
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? (ar ? "تم النسخ!" : "Copied!") : t("copy")}
            </button>

            {/* Open lobby / students / start */}
            {!sessionId ? (
              <button
                onClick={openLobby}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-base font-bold border-2 border-[hsl(var(--nb-border))] bg-[#8FC44A] text-[#3F5A63] shadow-[4px_4px_0_0_hsl(var(--nb-border))] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_hsl(var(--nb-border))] transition-all active:scale-[0.99]"
              >
                <Users className="h-5 w-5" />
                {t("open_lobby")}
              </button>
            ) : (
              <>
                {/* Student roster */}
                <div className="rounded-xl p-4 border border-black/[0.08] bg-[hsl(var(--background))]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-[#3F5A63]">
                      {students.length} / {maxStudents}
                      <span className="ms-1.5 text-xs font-normal text-black/40">
                        {t("students_connected")}
                      </span>
                    </span>
                    <span className="h-2 w-2 rounded-full animate-pulse bg-[#8FC44A]" />
                  </div>

                  {students.length === 0 ? (
                    <div className="text-sm text-center py-8 text-black/35">
                      {t("waiting_students")}...
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-56 overflow-auto">
                      {students.map(s => (
                        <div key={s.id}
                          className="flex items-center justify-between rounded-lg px-3 py-2 text-sm group bg-white border border-black/[0.06]">
                          <span className="font-medium text-[#3F5A63] truncate">{s.name}</span>
                          <button
                            onClick={() => removeStudent(s.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cancel lobby */}
                <button
                  onClick={cancelLobby}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold border-2 border-[hsl(var(--nb-border))] bg-white text-red-500 shadow-[3px_3px_0_0_hsl(var(--nb-border))] hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_0_hsl(var(--nb-border))] transition-all"
                >
                  {ar ? "إغلاق الردهة" : "Cancel lobby"}
                </button>

                {/* Start game */}
                <button
                  onClick={startGame}
                  disabled={students.length < 1}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-base font-bold border-2 border-[hsl(var(--nb-border))] bg-[#3F5A63] text-white shadow-[4px_4px_0_0_hsl(var(--nb-border))] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_hsl(var(--nb-border))] transition-all active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:shadow-[4px_4px_0_0_hsl(var(--nb-border))]"
                >
                  <Play className="h-5 w-5" />
                  {t("start_game")}
                </button>
              </>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HostGame;
