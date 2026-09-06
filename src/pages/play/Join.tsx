import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import logoLight from "@/assets/logo-light.png";
import { hueForJoinIndex } from "@/lib/paintFight";
import { Seo } from "@/components/Seo";
import { Avatar } from "@/components/Avatar";
import { CIRCLE_COLORS, FACES, colorIndexForName, faceIndexForName } from "@/lib/avatarIdentity";
import { ChevronLeft, ChevronRight } from "lucide-react";

// ─── Password pools (Crypto Rush only) ─────────────────────────────────────
// English pool: trendy internet-slang flavored, keeps the "hacker handle" feel
const PASSWORD_POOL_EN = [
  "skibidi_toilet", "sigma_grindset", "rizz_god_67", "gyatt_alert", "no_cap_frfr",
  "ohio_rizz", "goated_67", "npc_moment", "brainrot_king", "aura_100k",
  "delulu_mode", "mewing_maxx", "sigma_67", "chad_energy", "labubu_army",
  "z3r0_c00l", "matrix_42", "quantum_leap", "cyber_punk_77", "hyper_drive_8",
];
// Arabic pool: ~70% Arabic slang, ~30% trendy English mixed in
const PASSWORD_POOL_AR = [
  "زعيم_67", "فشخ_99", "أسطورة_42", "وحش_الشبكة", "نار_تجنن",
  "جامد_قوي", "ملك_البيانات", "خطير_بزيادة", "طاقة_زعيم", "هكر_شبح",
  "sigma_67", "gyatt_alert", "labubu_67", "goated_af",
];

// Crypto Rush terminal theme (used by boot + launch stages only) — same green
// as the real in-session terminal (Game.tsx) and the teacher monitor, not an
// independently-invented shade.
const CR = { bg: "#06110d", accent: "hsl(120 100% 55%)", accentDim: "hsl(120 100% 55% / 0.14)", accentBorder: "hsl(120 100% 55% / 0.27)" };

type Stage = "code" | "name" | "boot" | "launch";

/**
 * Types out `lines` one character at a time while `active` is true, restarting
 * fresh each time `active` flips from false to true (not on every re-render —
 * `lines` is read through a ref so a parent re-render recreating the array
 * doesn't reset progress). Driven by a single setTimeout chain instead of an
 * async loop: the effect's cleanup clears the pending timer, so double-firing
 * the effect (React re-running effects) can't produce two overlapping chains.
 */
const useTypewriter = (lines: string[], active: boolean) => {
  const [committed, setCommitted] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  const linesRef = useRef<string[]>(lines);
  linesRef.current = lines;

  useEffect(() => {
    if (!active) return;
    const script = linesRef.current;
    setCommitted([]);
    setCurrent("");
    let li = 0, ci = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (li >= script.length) return;
      const line = script[li];
      if (ci < line.length) {
        ci += 1;
        setCurrent(line.slice(0, ci));
        timer = setTimeout(tick, 58);
      } else {
        const finishedLine = line;
        li += 1; ci = 0;
        setCommitted(prev => [...prev, finishedLine]);
        setCurrent("");
        timer = setTimeout(tick, 408);
      }
    };
    timer = setTimeout(tick, 0);
    return () => clearTimeout(timer);
  }, [active]);

  return { committed, current, done: committed.length > 0 && committed.length === lines.length };
};

// ─── Join ───────────────────────────────────────────────────────────────────
const Join = () => {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { i18n } = useTranslation();

  // 4-cell code input
  const [cells, setCells] = useState(["", "", "", ""]);
  const r0 = useRef<HTMLInputElement>(null);
  const r1 = useRef<HTMLInputElement>(null);
  const r2 = useRef<HTMLInputElement>(null);
  const r3 = useRef<HTMLInputElement>(null);
  const cellRefs = [r0, r1, r2, r3];

  const [name, setName]       = useState("");
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage]     = useState<Stage>("code");
  const [chosen, setChosen]   = useState<string | null>(null);

  // Avatar color/face follow the name hash until the student taps a swatch or
  // an arrow — after that this pair is what actually gets stored, not a
  // re-derived hash, so their pick sticks even if they keep editing the name.
  const [avatarColorIdx, setAvatarColorIdx] = useState(0);
  const [avatarFaceIdx, setAvatarFaceIdx]   = useState(0);
  const [colorTouched, setColorTouched] = useState(false);
  const [faceTouched, setFaceTouched]   = useState(false);
  useEffect(() => {
    const n = name.trim();
    if (!n) return;
    if (!colorTouched) setAvatarColorIdx(colorIndexForName(n));
    if (!faceTouched) setAvatarFaceIdx(faceIndexForName(n));
  }, [name]);

  // Paint body + html dark so no cream bleeds through on iOS edges
  useEffect(() => {
    const prev = document.body.style.background;
    document.documentElement.style.background = "#080a10";
    document.body.style.background = "#080a10";
    return () => {
      document.documentElement.style.background = "";
      document.body.style.background = prev;
    };
  }, []);

  // Keep join screen LTR regardless of language
  useEffect(() => {
    const prevDir = document.documentElement.dir;
    document.documentElement.dir = "ltr";
    return () => {
      document.documentElement.dir = prevDir;
    };
  }, []);

  const code  = cells.join("");
  const mode  = (session?.settings?.mode as string) ?? "crypto_rush";
  // teacher's language, once known; falls back to the browser's current language pre-session
  const ar = (session?.settings?.lang ?? i18n.language) === "ar";

  const passwordChoices = useMemo(
    () => [...(ar ? PASSWORD_POOL_AR : PASSWORD_POOL_EN)].sort(() => Math.random() - 0.5).slice(0, 5),
    [ar]
  );

  // Pre-fill from URL ?code=XXXX
  useEffect(() => {
    const urlCode = (params.get("code") || "").replace(/\D/g, "").slice(0, 4);
    if (urlCode) setCells(urlCode.split("").concat(["", "", "", ""]).slice(0, 4));
  }, []);

  // Auto-submit when all 4 cells filled
  const submitting = useRef(false);
  useEffect(() => {
    if (code.length === 4 && stage === "code" && !submitting.current) {
      submitting.current = true;
      validateCode(code);
    }
  }, [code, stage]);

  const validateCode = async (c: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("game_sessions")
      .select("*")
      .eq("code", c)
      .in("status", ["lobby", "running"])
      .maybeSingle();
    setLoading(false);
    submitting.current = false;
    if (error || !data) {
      toast.error(ar ? "رمز غير صحيح" : "Invalid code");
      setCells(["", "", "", ""]);
      setTimeout(() => r0.current?.focus(), 50);
      return;
    }
    setSession(data);
    setStage("name");
  };

  // Cell input handlers
  const handleCell = (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "").slice(-1);
    const next = [...cells]; next[i] = v; setCells(next);
    if (v && i < 3) cellRefs[i + 1].current?.focus();
  };
  const handleCellKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !cells[i] && i > 0) {
      const next = [...cells]; next[i - 1] = ""; setCells(next);
      cellRefs[i - 1].current?.focus();
    }
  };
  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (!text) return;
    e.preventDefault();
    const next = ["", "", "", ""] as string[];
    for (let i = 0; i < 4; i++) next[i] = text[i] ?? "";
    setCells(next);
    cellRefs[Math.min(text.length, 3)].current?.focus();
  };

  // ── Crypto Rush: boot typewriter, then launch typewriter ──────
  const BOOT_LINES = ar
    ? ["> تم اكتشاف مستخدم جديد!", "> أهلاً بك في بوابة اختراق الطرفية", "> اختر كلمة مرور:"]
    : ["> New User Detected!", "> Welcome to the Terminal Hacking Portal", "> Please select a password:"];
  const LAUNCH_LINES = ar
    ? ["> تم التحقق من الهوية", "> جارٍ تحميل برنامج تعدين الكريبتو...", ">", "> .......", "> .......", "> جارٍ الإطلاق..."]
    : ["> Authentication Complete", "> Loading Crypto Mining Software...", ">", "> .......", "> .......", "> Launching..."];

  const boot = useTypewriter(BOOT_LINES, stage === "boot");
  const launch = useTypewriter(LAUNCH_LINES, stage === "launch");
  const showPasswords = boot.done;

  // Boot + launch render as ONE continuous scrolling terminal — this ref
  // auto-scrolls to the bottom as lines append, same pattern as the real
  // in-session terminal's log in Game.tsx.
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [boot.committed, boot.current, launch.committed, chosen]);

  // Once the launch line-up finishes typing, actually join the game.
  useEffect(() => {
    if (!launch.done || !session) return;
    doInsert(session, name, chosen ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launch.done]);

  const doInsert = async (sess: any, playerName: string, password: string) => {
    try {
      const payload: any = {
        session_id: sess.id, name: playerName.trim(), password,
        avatar_color: avatarColorIdx, avatar_face: avatarFaceIdx,
      };
      if (sess.settings?.mode === "humansvszombies") {
        const { data: existing } = await supabase.from("game_students").select("team").eq("session_id", sess.id) as any;
        const humanCount  = (existing ?? []).filter((s: any) => s.team === "human").length;
        const zombieCount = (existing ?? []).filter((s: any) => s.team === "zombie").length;
        payload.team = humanCount === zombieCount ? (Math.random() < 0.5 ? "human" : "zombie")
          : humanCount < zombieCount ? "human" : "zombie";
      }
      if (sess.settings?.mode === "paintfight") {
        const { count } = await supabase.from("game_students").select("id", { count: "exact", head: true }).eq("session_id", sess.id);
        payload.fight_hue = hueForJoinIndex(count ?? 0);
      }
      const { data: student, error } = await supabase
        .from("game_students")
        .insert(payload)
        .select().single();
      if (error) throw error;
      localStorage.setItem(`hash_student_${sess.id}`, student.id);
      nav(`/join/${sess.id}`);
    } catch (err: any) {
      toast.error(err.message || (ar ? "تعذّر الانضمام" : "Could not join"));
      setStage("name");
    }
  };

  const submitName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (mode === "crypto_rush") setStage("boot");
    else doInsert(session, name, "");
  };

  // ════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════

  // ── Code entry (mode-agnostic) ────────────────────────────────
  if (stage === "code") {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center p-6 safe-top safe-bottom overflow-hidden"
        style={{ background: "radial-gradient(ellipse at 50% 35%, #141928 0%, #080a10 70%)" }}
      >
        {/* A bare room-code entry form has no content worth ranking for —
            noindex avoids it reading as a thin/doorway page. */}
        <Seo
          path="/play"
          titleAr="انضم إلى لعبة"
          titleEn="Join a Game"
          descriptionAr="أدخل رمز الغرفة للانضمام إلى جلسة نفلها."
          descriptionEn="Enter your room code to join a live nefelha session."
          index={false}
        />
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative z-10 w-full max-w-xs text-center space-y-12 animate-fade-up">
          <div className="space-y-3 flex flex-col items-center">
            <img src={logoLight} alt="nefelha" className="h-16 w-16 object-contain" />
            <div className="text-white/30 text-sm tracking-wide">{ar ? "أدخل رمز اللعبة" : "Enter the game code"}</div>
          </div>

          <div className="space-y-6">
            <div className="flex gap-3 justify-center" onPaste={handlePaste}>
              {cells.map((c, i) => (
                <input
                  key={i}
                  ref={cellRefs[i]}
                  value={c}
                  onChange={e => handleCell(i, e)}
                  onKeyDown={e => handleCellKey(i, e)}
                  maxLength={2}
                  autoFocus={i === 0}
                  inputMode="numeric"
                  className={cn(
                    "w-[68px] h-[84px] text-center font-mono text-[32px] font-black",
                    "bg-white/[0.06] border-2 border-white/[0.14] text-white rounded-2xl",
                    "focus:border-white/50 focus:bg-white/[0.10] focus:outline-none",
                    "transition-all duration-150 uppercase caret-transparent select-none",
                    c && "border-white/30 bg-white/[0.09]"
                  )}
                />
              ))}
            </div>
            {loading && (
              <p className="text-white/35 text-sm font-mono animate-pulse tracking-widest">
                {ar ? "جارٍ التحقق..." : "Verifying..."}
              </p>
            )}
          </div>

          <p className="text-white/15 text-xs">{ar ? "الرمز مكوّن من 4 أرقام" : "The code is 4 digits"}</p>
        </div>
      </div>
    );
  }

  // ── Name entry (mode-agnostic — matches the code entry page) ──
  if (stage === "name") {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center p-6 safe-top safe-bottom overflow-hidden"
        style={{ background: "radial-gradient(ellipse at 50% 35%, #141928 0%, #080a10 70%)" }}
      >
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative z-10 w-full max-w-xs text-center space-y-12 animate-fade-up">
          <div className="space-y-3 flex flex-col items-center">
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={ar ? "الوجه السابق" : "Previous face"}
                onClick={() => { setFaceTouched(true); setAvatarFaceIdx(i => (i - 1 + FACES.length) % FACES.length); }}
                className={cn(
                  "h-8 w-8 flex items-center justify-center text-white/25 hover:text-white/70 transition-all duration-200",
                  name.trim() ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <div className="relative h-16 w-16 shrink-0">
                <img
                  src={logoLight} alt="nefelha"
                  className={cn(
                    "absolute inset-0 h-16 w-16 object-contain transition-opacity duration-200",
                    name.trim() ? "opacity-0" : "opacity-100"
                  )}
                />
                <div
                  className={cn(
                    "absolute inset-0 flex items-center justify-center transition-all duration-200",
                    name.trim() ? "opacity-100 scale-100" : "opacity-0 scale-75"
                  )}
                >
                  {name.trim() && (
                    <Avatar
                      key={`${avatarColorIdx}-${avatarFaceIdx}`}
                      name={name.trim()}
                      colorIndex={avatarColorIdx}
                      faceIndex={avatarFaceIdx}
                      size={64}
                      className="animate-scale-in"
                    />
                  )}
                </div>
              </div>

              <button
                type="button"
                aria-label={ar ? "الوجه التالي" : "Next face"}
                onClick={() => { setFaceTouched(true); setAvatarFaceIdx(i => (i + 1) % FACES.length); }}
                className={cn(
                  "h-8 w-8 flex items-center justify-center text-white/25 hover:text-white/70 transition-all duration-200",
                  name.trim() ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div
              className={cn(
                "flex gap-2 transition-opacity duration-200",
                name.trim() ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
            >
              {CIRCLE_COLORS.map((c, i) => (
                <button
                  key={c}
                  type="button"
                  aria-label={ar ? `اللون ${i + 1}` : `Color ${i + 1}`}
                  onClick={() => { setColorTouched(true); setAvatarColorIdx(i); }}
                  className={cn(
                    "h-5 w-5 rounded-full transition-all duration-150",
                    avatarColorIdx === i && name.trim()
                      ? "scale-125 ring-2 ring-white/70 ring-offset-2 ring-offset-[#0d1119]"
                      : "opacity-50 hover:opacity-90"
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>

            <div className="text-white/30 text-sm tracking-wide">
              {name.trim()
                ? name.trim()
                : ar ? "اسمك في اللعبة؟" : "What's your name?"}
            </div>
          </div>

          <form onSubmit={submitName} className="space-y-4">
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={24}
              placeholder={ar ? "اسم اللاعب..." : "Player name..."}
              className={cn(
                "w-full h-14 px-4 text-center text-lg font-bold rounded-2xl text-white",
                "bg-white/[0.06] border-2 border-white/[0.14]",
                "focus:border-white/50 focus:bg-white/[0.10] focus:outline-none",
                "placeholder:text-white/20 transition-all duration-150"
              )}
            />
            <button
              type="submit"
              disabled={!name.trim()}
              className={cn(
                "w-full h-14 rounded-2xl font-black text-lg bg-white text-[#080a10]",
                "transition-transform active:scale-[0.97] hover:brightness-90",
                "disabled:opacity-30 disabled:active:scale-100"
              )}
            >
              {ar ? "دخول" : "Join"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Crypto Rush: boot + password + launch, one continuous terminal ──────
  // Picking a password never swaps to a fresh screen — it keeps appending to
  // the same scrolling log, auto-scrolled to the bottom as new lines arrive.
  if (stage === "boot" || stage === "launch") {
    return (
      <div className="fixed inset-0 font-mono overflow-hidden terminal-screen" style={{ color: CR.accent }}>
        <div className="scan-sweep" style={{ "--sweep-color": CR.accent } as React.CSSProperties} />
        <div className="pointer-events-none fixed inset-0 terminal-scanlines z-20" />
        <div className="pointer-events-none fixed inset-0 terminal-vignette z-20" />
        <div className="relative z-10 flex flex-col h-full p-6 md:p-16 py-12 scan-sweep-fade">
          <h1
            className="shrink-0 font-pixel text-center leading-[1.7] mb-4 text-3xl md:text-5xl font-black tracking-wider"
            style={{ filter: `drop-shadow(0 0 18px ${CR.accent}70)` }}
          >
            {ar ? "أهلاً أيها المخترق" : "WELCOME HACKER"}
          </h1>

          <div ref={logRef} className="flex-1 min-h-0 overflow-y-auto space-y-2 text-base md:text-xl">
            {boot.committed.map((l, i) => <div key={`b${i}`}>{l}</div>)}
            {boot.current && <div>{boot.current}<span className="animate-pulse">▌</span></div>}
            {chosen && (
              <div className="opacity-60">{ar ? `> كلمة المرور: ${chosen}` : `> password: ${chosen}`}</div>
            )}
            {launch.committed.map((l, i) => <div key={`l${i}`}>{l}</div>)}
            {launch.current && <div>{launch.current}<span className="animate-pulse">▌</span></div>}
            {stage === "launch" && launch.done && <div className="animate-pulse">▌</div>}
          </div>

          {stage === "boot" && showPasswords && (
            <div className="shrink-0 mt-8 flex flex-wrap gap-3">
              {passwordChoices.map(p => (
                <button
                  key={p}
                  onClick={() => { setChosen(p); setStage("launch"); }}
                  className="px-4 py-2 border-2 rounded text-sm md:text-base break-all transition-all active:scale-[0.96]"
                  style={{ borderColor: CR.accentBorder, color: CR.accent }}
                  onMouseEnter={e => (e.currentTarget.style.background = CR.accentDim)}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  [ {p} ]
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default Join;
