import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Square, Maximize } from "lucide-react";
import { PixelShield, PixelFlame } from "@/components/PixelIcons";
import { PixelLavaCrest, PixelLavaBody } from "@/components/PixelLava";
import { PixelRockCeiling } from "@/components/PixelRockCeiling";

const fmt = (n: number) => n.toLocaleString();

const AV_COLORS = ["#2563eb","#16a34a","#b45309","#dc2626","#7c3aed","#0891b2","#c2410c","#0f766e"];
const av = (name: string) => {
  const n = name || "?";
  let h = 0;
  for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) & 0xffffffff;
  return { bg: AV_COLORS[Math.abs(h) % AV_COLORS.length], letter: n.charAt(0).toUpperCase() };
};
const Avatar = ({ name }: { name: string }) => {
  const { bg, letter } = av(name);
  return (
    <div style={{ background: bg, borderColor: bg }}
      className="pixel-avatar h-9 w-9 flex items-center justify-center font-black text-white text-sm select-none shrink-0 font-mono">
      {letter}
    </div>
  );
};

// % per wrong answer lava penalty
const WRONG_PENALTY = 1;
// lava reduction per brick spent (1 brick = this many %)
const BRICK_LAVA_RATE = WRONG_PENALTY * 2 / 5; // 5 bricks = -2%

interface Props { session: any; sessionId: string; }

const LavaFloorMonitor = ({ session, sessionId }: Props) => {
  const nav = useNavigate();
  const [students, setStudents] = useState<any[]>([]);
  const [now, setNow]           = useState(Date.now());
  const [ending, setEnding]     = useState(false);
  const [spiking, setSpiking]   = useState(false);

  const lavaRef        = useRef(0);
  const dbWriteRef     = useRef(0);
  const prevTotals     = useRef({ wrong: 0, bricksSpent: 0 });
  const initializedRef = useRef(false);
  const settingsRef    = useRef<any>({});

  const settings    = session?.settings ?? {};
  settingsRef.current = settings; // always up-to-date inside closures
  const lavaRate    = settings.lavaRate ?? 0.08;
  const minutes     = settings.minutes ?? 8;
  const startedAt   = session?.started_at ? new Date(session.started_at).getTime() : 0;
  const elapsed     = startedAt ? Math.floor((now - startedAt) / 1000) : 0;
  const totalSecs   = minutes * 60;
  const left        = Math.max(0, totalSecs - elapsed);
  const mm          = String(Math.floor(left / 60)).padStart(2, "0");
  const ss          = String(left % 60).padStart(2, "0");

  // ── Load + subscribe ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    const refresh = async () => {
      const { data: ss } = await supabase.from("game_students").select("*")
        .eq("session_id", sessionId).order("crypto", { ascending: false });
      const loaded = ss ?? [];
      setStudents(loaded);

      // Apply player-driven lava deltas
      const totalWrong       = loaded.reduce((a, s) => a + ((s.hacks_received ?? 0)), 0);
      const totalBricksSpent = loaded.reduce((a, s) => a + ((s.hacks_made ?? 0)), 0);

      const deltaWrong  = totalWrong       - prevTotals.current.wrong;
      const deltaBricks = totalBricksSpent - prevTotals.current.bricksSpent;

      if (deltaWrong > 0)  lavaRef.current = Math.min(100, lavaRef.current + deltaWrong  * WRONG_PENALTY);
      if (deltaBricks > 0) lavaRef.current = Math.max(0,   lavaRef.current - deltaBricks * BRICK_LAVA_RATE);

      prevTotals.current = { wrong: totalWrong, bricksSpent: totalBricksSpent };
    };
    refresh();
    const ch = supabase.channel(`lf-monitor-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_sessions",  filter: `id=eq.${sessionId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_students", filter: `session_id=eq.${sessionId}` }, refresh)
      .subscribe();
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => { supabase.removeChannel(ch); clearInterval(tick); };
  }, [sessionId]);

  // ── Initialize lava from saved state ─────────────────────────────────────
  useEffect(() => {
    if (initializedRef.current) return;
    if (session?.status !== "running") return;
    initializedRef.current = true;
    const saved   = settings.lavaLevel ?? 0;
    const snapAt  = settings.lavaSnapshotAt;
    if (snapAt) {
      const catchUp = (Date.now() - new Date(snapAt).getTime()) / 1000 * lavaRate;
      lavaRef.current = Math.min(100, saved + catchUp);
    } else {
      lavaRef.current = saved;
    }
  }, [session?.status, settings.lavaLevel]);

  // ── Lava tick (natural rise) every 500ms ──────────────────────────────────
  useEffect(() => {
    if (session?.status !== "running") return;
    const t = setInterval(() => {
      lavaRef.current = Math.min(100, lavaRef.current + lavaRate * 0.5);

      // Write to DB every 3 seconds
      const n = Date.now();
      if (n - dbWriteRef.current >= 3000) {
        dbWriteRef.current = n;
        supabase.from("game_sessions").update({
          settings: { ...settingsRef.current, lavaLevel: lavaRef.current, lavaSnapshotAt: new Date().toISOString() }
        }).eq("id", sessionId).catch(() => {});
      }

      // Lava reached 100% → auto-end
      if (lavaRef.current >= 100 && !ending) {
        setEnding(true);
        supabase.from("game_sessions").update({
          status: "finished",
          ended_at: new Date().toISOString(),
          settings: { ...settingsRef.current, lavaLevel: 100 },
        }).eq("id", sessionId).catch(() => {});
      }

      setNow(Date.now()); // trigger re-render for lava display
    }, 500);
    return () => clearInterval(t);
  }, [session?.status, lavaRate, ending]);

  // ── Timer end ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session || session.status !== "running") return;
    if (left === 0 && !ending) {
      setEnding(true);
      supabase.from("game_sessions").update({
        status: "finished",
        ended_at: new Date().toISOString(),
        settings: { ...settingsRef.current },
      }).eq("id", sessionId).then(() => {
        // Navigate immediately to avoid blank screen on DB lag or failure
        nav(`/app/games/${sessionId}/results`, { replace: true });
      }).catch(() => {
        // If DB fails, still navigate locally
        nav(`/app/games/${sessionId}/results`, { replace: true });
      });
    }
  }, [left, session, ending, sessionId, nav]);

  // ── Navigate to results ───────────────────────────────────────────────────
  useEffect(() => {
    if (session?.status === "finished") {
      nav(`/app/games/${session.id}/results`, { replace: true });
    }
  }, [session?.status]);

  const endNow = async () => {
    if (!session || !confirm("End the game now?")) return;
    await supabase.from("game_sessions").update({
      status: "finished", ended_at: new Date().toISOString(),
      settings: { ...settingsRef.current },
    }).eq("id", sessionId);
    nav(`/app/games/${session.id}/results`);
  };

  const spikeLava = async () => {
    if (spiking) return;
    setSpiking(true);
    lavaRef.current = Math.min(100, lavaRef.current + 10);
    await supabase.from("game_sessions").update({
      settings: { ...settings, lavaLevel: lavaRef.current, lavaSnapshotAt: new Date().toISOString() }
    }).eq("id", sessionId);
    setTimeout(() => setSpiking(false), 1500);
  };

  const goFullscreen = () => {
    const el = document.documentElement as any;
    (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  };

  const lavaDisplay = Math.min(100, lavaRef.current);
  const lavaHeight  = `${lavaDisplay.toFixed(1)}%`;
  const danger      = lavaDisplay >= 80;
  const critical    = lavaDisplay >= 92;
  const totalBricks = students.reduce((a, s) => a + (s.crypto ?? 0), 0);

  return (
    <div className="theme-lavafloor fixed inset-0 text-foreground overflow-hidden font-mono"
      style={{ background: "#0A0610" }}>

      {/* ── CAVE ROCK CEILING — static pixel-art background ──────────── */}
      <PixelRockCeiling className="absolute inset-0" />

      {/* ── Rising lava body (GPU translateY, behind all content) ─────── */}
      <div className="absolute inset-x-0 bottom-0 h-full pointer-events-none"
        style={{ transform: `translateY(${100 - lavaDisplay}%)`, transition: "transform 0.6s cubic-bezier(0.25,0.46,0.45,0.94)", willChange: "transform", zIndex: 1 }}>
        <PixelLavaCrest className="absolute inset-x-0 -top-16 h-16" />
        <PixelLavaBody className="absolute inset-0" />
      </div>

      {/* Ambient heat glow rising up */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none transition-all duration-700"
        style={{ height: `${Math.min(50, lavaDisplay * 0.65)}%`, background: "linear-gradient(to top, hsl(14 90% 16% / 0.55), transparent)", zIndex: 2 }} />

      {/* Critical flash */}
      {critical && (
        <div className="absolute inset-0 pointer-events-none" style={{ background: "hsl(0 90% 45% / 0.05)", animation: "heat-flicker 1.1s ease-in-out infinite", zIndex: 2 }} />
      )}

      {/* All existing UI sits above the lava */}
      <div className="absolute inset-0 overflow-hidden" style={{ zIndex: 3 }}>

      {/* Top bar */}
      <div className="absolute top-3 inset-x-3 z-20 flex items-center justify-between text-xs gap-3">
        <div className="text-muted-foreground">
          CODE <span className="text-primary text-base font-black tracking-widest">{session?.code}</span>
          <span className="mx-3 text-muted-foreground/30">|</span>
          <span className="font-mono font-bold" style={{ color: danger ? "#e74c3c" : "#aaa" }}>
            {lavaDisplay.toFixed(1)}% LAVA
          </span>
        </div>
        <div className={cn("font-black text-3xl tabular-nums transition-colors",
          left < 30 ? "text-red-500" : "text-success")}>
          {mm}:{ss}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={goFullscreen} className="text-primary hover:text-primary hover:bg-primary/10">
            <Maximize className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={endNow} className="bg-destructive hover:bg-destructive/90 text-white font-bold">
            <Square className="h-4 w-4 me-1" />END
          </Button>
        </div>
      </div>

      <div className="h-full grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-4 p-4 pt-14">

        {/* LAVA COLUMN — the main drama */}
        <div className="flex flex-col items-center gap-3 w-full lg:w-28">
          <div className="text-xs text-muted-foreground tracking-widest uppercase">Lava</div>

          {/* Vertical lava bar */}
          <div className="pixel-progress flex-1 w-20 relative overflow-hidden bg-muted/20" style={{ borderColor: danger ? "hsl(14 72% 52%)" : "hsl(14 25% 30%)" }}>
            {/* Fill from bottom */}
            <div className="absolute bottom-0 left-0 right-0 lava-fill lava-fill-anim transition-all duration-700"
              style={{ height: lavaHeight }} />
            {critical && (
              <div className="absolute inset-0 animate-pulse" style={{ background: "hsl(14 72% 52% / 0.15)" }} />
            )}
            {/* % label */}
            <div className="absolute inset-x-0 top-2 text-center">
              <span className={cn("font-pixel font-black text-sm", danger ? "text-primary" : "text-muted-foreground")}>
                {Math.round(lavaDisplay)}%
              </span>
            </div>
          </div>

          {/* Spike button */}
          <Button
            onClick={spikeLava}
            disabled={spiking}
            size="sm"
            className={cn(
              "pixel-button w-20 font-bold text-xs transition-all",
              spiking
                ? "bg-primary/30 text-primary animate-pulse"
                : "bg-primary/10 text-primary hover:bg-primary/25"
            )}
            style={{
              borderColor: spiking ? "hsl(14 72% 52%)" : "hsl(14 30% 35%)",
            }}>
            <PixelFlame className="h-3 w-3 me-1" color="currentColor" />+10%
          </Button>
          <div className="text-[9px] text-muted-foreground/50 text-center leading-tight">spike<br/>lava</div>
        </div>

        {/* RIGHT: leaderboard + stats */}
        <div className="grid grid-rows-[1fr_auto] gap-4 overflow-hidden min-h-0">

          {/* Leaderboard */}
          <div className="space-y-2 overflow-y-auto">
            {students.length === 0 ? (
              <div className="flex items-center justify-center h-full text-primary text-xl animate-pulse">
                {"> WAITING FOR PLAYERS..."}
              </div>
            ) : (
              students.map((s, i) => {
                const bricks      = s.crypto ?? 0;
                const correct     = s.correct_answers ?? 0;
                const wrong       = (s.total_answers ?? 0) - correct;
                return (
                  <div key={s.id} className={cn(
                    "pixel-panel border-2 px-4 py-3 flex items-center gap-3 transition-all",
                    i === 0
                      ? "border-success bg-success/10"
                      : "border-primary/25 bg-primary/5"
                  )}>
                    <span className="font-black text-xl w-8 shrink-0 text-muted-foreground/60">{i + 1}</span>
                    <Avatar name={s.name} />
                    <span className={cn("font-bold text-lg flex-1 truncate", i === 0 ? "text-success" : "text-foreground")}>
                      {s.name}
                    </span>
                    <div className="flex items-center gap-3 text-sm shrink-0">
                      <span className="text-green-400 font-bold tabular-nums">✓{correct}</span>
                      {wrong > 0 && <span className="text-red-400 font-bold tabular-nums">✗{wrong}</span>}
                      <div className="flex items-center gap-1 text-success font-black tabular-nums">
                        <PixelShield className="h-4 w-4" color="currentColor" />
                        {bricks}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Class stats bar */}
          <div className="pixel-panel border-2 border-primary/30 bg-primary/5 p-4 grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-pixel font-black text-success">{students.reduce((a, s) => a + (s.correct_answers ?? 0), 0)}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest">correct</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <PixelShield className="h-5 w-5" color="currentColor" style={{ color: "hsl(142 65% 42%)" }} />
                <span className="text-2xl font-pixel font-black text-success">{fmt(totalBricks)}</span>
              </div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest">bricks left</div>
            </div>
            <div className="text-center">
              {danger ? (
                <div className="text-2xl font-pixel font-black text-primary animate-pulse">DANGER</div>
              ) : (
                <div className="text-2xl font-pixel font-black text-success">SAFE</div>
              )}
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest">status</div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default LavaFloorMonitor;
