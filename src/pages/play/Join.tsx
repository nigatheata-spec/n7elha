import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import logoLight from "@/assets/logo-light.png";

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

// Crypto Rush terminal theme (used by boot + launch stages only)
const CR = { bg: "#06110d", accent: "#00ff88", accentDim: "#00ff8825", accentBorder: "#00ff8845" };

type Stage = "code" | "name" | "boot" | "launch";

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

  // Typewriter buffers
  const [bootLines, setBootLines]     = useState<string[]>([]);
  const [bootCurrent, setBootCurrent] = useState("");
  const [launchLines, setLaunchLines] = useState<string[]>([]);

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
    const urlCode = (params.get("code") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
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
    const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-1);
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
    const text = e.clipboardData.getData("text").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    if (!text) return;
    e.preventDefault();
    const next = ["", "", "", ""] as string[];
    for (let i = 0; i < 4; i++) next[i] = text[i] ?? "";
    setCells(next);
    cellRefs[Math.min(text.length, 3)].current?.focus();
  };

  // ── Crypto Rush: boot typewriter ──────────────────────────────
  const BOOT_LINES = ar
    ? ["> تم اكتشاف مستخدم جديد!", "> أهلاً بك في بوابة اختراق الطرفية", "> اختر كلمة مرور:"]
    : ["> New User Detected!", "> Welcome to the Terminal Hacking Portal", "> Please select a password:"];
  useEffect(() => {
    if (stage !== "boot") return;
    setBootLines([]); setBootCurrent("");
    let cancelled = false;
    let li = 0;
    (async () => {
      while (li < BOOT_LINES.length) {
        for (let i = 1; i <= BOOT_LINES[li].length; i++) {
          if (cancelled) return;
          setBootCurrent(BOOT_LINES[li].slice(0, i));
          await new Promise(r => setTimeout(r, 58));
        }
        if (cancelled) return;
        setBootLines(prev => [...prev, BOOT_LINES[li]]);
        setBootCurrent(""); li++;
        await new Promise(r => setTimeout(r, 408));
      }
    })();
    return () => { cancelled = true; };
  }, [stage]);
  const showPasswords = bootLines.length === BOOT_LINES.length;

  // ── Crypto Rush: launch sequence then navigate ────────────────
  const LAUNCH_LINES = ar
    ? ["> تم التحقق من الهوية", "> جارٍ تحميل برنامج تعدين الكريبتو...", ">", "> .......", "> .......", "> جارٍ الإطلاق..."]
    : ["> Authentication Complete", "> Loading Crypto Mining Software...", ">", "> .......", "> .......", "> Launching..."];
  useEffect(() => {
    if (stage !== "launch" || !session) return;
    setLaunchLines([]);
    let cancelled = false;
    const snap = { session, name, chosen };
    (async () => {
      for (const line of LAUNCH_LINES) {
        if (cancelled) return;
        setLaunchLines(prev => [...prev, line]);
        await new Promise(r => setTimeout(r, 1054));
      }
      if (cancelled) return;
      await doInsert(snap.session, snap.name, snap.chosen ?? "");
    })();
    return () => { cancelled = true; };
  }, [stage]);

  const doInsert = async (sess: any, playerName: string, password: string) => {
    try {
      const payload: any = { session_id: sess.id, name: playerName.trim(), password };
      if (sess.settings?.mode === "humansvszombies") {
        const { data: existing } = await supabase.from("game_students").select("team").eq("session_id", sess.id) as any;
        const humanCount  = (existing ?? []).filter((s: any) => s.team === "human").length;
        const zombieCount = (existing ?? []).filter((s: any) => s.team === "zombie").length;
        payload.team = humanCount === zombieCount ? (Math.random() < 0.5 ? "human" : "zombie")
          : humanCount < zombieCount ? "human" : "zombie";
      }
      const { data: student, error } = await supabase
        .from("game_students")
        .insert(payload)
        .select().single();
      if (error) throw error;
      localStorage.setItem(`hash_student_${sess.id}`, student.id);
      nav(`/play/${sess.id}`);
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
            <img src={logoLight} alt="n7elha" className="h-16 w-16 object-contain" />
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

          <p className="text-white/15 text-xs">{ar ? "الرمز مكوّن من 4 أحرف" : "The code is 4 characters"}</p>
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
            <img src={logoLight} alt="n7elha" className="h-16 w-16 object-contain" />
            <div className="text-white/30 text-sm tracking-wide">{ar ? "اسمك في اللعبة؟" : "What's your name?"}</div>
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

  // ── Crypto Rush: boot + password ─────────────────────────────
  if (stage === "boot") {
    return (
      <div className="fixed inset-0 font-mono overflow-y-auto terminal-screen" style={{ color: CR.accent }}>
        <div className="scan-sweep" style={{ "--sweep-color": CR.accent } as React.CSSProperties} />
        <div className="pointer-events-none fixed inset-0 terminal-scanlines" />
        <div className="pointer-events-none fixed inset-0 terminal-vignette" />
        <div className="relative p-6 md:p-16 py-12 min-h-full font-pixel scan-sweep-fade">
          <h1 className="text-3xl md:text-5xl font-black tracking-wider mb-8" style={{ filter: `drop-shadow(0 0 18px ${CR.accent}70)` }}>
            {ar ? "أهلاً أيها المخترق" : "WELCOME HACKER"}
          </h1>

          <div className="space-y-2 text-base md:text-xl">
            {bootLines.map((l, i) => <div key={i}>{l}</div>)}
            {bootCurrent && <div>{bootCurrent}<span className="animate-pulse">▌</span></div>}
          </div>

          {showPasswords && (
            <div className="mt-8 flex flex-wrap gap-3">
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

  // ── Crypto Rush: launch sequence ─────────────────────────────
  if (stage === "launch") {
    return (
      <div className="fixed inset-0 font-mono terminal-screen" style={{ color: CR.accent }}>
        <div className="scan-sweep" style={{ "--sweep-color": CR.accent } as React.CSSProperties} />
        <div className="pointer-events-none fixed inset-0 terminal-scanlines" />
        <div className="pointer-events-none fixed inset-0 terminal-vignette" />
        <div className="relative p-6 md:p-16 py-12 space-y-3 text-base md:text-xl font-pixel scan-sweep-fade">
          {launchLines.map((l, i) => <div key={i}>{l}</div>)}
          <div className="animate-pulse mt-2">▌</div>
        </div>
      </div>
    );
  }

  return null;
};

export default Join;
