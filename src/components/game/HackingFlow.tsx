import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Coins } from "lucide-react";

const fmt = (n: number) => n.toLocaleString();

const TEAL = "#3F5A63";
const GOLD = "#C8783A";
const GREEN = "#3a9e6e";
const RED = "#dc2626";

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
  me, students, sessionId, onDone, ar,
}: {
  me: any; students: any[]; sessionId: string; onDone: () => void; ar?: boolean;
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
      <div className="max-w-md mx-auto py-10 px-2 text-center">
        <div className="text-xl font-bold" style={{ color: TEAL }}>{ar ? "لا يوجد هدف متاح" : "No target available"}</div>
        <div className="mt-2 text-sm text-black/50">{ar ? "بانتظار دخول لاعب آخر" : "Waiting for another player to join..."}</div>
        <button
          onClick={onDone}
          className="mt-6 rounded-full border-2 border-[hsl(var(--nb-border))] bg-white px-5 py-2 text-sm font-semibold shadow-[2px_2px_0_0_hsl(var(--nb-border))] hover:translate-x-px hover:translate-y-px hover:shadow-[1px_1px_0_0_hsl(var(--nb-border))] transition-all"
          style={{ color: TEAL }}
        >
          {ar ? "رجوع" : "Back"}
        </button>
      </div>
    );
  }

  if (phase === "intro" || !target) {
    return (
      <div className="max-w-md mx-auto py-10 px-2 text-center">
        <div className="text-sm text-black/45">{ar ? "اختيار هدف عشوائي..." : "Picking a random target..."}</div>
        <div className="mt-3 text-3xl md:text-4xl font-bold animate-pulse" style={{ color: TEAL }}>
          {target ? target.name : "..."}
        </div>
      </div>
    );
  }

  if (phase === "result" && result) {
    return (
      <div className="max-w-md mx-auto text-center py-14 px-2">
        {result.ok ? (
          <>
            <div className="text-2xl font-bold" style={{ color: GREEN }}>{ar ? "تم الاختراق!" : "Breach successful!"}</div>
            <div className="mt-2 text-sm text-black/50">{ar ? "الهدف:" : "Target:"} {target.name}</div>
            <div className="mt-4 flex items-center justify-center gap-1.5 text-2xl font-bold" style={{ color: GOLD }}>
              <Coins className="h-6 w-6" />
              +{fmt(result.transferred)}
            </div>
          </>
        ) : (
          <>
            <div className="text-2xl font-bold" style={{ color: RED }}>{ar ? "فشل الاختراق" : "Breach failed"}</div>
            <div className="mt-2 text-sm text-black/50">{ar ? "كلمة المرور خاطئة" : "Wrong password"}</div>
          </>
        )}
      </div>
    );
  }

  // guess phase
  return (
    <div className="max-w-xl mx-auto py-6 md:py-8 px-2">
      <div className="mb-6 text-center">
        <div className="text-xl md:text-2xl font-bold" style={{ color: TEAL, fontFamily: "'ArslanWessam', 'Almarai', sans-serif" }}>
          {ar ? `اختراق ${target.name}` : `Hacking ${target.name}`}
        </div>
        <div className="text-sm mt-1 font-semibold" style={{ color: GOLD }}>
          {ar ? "الرصيد:" : "Balance:"} {fmt(target.crypto || 0)}
        </div>
        <div className="mt-4 text-sm text-black/45">
          {ar ? "اختر كلمة المرور الصحيحة" : "Choose the correct password"}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {choices.map(p => (
          <button
            key={p}
            onClick={() => tryPwd(p)}
            className="rounded-xl border-2 border-[hsl(var(--nb-border))] bg-white px-4 py-2.5 text-sm md:text-base font-medium shadow-[2px_2px_0_0_hsl(var(--nb-border))] hover:translate-x-px hover:translate-y-px hover:shadow-[1px_1px_0_0_hsl(var(--nb-border))] transition-all break-all"
            style={{ color: TEAL }}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="mt-6 text-center">
        <button onClick={onDone} className="text-sm font-medium text-black/40 hover:text-black/60 transition-colors">
          {ar ? "تخطي" : "Skip"}
        </button>
      </div>
    </div>
  );
};
