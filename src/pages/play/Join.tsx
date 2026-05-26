import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Password pool (Crypto Rush only) ──────────────────────────────────────
const PASSWORD_POOL = [
  "FROSTY_PAY65", "FORTNITE", "sealYouLater32", "***everything_ok***", "daGOAT_13",
  "ghost_in_the_shell", "n30n_w0lf", "matrix_42", "shadow_byte", "quantum_leap",
  "z3r0_c00l", "midnight_owl", "vortex_99", "cyber_punk_77", "echo_phantom",
  "lazer_kid", "binary_ninja", "rogue_wave", "pixel_storm", "hyper_drive_8",
];

// ─── Mode themes ────────────────────────────────────────────────────────────
const MODES = {
  crypto_rush: {
    bg: "#06110d",
    accent: "#00ff88",
    accentDim: "#00ff8825",
    accentBorder: "#00ff8845",
    label: "Crypto Rush",
    tagline: "اخترق · اسرق · ابقَ في القمة",
    btnColor: "#000",
  },
  dodgeball: {
    bg: "#110609",
    accent: "#ff3d1f",
    accentDim: "#ff3d1f22",
    accentBorder: "#ff3d1f45",
    label: "Dodgeball",
    tagline: "أجب أو تُحذف",
    btnColor: "#fff",
  },
} as const;

type Mode = keyof typeof MODES;
type Stage = "code" | "reveal" | "name" | "boot" | "launch" | "arena";

// ─── Join ───────────────────────────────────────────────────────────────────
const Join = () => {
  const nav = useNavigate();
  const [params] = useSearchParams();

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

  // Typewriter buffers
  const [bootLines, setBootLines]     = useState<string[]>([]);
  const [bootCurrent, setBootCurrent] = useState("");
  const [launchLines, setLaunchLines] = useState<string[]>([]);

  const code   = cells.join("");
  const mode: Mode   = (session?.settings?.mode as Mode) ?? "crypto_rush";
  const theme  = MODES[mode] ?? MODES.crypto_rush;

  const passwordChoices = useMemo(
    () => [...PASSWORD_POOL].sort(() => Math.random() - 0.5).slice(0, 5),
    []
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
      toast.error("رمز غير صحيح");
      setCells(["", "", "", ""]);
      setTimeout(() => r0.current?.focus(), 50);
      return;
    }
    setSession(data);
    setStage("reveal");
    setTimeout(() => setStage("name"), 2000);
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
  const BOOT_LINES = [
    "> New User Detected!",
    "> Welcome to the Terminal Hacking Portal",
    "> Please select a password:",
  ];
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
          await new Promise(r => setTimeout(r, 34));
        }
        if (cancelled) return;
        setBootLines(prev => [...prev, BOOT_LINES[li]]);
        setBootCurrent(""); li++;
        await new Promise(r => setTimeout(r, 240));
      }
    })();
    return () => { cancelled = true; };
  }, [stage]);
  const showPasswords = bootLines.length === BOOT_LINES.length;

  // ── Crypto Rush: launch sequence then navigate ────────────────
  const LAUNCH_LINES = [
    "> Authentication Complete",
    "> Loading Crypto Mining Software...",
    ">",
    "> .......",
    "> .......",
    "> Launching...",
  ];
  useEffect(() => {
    if (stage !== "launch" || !session) return;
    setLaunchLines([]);
    let cancelled = false;
    const snap = { session, name, chosen };
    (async () => {
      for (const line of LAUNCH_LINES) {
        if (cancelled) return;
        setLaunchLines(prev => [...prev, line]);
        await new Promise(r => setTimeout(r, 620));
      }
      if (cancelled) return;
      await doInsert(snap.session, snap.name, snap.chosen ?? "");
    })();
    return () => { cancelled = true; };
  }, [stage]);

  // ── Dodgeball: brief arena entry then navigate ────────────────
  useEffect(() => {
    if (stage !== "arena" || !session) return;
    const snap = { session, name };
    const t = setTimeout(async () => {
      await doInsert(snap.session, snap.name, "");
    }, 2400);
    return () => clearTimeout(t);
  }, [stage]);

  const doInsert = async (sess: any, playerName: string, password: string) => {
    try {
      const { data: student, error } = await supabase
        .from("game_students")
        .insert({ session_id: sess.id, name: playerName.trim(), password })
        .select().single();
      if (error) throw error;
      localStorage.setItem(`hash_student_${sess.id}`, student.id);
      nav(`/play/${sess.id}`);
    } catch (err: any) {
      toast.error(err.message || "تعذّر الانضمام");
      setStage("name");
    }
  };

  const submitName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (mode === "crypto_rush") setStage("boot");
    else setStage("arena");
  };

  // ════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════

  // ── Code entry (mode-agnostic) ────────────────────────────────
  if (stage === "code") {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center p-6 overflow-hidden"
        style={{ background: "radial-gradient(ellipse at 50% 35%, #141928 0%, #080a10 70%)" }}
      >
        {/* subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative z-10 w-full max-w-xs text-center space-y-12 animate-fade-up">
          {/* Brand */}
          <div className="space-y-1.5">
            <div className="text-5xl font-black text-white tracking-tight">n7elha</div>
            <div className="text-white/30 text-sm tracking-wide">أدخل رمز اللعبة</div>
          </div>

          {/* 4-box code input */}
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
                  inputMode="text"
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
                جارٍ التحقق...
              </p>
            )}
          </div>

          <p className="text-white/15 text-xs">الرمز مكوّن من 4 أحرف</p>
        </div>
      </div>
    );
  }

  // ── Mode reveal splash (2s) ───────────────────────────────────
  if (stage === "reveal") {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center"
        style={{ background: theme.bg }}
      >
        <div className="text-center space-y-5 animate-fade-up">
          <div
            className="text-[clamp(4rem,15vw,8rem)] font-black text-white leading-none tracking-tight"
          >
            {theme.label}
          </div>
          <div
            className="font-mono text-base tracking-widest"
            style={{ color: theme.accent }}
          >
            {theme.tagline}
          </div>
        </div>
      </div>
    );
  }

  // ── Name entry (mode-themed) ──────────────────────────────────
  if (stage === "name") {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center p-6"
        style={{ background: theme.bg }}
      >
        <div className="w-full max-w-sm space-y-8 animate-fade-up">
          <div className="space-y-1">
            <div
              className="text-xs font-mono tracking-[0.2em] uppercase"
              style={{ color: theme.accent }}
            >
              {theme.label}
            </div>
            <h1 className="text-4xl font-black text-white">اسمك في اللعبة؟</h1>
          </div>

          <form onSubmit={submitName} className="space-y-4">
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={24}
              placeholder="اسم اللاعب..."
              className="w-full h-14 px-4 text-lg font-bold rounded-2xl text-white
                         bg-white/[0.07] border-2 focus:outline-none
                         placeholder:text-white/20 transition-colors duration-150"
              style={{ borderColor: theme.accentBorder }}
              onFocus={e => (e.target.style.borderColor = theme.accent)}
              onBlur={e => (e.target.style.borderColor = theme.accentBorder)}
            />
            <button
              type="submit"
              className="w-full h-14 rounded-2xl font-black text-lg
                         transition-transform active:scale-[0.97] hover:brightness-110"
              style={{ background: theme.accent, color: theme.btnColor }}
            >
              دخول
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Crypto Rush: boot + password ─────────────────────────────
  if (stage === "boot") {
    const cr = MODES.crypto_rush;
    return (
      <div
        className="fixed inset-0 font-mono overflow-y-auto"
        style={{ background: cr.bg, color: cr.accent }}
      >
        <div className="pointer-events-none fixed inset-0 terminal-scanlines opacity-[0.18]" />
        <div className="relative p-6 md:p-16 py-12 min-h-full">
          <h1
            className="text-3xl md:text-5xl font-black tracking-wider mb-8"
            style={{ filter: `drop-shadow(0 0 18px ${cr.accent}70)` }}
          >
            WELCOME HACKER
          </h1>

          <div className="space-y-2 text-base md:text-xl">
            {bootLines.map((l, i) => <div key={i}>{l}</div>)}
            {bootCurrent && (
              <div>
                {bootCurrent}<span className="animate-pulse">▌</span>
              </div>
            )}
          </div>

          {showPasswords && (
            <div className="mt-8 flex flex-wrap gap-3">
              {passwordChoices.map(p => (
                <button
                  key={p}
                  onClick={() => { setChosen(p); setStage("launch"); }}
                  className="px-4 py-2 border-2 rounded text-sm md:text-base break-all
                             transition-all active:scale-[0.96]"
                  style={{
                    borderColor: cr.accentBorder,
                    color: cr.accent,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = cr.accentDim)}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  {p}
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
    const cr = MODES.crypto_rush;
    return (
      <div
        className="fixed inset-0 font-mono p-6 md:p-16 py-12"
        style={{ background: cr.bg, color: cr.accent }}
      >
        <div className="pointer-events-none fixed inset-0 terminal-scanlines opacity-[0.18]" />
        <div className="relative space-y-3 text-base md:text-xl">
          {launchLines.map((l, i) => <div key={i}>{l}</div>)}
          <div className="animate-pulse mt-2">▌</div>
        </div>
      </div>
    );
  }

  // ── Dodgeball: arena entry ────────────────────────────────────
  if (stage === "arena") {
    const db = MODES.dodgeball;
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden"
        style={{ background: db.bg }}
      >
        {/* pulsing rings */}
        <div
          className="absolute w-[28rem] h-[28rem] rounded-full animate-ping"
          style={{ border: `2px solid ${db.accent}30` }}
        />
        <div
          className="absolute w-72 h-72 rounded-full"
          style={{ border: `2px solid ${db.accent}50` }}
        />
        <div
          className="absolute w-40 h-40 rounded-full"
          style={{ border: `3px solid ${db.accent}70` }}
        />

        <div className="relative text-center space-y-5 animate-fade-up z-10">
          <div className="text-6xl md:text-7xl font-black text-white">{name}</div>
          <div
            className="font-mono text-sm tracking-widest animate-pulse"
            style={{ color: db.accent }}
          >
            {"> الدخول إلى الملعب..."}
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default Join;
