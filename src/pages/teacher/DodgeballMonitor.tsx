import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Heart, Skull, Trophy, Timer, Square, Maximize, Zap } from "lucide-react";

// Monster avatars (same as GameMonitor)
const AVATARS = ["👾","🐱","🐶","🐼","🦊","🐸","🐵","🦁","🐯","🐰","🐻","🐨","🐷","🐮","🦄","🐲","🦉","🐺","🐙","🦝"];
const avatarFor = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATARS[Math.abs(h) % AVATARS.length];
};

interface Props { session: any; sessionId: string; }

const TIMER_MAX_MS = 15_000; // auto-end timer after 15s

const DodgeballMonitor = ({ session, sessionId }: Props) => {
  const nav = useNavigate();
  const [students, setStudents] = useState<any[]>([]);
  const [taps, setTaps] = useState<any[]>([]);
  const [timerMs, setTimerMs] = useState(0);
  const [ending, setEnding] = useState(false);
  const timerRafRef = useRef<number | null>(null);
  const timerStartRef = useRef<number>(0);

  const settings = session?.settings || {};
  const timerActive: boolean = settings.timerActive ?? false;
  const timerRoundId: string | null = settings.timerRoundId ?? null;
  const timerWinnerId: string | null = settings.timerWinnerId ?? null;

  // Load + subscribe
  useEffect(() => {
    if (!sessionId) return;
    const refresh = async () => {
      const [{ data: ss }, { data: ts }] = await Promise.all([
        supabase.from("game_students").select("*").eq("session_id", sessionId).order("name"),
        timerRoundId
          ? supabase.from("dodgeball_timer_taps").select("*").eq("session_id", sessionId).eq("timer_round_id", timerRoundId).order("elapsed_ms")
          : Promise.resolve({ data: [] }),
      ]);
      setStudents(ss ?? []);
      setTaps((ts as any)?.data ?? ts ?? []);
    };
    refresh();
    const ch = supabase.channel(`db-monitor-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_students", filter: `session_id=eq.${sessionId}` }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dodgeball_timer_taps", filter: `session_id=eq.${sessionId}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, timerRoundId]);

  // Refresh taps when timer round changes
  useEffect(() => {
    if (!timerRoundId) { setTaps([]); return; }
    supabase.from("dodgeball_timer_taps").select("*").eq("session_id", sessionId).eq("timer_round_id", timerRoundId).order("elapsed_ms")
      .then(({ data }) => setTaps(data ?? []));
  }, [timerRoundId, sessionId]);

  // Live timer RAF
  useEffect(() => {
    if (timerActive && settings.timerStartedAt) {
      timerStartRef.current = new Date(settings.timerStartedAt).getTime();
      const tick = () => {
        const elapsed = Date.now() - timerStartRef.current;
        setTimerMs(elapsed);
        if (elapsed < TIMER_MAX_MS) {
          timerRafRef.current = requestAnimationFrame(tick);
        } else {
          // Auto-end the timer
          endTimer();
        }
      };
      timerRafRef.current = requestAnimationFrame(tick);
      return () => { if (timerRafRef.current) cancelAnimationFrame(timerRafRef.current); };
    } else {
      if (timerRafRef.current) cancelAnimationFrame(timerRafRef.current);
      setTimerMs(0);
    }
  }, [timerActive, settings.timerStartedAt]);

  // Auto-end game when only 1 alive
  useEffect(() => {
    const alive = students.filter(s => !s.eliminated);
    if (alive.length === 1 && students.length > 1 && session?.status === "running" && !ending) {
      setEnding(true);
      supabase.from("game_sessions").update({ status: "finished", ended_at: new Date().toISOString() }).eq("id", sessionId);
    }
  }, [students, session, ending, sessionId]);

  // Fire timer
  const fireTimer = async () => {
    if (timerActive) return;
    const roundId = `round-${Date.now()}`;
    await supabase.from("game_sessions").update({
      settings: {
        ...settings,
        timerActive: true,
        timerRoundId: roundId,
        timerStartedAt: new Date().toISOString(),
        timerWinnerId: null,
      }
    }).eq("id", sessionId);
  };

  // End timer + find winner
  const endTimer = async () => {
    if (!timerActive) return;
    if (timerRafRef.current) cancelAnimationFrame(timerRafRef.current);

    // Fetch latest taps
    const { data: latestTaps } = await supabase
      .from("dodgeball_timer_taps")
      .select("*")
      .eq("session_id", sessionId)
      .eq("timer_round_id", timerRoundId ?? "")
      .order("elapsed_ms");

    const TARGET_MS = 10_000;
    let winnerId: string | null = null;

    if (latestTaps && latestTaps.length > 0) {
      const best = latestTaps.reduce((prev, cur) =>
        Math.abs(cur.elapsed_ms - TARGET_MS) < Math.abs(prev.elapsed_ms - TARGET_MS) ? cur : prev
      );
      winnerId = best.student_id;
      // Give winner a life
      const winner = students.find(s => s.id === winnerId);
      if (winner) {
        await supabase.from("game_students").update({ lives: (winner.lives ?? 1) + 1 }).eq("id", winnerId);
      }
    }

    await supabase.from("game_sessions").update({
      settings: {
        ...settings,
        timerActive: false,
        timerRoundId: timerRoundId,
        timerStartedAt: null,
        timerWinnerId: winnerId,
      }
    }).eq("id", sessionId);
  };

  const endGame = async () => {
    if (!confirm("End the game now?")) return;
    await supabase.from("game_sessions").update({ status: "finished", ended_at: new Date().toISOString() }).eq("id", sessionId);
    nav(`/app/games/${sessionId}/results`);
  };

  const goFullscreen = () => {
    const el = document.documentElement as any;
    (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  };

  const alive = students.filter(s => !s.eliminated);
  const eliminated = students.filter(s => s.eliminated);
  const finalRound = alive.length <= 3 && students.length > 1;
  const canFireTimer = !timerActive && alive.length > 3;

  // Timer display
  const timerSec = (timerMs / 1000).toFixed(2);
  const winnerName = timerWinnerId ? students.find(s => s.id === timerWinnerId)?.name : null;

  return (
    <div className="theme-dodgeball fixed inset-0 bg-background text-foreground overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 30% 20%, hsl(0 40% 12%) 0%, hsl(0 45% 8%) 100%)" }}>

      {/* Scanlines overlay */}
      <div className="pointer-events-none fixed inset-0 opacity-10"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, hsl(0 0% 0% / 0.5) 0px, hsl(0 0% 0% / 0.5) 1px, transparent 1px, transparent 4px)" }} />

      {/* Top bar */}
      <div className="absolute top-3 inset-x-3 z-20 flex items-center justify-between font-mono text-xs gap-3">
        <div className="text-muted-foreground">
          CODE <span className="text-primary text-base font-black tracking-widest">{session.code}</span>
        </div>
        {finalRound && (
          <div className="text-primary font-black text-lg animate-pulse tracking-widest">
            ⚠ FINAL ROUND
          </div>
        )}
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={goFullscreen} className="text-primary hover:text-primary hover:bg-primary/10">
            <Maximize className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={endGame} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-mono font-bold">
            <Square className="h-4 w-4 me-1" />END
          </Button>
        </div>
      </div>

      <div className="h-full grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 p-4 pt-14">

        {/* PLAYER GRID */}
        <div className="overflow-y-auto">
          {students.length === 0 ? (
            <div className="flex items-center justify-center h-full font-mono text-2xl text-primary animate-pulse">
              {"> WAITING FOR PLAYERS..."}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {/* Alive first */}
              {alive.map(s => (
                <div key={s.id} className={cn(
                  "rounded-xl border-2 p-3 flex flex-col gap-1 transition-all",
                  "border-primary/50 bg-primary/8",
                  s.lives >= 2 && "border-primary bg-primary/15 shadow-[0_0_20px_-5px_hsl(9_100%_58%/0.5)]"
                )}>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{avatarFor(s.name)}</span>
                    <span className="font-mono text-primary font-bold text-sm truncate flex-1">{s.name}</span>
                  </div>
                  <div className="flex gap-0.5 flex-wrap">
                    {Array.from({ length: Math.max(s.lives ?? 1, 0) }).map((_, i) => (
                      <Heart key={i} className="h-4 w-4 fill-current text-red-500" />
                    ))}
                  </div>
                </div>
              ))}
              {/* Eliminated */}
              {eliminated.map(s => (
                <div key={s.id} className="rounded-xl border-2 border-border/30 bg-muted/10 p-3 flex flex-col gap-1 opacity-40">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl grayscale">{avatarFor(s.name)}</span>
                    <span className="font-mono text-muted-foreground font-bold text-sm truncate flex-1 line-through">{s.name}</span>
                  </div>
                  <Skull className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-4 overflow-hidden">

          {/* Timer panel */}
          <div className={cn(
            "rounded-2xl border-2 p-5 transition-all",
            timerActive
              ? "border-primary bg-primary/10 shadow-[0_0_40px_-5px_hsl(9_100%_58%/0.7)]"
              : "border-border/40 bg-muted/10"
          )}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-xs text-muted-foreground flex items-center gap-2">
                <Timer className="h-3 w-3" /> TIMER CHALLENGE
              </span>
              {timerActive && <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
            </div>

            {timerActive ? (
              <div className="space-y-3">
                <div className="text-center font-mono font-black text-5xl text-primary tabular-nums"
                  style={{ textShadow: "0 0 30px hsl(9 100% 58% / 0.9)" }}>
                  {timerSec}s
                </div>
                <div className="text-center text-xs text-muted-foreground font-mono">
                  TARGET: 10.00s · {taps.length} tap{taps.length !== 1 ? "s" : ""} in
                </div>
                {/* Live tap list */}
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {taps.map(tap => {
                    const name = students.find(s => s.id === tap.student_id)?.name ?? "?";
                    const diff = Math.abs(tap.elapsed_ms - 10_000);
                    return (
                      <div key={tap.id} className="flex items-center justify-between font-mono text-xs">
                        <span className="text-primary/80">{name}</span>
                        <span className="text-muted-foreground">{(tap.elapsed_ms / 1000).toFixed(2)}s</span>
                        <span className={cn("font-bold", diff < 500 ? "text-green-400" : diff < 1500 ? "text-yellow-400" : "text-primary/50")}>
                          ±{(diff / 1000).toFixed(2)}s
                        </span>
                      </div>
                    );
                  })}
                </div>
                <Button onClick={endTimer} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-mono font-bold">
                  END TIMER
                </Button>
              </div>
            ) : winnerName ? (
              <div className="text-center space-y-2">
                <Trophy className="h-10 w-10 mx-auto text-yellow-400" />
                <div className="font-mono font-black text-xl text-primary">{winnerName}</div>
                <div className="text-xs text-muted-foreground font-mono">won the timer round! +1 ❤️</div>
                <Button
                  onClick={fireTimer}
                  disabled={!canFireTimer}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-mono font-bold disabled:opacity-40">
                  <Zap className="h-4 w-4 me-1" />
                  {canFireTimer ? "FIRE TIMER" : finalRound ? "DISABLED (FINAL ROUND)" : "NEED >3 ALIVE"}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground font-mono">
                  {alive.length <= 3
                    ? "⚠ Final round — timer disabled"
                    : "Tap to launch a surprise timer challenge!"}
                </div>
                <Button
                  onClick={fireTimer}
                  disabled={!canFireTimer}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-mono font-bold disabled:opacity-40">
                  <Zap className="h-4 w-4 me-1" />
                  {canFireTimer ? "FIRE TIMER" : finalRound ? "DISABLED (FINAL ROUND)" : "NEED >3 ALIVE"}
                </Button>
              </div>
            )}
          </div>

          {/* Stats tile */}
          <div className="rounded-2xl border-2 border-primary/40 bg-primary/5 p-4 flex items-center justify-around font-mono">
            <div className="text-center">
              <div className="text-3xl font-black text-primary">{alive.length}</div>
              <div className="text-xs text-muted-foreground">ALIVE</div>
            </div>
            <div className="h-10 w-px bg-border" />
            <div className="text-center">
              <div className="text-3xl font-black text-muted-foreground">{eliminated.length}</div>
              <div className="text-xs text-muted-foreground">OUT</div>
            </div>
            <div className="h-10 w-px bg-border" />
            <div className="text-center">
              <div className="text-3xl font-black text-primary">{students.length}</div>
              <div className="text-xs text-muted-foreground">TOTAL</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DodgeballMonitor;
