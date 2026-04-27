import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Coins } from "lucide-react";

const fmt = (n: number) => n.toLocaleString();

/**
 * Pick a random target weighted by rank.
 * Higher-ranked (more crypto) students are 10% more likely to be picked
 * than the rest — nothing crazy, just a small bonus.
 */
function pickWeightedTarget(students: any[]) {
  if (students.length === 0) return null;
  const sorted = [...students].sort((a, b) => (b.crypto || 0) - (a.crypto || 0));
  const top = Math.max(1, Math.ceil(sorted.length * 0.2)); // top 20% = the "high rank"
  const weights = sorted.map((_, i) => (i < top ? 1.1 : 1));
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < sorted.length; i++) {
    r -= weights[i];
    if (r <= 0) return sorted[i];
  }
  return sorted[0];
}

export const HackingFlow = ({
  me, students, sessionId, onDone,
}: {
  me: any; students: any[]; sessionId: string; onDone: () => void;
  passwords?: string[]; // unused now — passwords come from real students
}) => {
  const [target, setTarget] = useState<any | null>(null);
  const [phase, setPhase] = useState<"intro" | "guess" | "result">("intro");
  const [result, setResult] = useState<{ ok: boolean; transferred: number } | null>(null);

  // Pick a random target once on mount. Phase change is separate so React's
  // cleanup does not cancel the timer when target state updates.
  useEffect(() => {
    if (target || students.length === 0) return;
    setTarget(pickWeightedTarget(students));
  }, [students, target]);

  useEffect(() => {
    if (!target || phase !== "intro") return;
    const t = setTimeout(() => setPhase("guess"), 900);
    return () => clearTimeout(t);
  }, [target, phase]);

  // Build 5 password choices: real one is ALWAYS included + 4 decoys from other students.
  const choices = useMemo(() => {
    if (!target) return [] as string[];
    const real = (target.password as string) || "ghost_byte";
    const otherPwds = students
      .filter(s => s.id !== target.id && s.password)
      .map(s => s.password as string)
      .filter(p => p !== real);
    const unique = Array.from(new Set(otherPwds));
    const decoys = unique.sort(() => Math.random() - 0.5).slice(0, 4);
    const fillers = ["null_route", "0xDEAD", "admin_root", "guest_42", "no_signal", "root_kit", "byte_me"];
    while (decoys.length < 4) {
      const fake = fillers[decoys.length % fillers.length];
      if (!decoys.includes(fake) && fake !== real) decoys.push(fake);
      else fillers.push(fake + "_" + decoys.length);
    }
    return [real, ...decoys].sort(() => Math.random() - 0.5);
  }, [target, students]);

  const tryPwd = async (pwd: string) => {
    if (!target) return;
    const ok = pwd === target.password;
    // steal 30-70% on success
    const pct = 0.3 + Math.random() * 0.4;
    const transferred = ok ? Math.floor((target.crypto || 0) * pct) : 0;
    setResult({ ok, transferred });
    setPhase("result");
    await supabase.from("hack_events").insert({
      session_id: sessionId, hacker_id: me.id, target_id: target.id,
      password_attempted: pwd, success: ok, crypto_transferred: transferred,
    });
    if (ok && transferred > 0) {
      await supabase.from("game_students").update({
        crypto: Math.max(0, (target.crypto || 0) - transferred),
        is_breached: true,
        hacks_received: (target.hacks_received || 0) + 1,
      }).eq("id", target.id);
      await supabase.from("game_students").update({
        crypto: (me.crypto || 0) + transferred,
        hacks_made: (me.hacks_made || 0) + 1,
      }).eq("id", me.id);
    }
    setTimeout(onDone, 2400);
  };

  if (students.length === 0) {
    return (
      <div className="min-h-[calc(100dvh-56px)] pt-8 font-mono text-primary">
        <div className="text-lg md:text-2xl font-black">لا يوجد هدف متاح</div>
        <div className="mt-3 text-sm text-muted-foreground">&gt; انتظر دخول لاعب آخر للنظام</div>
        <button onClick={onDone} className="mt-8 border border-primary/70 px-4 py-2 text-sm text-primary hover:bg-primary/15">
          رجوع
        </button>
      </div>
    );
  }

  if (phase === "intro" || !target) {
    return (
      <div className="min-h-[calc(100dvh-56px)] pt-8 font-mono text-primary">
        <div className="text-sm text-muted-foreground">&gt; اختيار هدف عشوائي...</div>
        <div className="mt-3 text-3xl md:text-5xl font-black text-primary text-glow-cyan animate-pulse">
          {target ? target.name : "..."}
        </div>
      </div>
    );
  }

  if (phase === "result" && result) {
    return (
      <div className="text-center py-16 font-mono">
        {result.ok ? (
          <>
            <div className="text-3xl text-success animate-pulse">✓ تم الاختراق</div>
            <div className="mt-3 text-lg text-muted-foreground">الهدف: {target.name}</div>
            <div className="mt-4 text-3xl" style={{ color: "hsl(51 100% 50%)" }}>
              +{fmt(result.transferred)} <Coins className="inline h-6 w-6" />
            </div>
          </>
        ) : (
          <>
            <div className="text-3xl text-destructive animate-pulse">✗ فشل الاختراق</div>
            <div className="mt-3 text-lg text-muted-foreground">كلمة المرور خاطئة</div>
          </>
        )}
      </div>
    );
  }

  // guess phase
  return (
    <div className="min-h-[calc(100dvh-56px)] pt-5 md:pt-8 font-mono text-primary">
      <div className="mb-6">
        <div className="text-2xl md:text-4xl font-black text-primary text-glow-cyan">HACKING {target.name}</div>
        <div className="text-sm mt-1" style={{ color: "hsl(51 100% 50%)" }}>
          الرصيد: {fmt(target.crypto || 0)}
        </div>
        <div className="mt-4 text-sm md:text-base text-muted-foreground">
          {"> اختر كلمة المرور الصحيحة"}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 md:gap-4">
        {choices.map(p => (
          <button
            key={p}
            onClick={() => tryPwd(p)}
            className={cn(
              "px-3 py-2 md:px-4 md:py-3 border-2 text-left text-sm md:text-base transition-all break-all",
              "border-primary/70 text-primary bg-primary/10 shadow-[inset_0_0_10px_hsl(var(--primary)/0.18)]",
              "hover:bg-primary/25 hover:shadow-[0_0_18px_hsl(var(--primary)/0.5)]"
            )}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="mt-6 text-center">
        <Button variant="ghost" onClick={onDone} className="text-muted-foreground">تخطي</Button>
      </div>
    </div>
  );
};
