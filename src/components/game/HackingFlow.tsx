import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Skull, Shield, Coins } from "lucide-react";

const fmt = (n: number) => n.toLocaleString();

export const HackingFlow = ({ me, students, sessionId, onDone, passwords }: {
  me: any; students: any[]; sessionId: string; onDone: () => void; passwords: string[];
}) => {
  const [target, setTarget] = useState<any | null>(null);
  const [phase, setPhase] = useState<"select"|"password"|"result">("select");
  const [result, setResult] = useState<{ ok: boolean; transferred: number } | null>(null);

  const choices = useMemo(() => {
    if (!target) return [] as string[];
    const real = target.password as string;
    const pool = passwords.filter(p => p !== real);
    const decoys = pool.sort(() => Math.random() - 0.5).slice(0, 3);
    return [real, ...decoys].sort(() => Math.random() - 0.5);
  }, [target, passwords]);

  const tryPwd = async (pwd: string) => {
    const ok = pwd === target.password;
    const transferred = ok ? Math.floor(target.crypto * 0.25) : 0;
    setResult({ ok, transferred });
    setPhase("result");
    await supabase.from("hack_events").insert({
      session_id: sessionId, hacker_id: me.id, target_id: target.id,
      password_attempted: pwd, success: ok, crypto_transferred: transferred,
    });
    if (ok) {
      await supabase.from("game_students").update({ crypto: target.crypto - transferred, is_breached: true, hacks_received: (target.hacks_received||0)+1 }).eq("id", target.id);
      await supabase.from("game_students").update({ crypto: me.crypto + transferred, hacks_made: (me.hacks_made||0)+1 }).eq("id", me.id);
    }
    setTimeout(onDone, 2200);
  };

  if (phase === "result" && result) {
    return (
      <div className="text-center py-16">
        {result.ok ? (
          <>
            <div className="font-mono text-3xl text-success animate-pulse">✓ ACCESS_GRANTED</div>
            <div className="mt-4 font-mono text-2xl" style={{color:"hsl(51 100% 50%)"}}>
              +{fmt(result.transferred)} <Coins className="inline h-5 w-5" />
            </div>
          </>
        ) : (
          <div className="font-mono text-3xl text-destructive animate-pulse">✗ ACCESS_DENIED</div>
        )}
      </div>
    );
  }

  if (phase === "password" && target) {
    return (
      <div className="py-6 max-w-xl mx-auto">
        <div className="text-center mb-6">
          <Skull className="h-14 w-14 mx-auto text-destructive" />
          <div className="font-mono text-xs text-muted-foreground mt-2">BRUTEFORCING</div>
          <div className="font-mono text-2xl text-primary text-glow-cyan">{target.name}</div>
          <div className="font-mono text-sm" style={{color:"hsl(51 100% 50%)"}}>{fmt(target.crypto)}</div>
        </div>
        <div className="space-y-2">
          {choices.map(p => (
            <button key={p} onClick={() => tryPwd(p)}
              className="w-full font-mono text-left px-4 py-3 rounded-lg border-2 border-primary/40 bg-card/40 hover:border-primary hover:bg-primary/10">
              {">"} {p}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="py-2">
      <div className="text-center mb-4">
        <Skull className="h-10 w-10 mx-auto text-destructive" />
        <div className="font-mono text-lg text-destructive mt-1">SELECT_TARGET</div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[60vh] overflow-auto">
        {students.map(s => (
          <button key={s.id} onClick={() => setTarget(s)}
            className={cn("p-3 rounded-xl border-2 text-center transition-all",
              target?.id === s.id ? "border-primary bg-primary/15 shadow-glow" : "border-primary/30 bg-card/40 hover:border-primary/70")}>
            <div className="font-mono text-sm truncate">{s.name}</div>
            <div className="font-mono text-xs mt-1" style={{color:"hsl(51 100% 50%)"}}>{fmt(s.crypto)}</div>
          </button>
        ))}
      </div>
      <div className="mt-4 flex gap-2 justify-center">
        <Button variant="outline" onClick={onDone}>إلغاء</Button>
        <Button disabled={!target} onClick={() => setPhase("password")} className="bg-primary text-primary-foreground">
          <Shield className="h-4 w-4 me-2" /> CONFIRM
        </Button>
      </div>
    </div>
  );
};
