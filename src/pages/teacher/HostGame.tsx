import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Copy, Play, Users, Trash2, Zap, Target, Heart, Skull, Timer, Trophy, Flame, ChevronLeft, Check, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

const genCode = () => {
  const c = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => c[Math.floor(Math.random() * c.length)]).join("");
};

type GameMode = "crypto_rush" | "dodgeball" | "hotpotato" | "lavafloor";

const MODES: { id: GameMode; icon: React.ReactNode; label: string; labelAr: string; desc: string; descAr: string; color: string; glow: string; bg: string }[] = [
  {
    id: "crypto_rush",
    icon: <Zap className="h-8 w-8" />,
    label: "Crypto Rush",
    labelAr: "كريبتو رَش",
    desc: "Answer questions, earn crypto, hack rivals",
    descAr: "أجب على الأسئلة، اكسب كريبتو، اخترق منافسيك",
    color: "#00ff88",
    glow: "0 0 32px #00ff8855, 0 0 64px #00ff8822",
    bg: "linear-gradient(135deg, #00ff8811 0%, #00ff8804 100%)",
  },
  {
    id: "dodgeball",
    icon: <Target className="h-8 w-8" />,
    label: "Time Wizard",
    labelAr: "ساحر الوقت",
    desc: "Cast spells of time — stop the clock at exactly 10.00s",
    descAr: "أوقف الزمن عند 10.00 ثانية بالضبط — الأقرب ينجو",
    color: "#22d3ee",
    glow: "0 0 32px #22d3ee55, 0 0 64px #22d3ee22",
    bg: "linear-gradient(135deg, #22d3ee11 0%, #22d3ee04 100%)",
  },
  {
    id: "hotpotato",
    icon: <Timer className="h-8 w-8" />,
    label: "Pass It",
    labelAr: "مرّرها",
    desc: "Live bomb on a fuse — pass it before it blows",
    descAr: "قنبلة موقوتة — مرّرها قبل أن تنفجر",
    color: "#b8f026",
    glow: "0 0 32px #b8f02655, 0 0 64px #b8f02622",
    bg: "linear-gradient(135deg, #b8f02611 0%, #b8f02604 100%)",
  },
  {
    id: "lavafloor",
    icon: <Flame className="h-8 w-8" />,
    label: "Lava Floor",
    labelAr: "أرضية الحمم",
    desc: "Survive together before the lava rises",
    descAr: "اصمدوا معاً قبل أن تبتلعكم الحمم",
    color: "#ef4444",
    glow: "0 0 32px #ef444455, 0 0 64px #ef444422",
    bg: "linear-gradient(135deg, #ef444411 0%, #ef444404 100%)",
  },
];

const MINUTE_PRESETS = [5, 10, 15, 20, 30];

/* shared dark-metal constants */
const GUN_BG = "radial-gradient(ellipse at 30% 10%, hsl(199 35% 13%) 0%, hsl(199 30% 8%) 55%, hsl(199 25% 5%) 100%)";
const metalPanel = {
  background: "linear-gradient(180deg, hsl(199 28% 16%), hsl(199 25% 11%))",
  border: "1.5px solid hsl(199 28% 24%)",
  boxShadow: "inset 0 1.5px 0 hsl(199 25% 32%), inset 0 -1px 0 hsl(199 20% 6%), 0 4px 14px hsl(0 0% 0% / 0.45)",
};

/** +/- stepper for choosing minutes */
const MinuteStepper = ({ value, onChange, color }: { value: number; onChange: (v: number) => void; color: string }) => {
  const step = (delta: number) => onChange(Math.min(30, Math.max(2, value + delta)));
  return (
    <div className="space-y-3">
      {/* Big stepper row */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => step(-1)}
          disabled={value <= 2}
          className="h-11 w-11 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
          style={{ background: "hsl(199 28% 18%)", border: `1.5px solid hsl(199 28% 26%)`, color: "hsl(199 25% 72%)" }}
        >
          <Minus className="h-4 w-4" />
        </button>

        <div
          className="flex-1 rounded-xl flex flex-col items-center justify-center py-3"
          style={{ background: color + "12", border: `1.5px solid ${color}44` }}
        >
          <span className="font-black text-4xl leading-none" style={{ color }}>{value}</span>
          <span className="text-xs mt-1 font-medium" style={{ color: "hsl(199 25% 52%)" }}>min</span>
        </div>

        <button
          onClick={() => step(1)}
          disabled={value >= 30}
          className="h-11 w-11 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
          style={{ background: "hsl(199 28% 18%)", border: `1.5px solid hsl(199 28% 26%)`, color: "hsl(199 25% 72%)" }}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Quick presets */}
      <div className="flex gap-2 flex-wrap">
        {MINUTE_PRESETS.map(p => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className="px-3 py-1 rounded-lg text-xs font-bold transition-all"
            style={value === p
              ? { background: color + "33", color, border: `1.5px solid ${color}77` }
              : { background: "hsl(199 28% 16%)", color: "hsl(199 25% 58%)", border: "1.5px solid hsl(199 28% 22%)" }
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
  const [code] = useState(genCode());
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);

  const [minutes, setMinutes] = useState(7);
  const maxStudents = 40;

  useEffect(() => {
    if (!quizId) return;
    supabase.from("quizzes").select("*").eq("id", quizId).maybeSingle().then(({ data }) => setQuiz(data));
  }, [quizId]);

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
        settings.timePerQ = 20;
      }
      const { data, error } = await supabase.from("game_sessions")
        .insert({ teacher_id: user.id, quiz_id: quizId, code, status: "lobby", settings }).select().single();
      if (error) throw error;
      setSessionId(data.id);
      toast.success("Lobby opened");
    } catch (e: any) { toast.error(e.message); }
  };

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startGame = async () => {
    if (!sessionId) return;
    await supabase.from("game_sessions").update({
      status: "running",
      started_at: new Date().toISOString(),
      current_question_started_at: new Date().toISOString(),
    }).eq("id", sessionId);
    navigate(`/app/games/${sessionId}/monitor`);
  };

  const removeStudent = async (id: string) => {
    await supabase.from("game_students").delete().eq("id", id);
  };

  const selectedMode = mode ? MODES.find(m => m.id === mode)! : null;

  // ── Mode picker ──────────────────────────────────────────────────────────
  if (!mode) {
    return (
      <div className="min-h-full rounded-2xl p-6 md:p-10" style={{ background: GUN_BG }}>
        <div className="max-w-3xl mx-auto space-y-8">
          <div>
            <h1 className="font-display text-3xl font-black text-white">
              {ar ? "اختر وضع اللعبة" : "Choose Game Mode"}
            </h1>
            {quiz && <p className="mt-1 text-sm" style={{ color: "hsl(199 25% 58%)" }}>{quiz.title}</p>}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className="group text-left rounded-2xl p-6 transition-all duration-200 hover:-translate-y-1"
                style={{ ...metalPanel }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = m.glow + ", " + metalPanel.boxShadow;
                  (e.currentTarget as HTMLElement).style.borderColor = m.color + "66";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = metalPanel.boxShadow;
                  (e.currentTarget as HTMLElement).style.borderColor = "hsl(199 28% 22%)";
                }}
              >
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl"
                  style={{ background: m.bg, color: m.color, border: `1px solid ${m.color}33` }}>
                  {m.icon}
                </div>
                <div className="font-black text-xl text-white mb-1">{ar ? m.labelAr : m.label}</div>
                <div className="text-sm leading-relaxed" style={{ color: "hsl(199 25% 58%)" }}>
                  {ar ? m.descAr : m.desc}
                </div>
                <div className="mt-5 text-xs font-bold tracking-wide opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: m.color }}>
                  {ar ? "اختر ←" : "Select →"}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Settings + lobby ─────────────────────────────────────────────────────
  const modeColor = selectedMode!.color;
  const needsTimer = mode !== "dodgeball";

  return (
    <div className="min-h-full rounded-2xl p-6 md:p-10" style={{ background: GUN_BG }}>
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Top bar */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => { setMode(null); setSessionId(null); setStudents([]); }}
            className="flex items-center gap-1.5 text-sm font-medium transition-colors"
            style={{ color: "hsl(199 25% 58%)" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "white"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "hsl(199 25% 58%)"}
          >
            <ChevronLeft className="h-4 w-4" />
            {ar ? "تغيير الوضع" : "Change mode"}
          </button>

          <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black"
            style={{ background: modeColor + "22", color: modeColor, border: `1px solid ${modeColor}44` }}>
            <span className="h-3.5 w-3.5 [&>svg]:h-full [&>svg]:w-full">{selectedMode!.icon}</span>
            {ar ? selectedMode!.labelAr : selectedMode!.label}
          </div>
        </div>

        <div>
          <h1 className="font-display text-3xl font-black text-white">{t("host_game")}</h1>
          {quiz && <p className="mt-1 text-sm" style={{ color: "hsl(199 25% 58%)" }}>{quiz.title}</p>}
        </div>

        <div className="grid md:grid-cols-[1fr_360px] gap-6 items-start">

          {/* ── Settings card ── */}
          <div className="rounded-2xl p-6 space-y-6" style={metalPanel}>
            <h2 className="font-bold text-base text-white">{ar ? "إعدادات اللعبة" : "Game Settings"}</h2>

            {/* Mode info blurb */}
            <div className="rounded-xl p-4 space-y-3 text-sm"
              style={{ background: "hsl(199 30% 9%)", border: "1.5px solid hsl(199 28% 18%)" }}>
              {mode === "crypto_rush" && (
                <>
                  <div className="flex items-center gap-2.5" style={{ color: "hsl(199 25% 67%)" }}>
                    <Zap className="h-4 w-4 shrink-0" style={{ color: modeColor }} />
                    {ar ? "أجب على الأسئلة واكسب كريبتو" : "Answer questions and earn crypto"}
                  </div>
                  <div className="flex items-center gap-2.5" style={{ color: "hsl(199 25% 67%)" }}>
                    <Trophy className="h-4 w-4 shrink-0 text-amber-400" />
                    {ar ? "أعلى رصيد عند انتهاء الوقت يفوز" : "Highest balance when time runs out wins"}
                  </div>
                </>
              )}
              {mode === "dodgeball" && (
                <>
                  <div className="flex items-center gap-2.5" style={{ color: "hsl(199 25% 67%)" }}>
                    <Heart className="h-4 w-4 shrink-0 text-red-400" />
                    {ar ? "كل لاعب يبدأ بحياة واحدة" : "Each player starts with 1 life"}
                  </div>
                  <div className="flex items-center gap-2.5" style={{ color: "hsl(199 25% 67%)" }}>
                    <Skull className="h-4 w-4 shrink-0" style={{ color: "hsl(199 25% 58%)" }} />
                    {ar ? "إجابة خاطئة = تُحذف" : "Wrong answer = eliminated"}
                  </div>
                  <div className="flex items-center gap-2.5" style={{ color: "hsl(199 25% 67%)" }}>
                    <Trophy className="h-4 w-4 shrink-0 text-amber-400" />
                    {ar ? "آخر لاعب يفوز" : "Last player standing wins"}
                  </div>
                </>
              )}
              {mode === "hotpotato" && (
                <>
                  <div className="flex items-center gap-2.5" style={{ color: "hsl(199 25% 67%)" }}>
                    <Timer className="h-4 w-4 shrink-0" style={{ color: modeColor }} />
                    {ar ? "قنبلة تنتقل بين اللاعبين — أجب صح لتمررها" : "A bomb passes between players — answer right to pass it"}
                  </div>
                  <div className="flex items-center gap-2.5" style={{ color: "hsl(199 25% 67%)" }}>
                    <Zap className="h-4 w-4 shrink-0" style={{ color: modeColor }} />
                    {ar ? "من يحملها عند الانفجار تُصفّر نقاطه" : "Whoever holds it on explosion loses their score"}
                  </div>
                </>
              )}
              {mode === "lavafloor" && (
                <>
                  <div className="flex items-center gap-2.5" style={{ color: "hsl(199 25% 67%)" }}>
                    <Flame className="h-4 w-4 shrink-0 text-orange-500" />
                    {ar ? "الحمم ترتفع — أجيبوا صح لإبطائها" : "Lava rises — answer correctly to slow it"}
                  </div>
                  <div className="flex items-center gap-2.5" style={{ color: "hsl(199 25% 67%)" }}>
                    <Trophy className="h-4 w-4 shrink-0 text-amber-400" />
                    {ar ? "اصمدوا حتى ينتهي الوقت لتفوزوا" : "Survive until time runs out to win"}
                  </div>
                </>
              )}
            </div>

            {/* Duration stepper — shown for all modes except dodgeball */}
            {needsTimer && (
              <div>
                <p className="text-xs font-semibold mb-3" style={{ color: "hsl(199 25% 52%)" }}>
                  {ar ? "مدة اللعبة" : "Game Duration"}
                </p>
                <MinuteStepper value={minutes} onChange={setMinutes} color={modeColor} />
              </div>
            )}

          </div>

          {/* ── Code + lobby card ── */}
          <div className="rounded-2xl p-6 space-y-5" style={metalPanel}>
            <h2 className="font-bold text-base text-white">{t("game_code")}</h2>

            {/* Code display */}
            <div className="rounded-2xl p-6 text-center"
              style={{
                background: "hsl(199 30% 8%)",
                border: `2px solid ${modeColor}33`,
                boxShadow: `inset 0 2px 0 hsl(199 28% 20%), 0 0 40px ${modeColor}18`,
              }}>
              <div
                className="font-mono text-6xl font-black tracking-[0.18em] select-all"
                style={{
                  color: modeColor,
                  textShadow: `0 0 20px ${modeColor}99, 0 0 40px ${modeColor}44`,
                }}
              >
                {code}
              </div>
              <div className="mt-2 text-xs" style={{ color: "hsl(199 25% 47%)" }}>
                {ar ? "شارك مع طلابك" : "Share with your students"}
              </div>
            </div>

            {/* Copy only */}
            <button
              onClick={copy}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all"
              style={{
                background: copied ? modeColor + "22" : "hsl(199 28% 16%)",
                color: copied ? modeColor : "hsl(199 25% 72%)",
                border: `1.5px solid ${copied ? modeColor + "55" : "hsl(199 28% 26%)"}`,
              }}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? (ar ? "تم النسخ!" : "Copied!") : t("copy")}
            </button>

            {/* Open lobby / students / start */}
            {!sessionId ? (
              <button
                onClick={openLobby}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-base font-black transition-all hover:brightness-110 active:scale-[0.98]"
                style={{
                  background: `linear-gradient(135deg, ${modeColor}dd, ${modeColor}aa)`,
                  color: "hsl(199 30% 8%)",
                  boxShadow: `0 4px 24px ${modeColor}44`,
                }}
              >
                <Users className="h-5 w-5" />
                {t("open_lobby")}
              </button>
            ) : (
              <>
                {/* Student roster */}
                <div className="rounded-xl p-4"
                  style={{ background: "hsl(199 30% 8%)", border: "1.5px solid hsl(199 28% 18%)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-white">
                      {students.length} / {maxStudents}
                      <span className="ms-1.5 text-xs font-normal" style={{ color: "hsl(199 25% 52%)" }}>
                        {t("students_connected")}
                      </span>
                    </span>
                    <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: modeColor }} />
                  </div>

                  {students.length === 0 ? (
                    <div className="text-sm text-center py-8" style={{ color: "hsl(199 25% 42%)" }}>
                      {t("waiting_students")}...
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-56 overflow-auto">
                      {students.map(s => (
                        <div key={s.id}
                          className="flex items-center justify-between rounded-lg px-3 py-2 text-sm group"
                          style={{ background: "hsl(199 28% 14%)", border: "1px solid hsl(199 28% 20%)" }}>
                          <span className="font-medium text-white truncate">{s.name}</span>
                          <button
                            onClick={() => removeStudent(s.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
                            style={{ color: "hsl(0 70% 55%)" }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Start game */}
                <button
                  onClick={startGame}
                  disabled={students.length < 1}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-base font-black transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: `linear-gradient(135deg, ${modeColor}dd, ${modeColor}aa)`,
                    color: "hsl(199 30% 8%)",
                    boxShadow: students.length >= 1 ? `0 4px 24px ${modeColor}44` : "none",
                  }}
                >
                  <Play className="h-5 w-5" />
                  {t("start_game")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HostGame;
