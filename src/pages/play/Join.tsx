import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Big pool — 5 are sampled per student. Each picks one as THEIR password.
// The same pool is also used for hack guesses, so the real one will appear.
const PASSWORD_POOL = [
  "FROSTY_PAY65", "FORTNITE", "sealYouLater32", "***everything_ok***", "daGOAT_13",
  "ghost_in_the_shell", "n30n_w0lf", "matrix_42", "shadow_byte", "quantum_leap",
  "z3r0_c00l", "midnight_owl", "vortex_99", "cyber_punk_77", "echo_phantom",
  "lazer_kid", "binary_ninja", "rogue_wave", "pixel_storm", "hyper_drive_8",
];

const STEPS = [
  { text: "> New User Detected!", delay: 36 },
  { text: "> Welcome to the Terminal Hacking Portal", delay: 36 },
  { text: "> Please select a password:", delay: 36 },
];

const Join = () => {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [stage, setStage] = useState<"code" | "name" | "boot" | "password" | "launch">("code");
  const [code, setCode] = useState((params.get("code") || "").toUpperCase());
  const [name, setName] = useState("");
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // typed lines for the terminal
  const [lines, setLines] = useState<string[]>([]);
  const [typing, setTyping] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [launchLines, setLaunchLines] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pick 5 random password options for this student (stable per mount)
  const passwordChoices = useMemo(
    () => [...PASSWORD_POOL].sort(() => Math.random() - 0.5).slice(0, 5),
    []
  );

  // ── Step 1: validate code
  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c.length !== 4) { toast.error("الرمز يجب أن يكون 4 أحرف"); return; }
    setLoading(true);
    const { data, error } = await supabase.from("game_sessions")
      .select("*").eq("code", c).in("status", ["lobby", "running"]).maybeSingle();
    setLoading(false);
    if (error || !data) { toast.error("الرمز غير صحيح"); return; }
    setSession(data);
    setStage("name");
  };

  // ── Step 2: enter name
  const submitName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("أدخل اسمك"); return; }
    setStage("boot");
  };

  // ── Step 3: terminal boot animation
  useEffect(() => {
    if (stage !== "boot") return;
    let cancelled = false;
    let stepIdx = 0;
    const runStep = async () => {
      if (cancelled || stepIdx >= STEPS.length) {
        if (!cancelled) setShowPasswords(true);
        return;
      }
      const { text, delay } = STEPS[stepIdx];
      for (let i = 1; i <= text.length; i++) {
        if (cancelled) return;
        setTyping(text.slice(0, i));
        await new Promise(r => setTimeout(r, delay));
      }
      if (cancelled) return;
      setLines(prev => [...prev, text]);
      setTyping("");
      stepIdx++;
      await new Promise(r => setTimeout(r, 250));
      runStep();
    };
    runStep();
    return () => { cancelled = true; };
  }, [stage]);

  // ── Step 4: launch sequence after picking password
  useEffect(() => {
    if (stage !== "launch" || !chosen || !session) return;
    let cancelled = false;
    const seq = [
      "> Authentication Complete",
      "> Loading Crypto Mining Software...",
      ">",
      "> .......",
      "> .......",
      "> .......",
      ">",
      "> Launching...",
    ];
    (async () => {
      for (const ln of seq) {
        if (cancelled) return;
        setLaunchLines(prev => [...prev, ln]);
        await new Promise(r => setTimeout(r, 640));
      }
      if (cancelled) return;
      // Insert student record now
      try {
        const { data: student, error } = await supabase.from("game_students")
          .insert({ session_id: session.id, name: name.trim(), password: chosen })
          .select().single();
        if (error) throw error;
        localStorage.setItem(`hash_student_${session.id}`, student.id);
        await new Promise(r => setTimeout(r, 600));
        nav(`/play/${session.id}`);
      } catch (err: any) {
        toast.error(err.message || "تعذّر الانضمام");
        setStage("password");
      }
    })();
    return () => { cancelled = true; };
  }, [stage, chosen, session, name, nav]);

  // auto-scroll terminal
  useEffect(() => {
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: "smooth" });
  }, [lines, typing, launchLines]);

  // ── UI
  if (stage === "code" || stage === "name") {
    return (
      <div className="theme-game min-h-screen bg-background text-foreground bg-grid flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="font-mono text-4xl font-black text-primary text-glow-cyan">HASH</div>
            <p className="text-muted-foreground mt-1 font-mono text-xs">{"> ENTER ACCESS CODE"}</p>
          </div>
          {stage === "code" ? (
            <form onSubmit={submitCode} className="space-y-4 border-glow rounded-2xl p-6 bg-card/60 backdrop-blur">
              <label className="text-xs font-mono text-muted-foreground">GAME_CODE</label>
              <Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={4}
                className="font-mono text-3xl text-center tracking-[0.5em] bg-background/60 border-primary/40 h-16 text-primary" />
              <Button type="submit" disabled={loading}
                className="w-full h-12 bg-primary text-primary-foreground font-mono font-bold tracking-wider">
                {loading ? "..." : "> CONNECT"}
              </Button>
            </form>
          ) : (
            <form onSubmit={submitName} className="space-y-4 border-glow rounded-2xl p-6 bg-card/60 backdrop-blur">
              <label className="text-xs font-mono text-muted-foreground">USERNAME</label>
              <Input value={name} onChange={e => setName(e.target.value)} maxLength={24} autoFocus
                className="font-mono bg-background/60 border-primary/40 h-12" placeholder="hacker_01" />
              <Button type="submit"
                className="w-full h-12 bg-primary text-primary-foreground font-mono font-bold tracking-wider">
                {"> ENTER TERMINAL"}
              </Button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Terminal — full-screen, no window chrome
  return (
    <div
      ref={containerRef}
      className="theme-game fixed inset-0 overflow-y-auto font-mono text-[hsl(120_100%_55%)]"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at center, rgba(0,80,0,0.55) 0%, rgba(0,30,0,0.95) 75%, rgba(0,15,0,1) 100%)",
      }}
    >
      {/* scanlines */}
      <div
        className="pointer-events-none fixed inset-0 opacity-20"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.35) 0px, rgba(0,0,0,0.35) 1px, transparent 1px, transparent 3px)",
        }}
      />

      <div className="relative min-h-full px-5 md:px-16 py-8 md:py-16">
        <h1 className="text-2xl md:text-6xl font-black tracking-wider mb-6 md:mb-8 drop-shadow-[0_0_12px_rgba(0,255,80,0.6)]">
          WELCOME HACKER
        </h1>

        {/* typed lines */}
        <div className="space-y-2 text-base md:text-2xl leading-relaxed">
          {lines.map((l, i) => <div key={i}>{l}</div>)}
          {typing && <div>{typing}<span className="animate-pulse">▌</span></div>}
        </div>

        {/* password chips */}
        {showPasswords && stage !== "launch" && (
          <div className="mt-6 md:mt-8 flex flex-wrap gap-2 md:gap-4 text-sm md:text-lg">
            {passwordChoices.map(p => {
              const selected = chosen === p;
              return (
                <button
                  key={p}
                  onClick={() => { setChosen(p); setStage("launch"); }}
                  disabled={!!chosen}
                  className={cn(
                    "px-3 py-2 md:px-4 border-2 rounded-sm transition-all break-all",
                    "border-[hsl(120_100%_45%)] text-[hsl(120_100%_70%)]",
                    "hover:bg-[hsl(120_100%_45%)]/20 hover:shadow-[0_0_18px_rgba(0,255,80,0.45)]",
                    selected && "bg-[hsl(120_100%_45%)]/30 shadow-[0_0_24px_rgba(0,255,80,0.7)]",
                    chosen && !selected && "opacity-30",
                  )}
                >
                  {p}
                </button>
              );
            })}
          </div>
        )}

        {/* launch sequence */}
        {stage === "launch" && (
          <div className="mt-6 space-y-2 text-base md:text-2xl">
            {launchLines.map((l, i) => <div key={i}>{l}</div>)}
            <div className="opacity-70 mt-2">▌</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Join;
