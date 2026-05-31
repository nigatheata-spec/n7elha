import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Square, Maximize, Zap, Trophy } from "lucide-react";

const fmt = (n: number) => n.toLocaleString();

const AV_COLORS = ["#2563eb","#16a34a","#b45309","#dc2626","#7c3aed","#0891b2","#c2410c","#0f766e"];
const av = (name: string) => {
  const n = name || "?";
  let h = 0;
  for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) & 0xffffffff;
  return { bg: AV_COLORS[Math.abs(h) % AV_COLORS.length], letter: n.charAt(0).toUpperCase() };
};
const Avatar = ({ name, dim = false }: { name: string; dim?: boolean }) => {
  const { bg, letter } = av(name);
  return (
    <div style={{ background: dim ? "#444" : bg }}
      className="h-10 w-10 rounded-full flex items-center justify-center font-black text-white text-sm select-none shrink-0 font-mono">
      {letter}
    </div>
  );
};

const BombIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="15" cy="19" r="10" fill="currentColor" opacity="0.9" />
    <rect x="14" y="7" width="2.5" height="6" rx="1.2" fill="currentColor" />
    <path d="M20 4 L24 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="24" cy="4" r="2.5" fill="#ff8c00" />
    <circle cx="11" cy="15" r="2.5" fill="white" opacity="0.25" />
  </svg>
);

const ord = (n: number) => {
  const s = ["th","st","nd","rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

interface Props { session: any; sessionId: string; }

// Random bomb timer: 30–90 seconds
const randomBombMs = () => 30_000 + Math.random() * 60_000;

const HotPotatoMonitor = ({ session, sessionId }: Props) => {
  console.error("HPM-A: component entry, session?.status=", session?.status, "settings=", JSON.stringify(session?.settings).slice(0,200));
  const nav = useNavigate();
  const [students, setStudents] = useState<any[]>([]);
  const [explosionFeed, setExplosionFeed] = useState<{ name: string; at: string }[]>([]);
  const [now, setNow] = useState(Date.now());
  const [ending, setEnding] = useState(false);

  const lastProcessedExplosionRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  const settings        = session?.settings ?? {};
  const maxExplosions   = settings.maxExplosions ?? 5;
  const minutes: number = settings.minutes ?? 5;
  const explosionCount: number = settings.explosionCount ?? 0;
  const bombHolderId: string | null = settings.bombHolderId ?? null;
  const bombExplodesAt: string | null = settings.bombExplodesAt ?? null;

  const startedAt = session?.started_at ? new Date(session.started_at).getTime() : 0;
  const elapsed   = startedAt ? Math.floor((now - startedAt) / 1000) : 0;
  const totalSecs = minutes * 60;
  const left      = Math.max(0, totalSecs - elapsed);
  const mm        = String(Math.floor(left / 60)).padStart(2, "0");
  const ss        = String(left % 60).padStart(2, "0");

  // ── Load + subscribe ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    const refresh = async () => {
      const { data: ss } = await supabase.from("game_students").select("*").eq("session_id", sessionId).order("crypto", { ascending: false });
      setStudents(ss ?? []);
    };
    refresh();
    const ch = supabase.channel(`hp-monitor-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_sessions", filter: `id=eq.${sessionId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_students", filter: `session_id=eq.${sessionId}` }, refresh)
      .subscribe();
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => { supabase.removeChannel(ch); clearInterval(tick); };
  }, [sessionId]);

  // ── Bomb initialization (once, when students are loaded) ──────────────────
  useEffect(() => {
    if (initializedRef.current) return;
    if (session?.status !== "running") return;
    if (students.length === 0) return;
    if (settings.bombHolderId) { initializedRef.current = true; return; }

    initializedRef.current = true;
    const holder = students[Math.floor(Math.random() * students.length)];
    const expiresAt = new Date(Date.now() + randomBombMs()).toISOString();
    supabase.from("game_sessions").update({
      settings: {
        ...settings,
        bombHolderId: holder.id,
        bombExplodesAt: expiresAt,
      }
    }).eq("id", sessionId).catch(() => {});
  }, [session?.status, students.length]);

  // ── Bomb explosion detection ──────────────────────────────────────────────
  useEffect(() => {
    if (!bombExplodesAt || !bombHolderId) return;
    if (session?.status !== "running") return;
    if (new Date(bombExplodesAt).getTime() > Date.now()) return;
    // Each unique bombExplodesAt is processed exactly once — prevents double-fire
    // between the finally-reset and the next now tick before session updates
    if (lastProcessedExplosionRef.current === bombExplodesAt) return;

    lastProcessedExplosionRef.current = bombExplodesAt;

    const triggerExplosion = async () => {
      try {
        // Fetch fresh settings — closure value is stale after awaits
        const { data: fresh } = await supabase.from("game_sessions")
          .select("settings").eq("id", sessionId).single();
        const live = (fresh?.settings ?? settings) as Record<string, any>;

        const victim = students.find(s => s.id === bombHolderId);
        if (!victim) return;

        const newCount = (live.explosionCount ?? 0) + 1;
        const ts = new Date().toISOString();

        await supabase.from("game_students").update({ crypto: 0 }).eq("id", bombHolderId);
        setExplosionFeed(prev => [{ name: victim.name, at: ts }, ...prev].slice(0, 8));

        if (newCount >= (live.maxExplosions ?? maxExplosions) || left <= 0) {
          await supabase.from("game_sessions").update({
            status: "finished",
            ended_at: ts,
            settings: { ...live, explosionCount: newCount, lastExplosionAt: ts, lastExplosionVictimId: bombHolderId },
          }).eq("id", sessionId);
          return;
        }

        const others = students.filter(s => s.id !== bombHolderId);
        const nextHolder = others.length > 0
          ? others[Math.floor(Math.random() * others.length)]
          : victim;
        const nextAt = new Date(Date.now() + randomBombMs()).toISOString();

        await supabase.from("game_sessions").update({
          settings: {
            ...live,
            bombHolderId: nextHolder.id,
            bombExplodesAt: nextAt,
            explosionCount: newCount,
            lastExplosionAt: ts,
            lastExplosionVictimId: bombHolderId,
          }
        }).eq("id", sessionId);
      } catch (err) {
        console.error("triggerExplosion:", err);
        lastProcessedExplosionRef.current = null; // allow retry on error
      }
    };

    triggerExplosion();
  }, [now, bombExplodesAt, bombHolderId, students]);

  // ── Auto-end: time up ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!session || session.status !== "running") return;
    if (left === 0 && !ending) {
      setEnding(true);
      supabase.from("game_sessions").update({ status: "finished", ended_at: new Date().toISOString() }).eq("id", sessionId);
    }
  }, [left, session, ending]);

  // ── Navigate to results when finished ────────────────────────────────────
  useEffect(() => {
    if (session?.status === "finished") {
      nav(`/app/games/${session.id}/results`, { replace: true });
    }
  }, [session?.status]);

  const endNow = async () => {
    if (!session) return;
    if (!confirm("End the game now?")) return;
    await supabase.from("game_sessions").update({ status: "finished", ended_at: new Date().toISOString() }).eq("id", session.id);
    nav(`/app/games/${session.id}/results`);
  };

  const goFullscreen = () => {
    const el = document.documentElement as any;
    (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  };

  const bombHolder = students.find(s => s.id === bombHolderId);

  console.error("HPM-B: pre-render, students.length=", students.length, "left=", left, "bombHolder=", bombHolder?.name);

  // DEBUG: catch the actual error
  try { return (
    <div className="theme-hotpotato fixed inset-0 bg-background text-foreground overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 30% 0%, hsl(22 60% 11%) 0%, hsl(22 55% 7%) 100%)", fontFamily: "monospace" }}>
      {(()=>{console.error("HPM-C: topbar start");return null;})()}
      {/* Top bar */}
      <div className="absolute top-3 inset-x-3 z-20 flex items-center justify-between text-xs gap-3">
        <div className="text-muted-foreground font-mono">
          CODE <span className="text-primary text-base font-black tracking-widest">{session?.code}</span>
          <span className="mx-3 text-muted-foreground/40">|</span>
          <span className="text-orange-400 font-bold">{explosionCount} / {maxExplosions} explosions</span>
        </div>
        <div className="font-black text-3xl tabular-nums" style={{ color: left < 30 ? "hsl(0 85% 60%)" : "hsl(45 100% 55%)", textShadow: "0 0 20px currentColor" }}>
          {mm}:{ss}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={goFullscreen} className="text-primary hover:text-primary hover:bg-primary/10">
            <Maximize className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={endNow} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-mono font-bold">
            <Square className="h-4 w-4 me-1" />END
          </Button>
        </div>
      </div>

      <div className="h-full grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4 p-4 pt-14">
        {(()=>{console.error("HPM-D: leaderboard start");return null;})()}
        {/* LEADERBOARD */}
        <div className="space-y-2 overflow-hidden flex flex-col">
          {students.length === 0 ? (
            <div className="flex-1 flex items-center justify-center font-mono text-2xl text-primary animate-pulse">
              {"> WAITING FOR PLAYERS..."}
            </div>
          ) : (
            students.slice(0, 9).map((s, i) => {
              const isBombHolder = s.id === bombHolderId;
              return (
                <div key={s.id} className={cn(
                  "rounded-2xl border-2 px-4 py-3 flex items-center gap-3 transition-all",
                  isBombHolder
                    ? "border-primary bg-primary/15 animate-hp-bomb-pulse"
                    : i === 0
                      ? "border-success bg-success/10 shadow-[0_0_25px_-5px_hsl(45_100%_55%/0.5)]"
                      : "border-primary/30 bg-primary/5"
                )}>
                  <span className="font-mono text-primary/70 font-black text-xl w-14 shrink-0">
                    {ord(i + 1).slice(0, -2)}<sup className="text-xs">{ord(i + 1).slice(-2)}</sup>
                  </span>
                  <Avatar name={s.name} />
                  <span className={cn(
                    "font-mono text-xl font-bold flex-1 truncate",
                    isBombHolder ? "text-primary text-glow-fire" : i === 0 ? "text-success text-glow-gold" : "text-foreground"
                  )}>
                    {s.name}
                  </span>
                  {isBombHolder && <BombIcon className="h-7 w-7 text-primary shrink-0" />}
                  <span className={cn(
                    "font-mono text-xl font-black tabular-nums",
                    i === 0 ? "text-success" : "text-foreground/80"
                  )}>
                    {fmt(s.crypto ?? 0)}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {(()=>{console.error("HPM-E: right col start");return null;})()}
        {/* RIGHT: bomb status + explosion feed */}
        <div className="grid grid-rows-[auto_1fr] gap-4 overflow-hidden">

          {(()=>{console.error("HPM-F: bomb holder card");return null;})()}
          {/* Bomb holder card */}
          <div className={cn(
            "rounded-2xl border-2 p-5 flex items-center gap-4",
            bombHolder
              ? "border-primary/80 bg-primary/10 animate-hp-bomb-pulse"
              : "border-border/30 bg-muted/10"
          )}>
            <BombIcon className="h-12 w-12 text-primary shrink-0" />
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground font-mono tracking-widest uppercase mb-1">Bomb Holder</div>
              {bombHolder ? (
                <div className="font-black text-xl text-primary truncate text-glow-fire">{bombHolder.name}</div>
              ) : (
                <div className="text-muted-foreground text-sm font-mono">Assigning...</div>
              )}
            </div>
          </div>

          {(()=>{console.error("HPM-G: explosion feed");return null;})()}
          {/* Explosion feed */}
          <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 overflow-hidden flex flex-col">
            <div className="font-mono text-primary/70 text-xs mb-3 flex items-center justify-between">
              <span>EXPLOSION LOG</span>
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            </div>
            <div className="space-y-3 overflow-hidden flex-1">
              {explosionFeed.length === 0 ? (
                <div className="text-muted-foreground/40 font-mono text-sm">{"> awaiting first explosion..."}</div>
              ) : (
                explosionFeed.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 font-mono text-sm">
                    <BombIcon className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-primary/80">
                      <span className="font-bold text-primary">{e.name}</span> exploded — score wiped
                    </span>
                  </div>
                ))
              )}
            </div>

            {(()=>{console.error("HPM-H: score summary");return null;})()}
            {/* Score summary */}
            {(()=>{console.error("HPM-H1: pre-trophy");return null;})()}
            <div className="mt-4 pt-4 border-t border-primary/20 flex items-center gap-3">
              {(()=>{console.error("HPM-H2: inside outer div, pre-Trophy");return null;})()}
              <Trophy className="h-8 w-8 text-success shrink-0" />
              {(()=>{console.error("HPM-H3: post-Trophy, pre-div");return null;})()}
              <div>
                {(()=>{console.error("HPM-H4: inside inner div, pre-Math.max");return null;})()}
                <div className="font-mono text-success font-black text-xl">
                  {(()=>{
                    const maxScore = Math.max(...students.map(s => s.crypto ?? 0), 0);
                    console.error("HPM-H5: Math.max result=", maxScore);
                    return fmt(maxScore);
                  })()}
                </div>
                <div className="text-xs text-muted-foreground font-mono">top score · {students.length} players</div>
              </div>
              {(()=>{console.error("HPM-H6: post-inner-div, pre-ms-auto");return null;})()}
              <div className="ms-auto">
                <div className="flex items-center gap-1 text-primary font-bold text-sm">
                  <Zap className="h-4 w-4" />
                  {(()=>{
                    const total = students.reduce((a, s) => a + (s.crypto ?? 0), 0);
                    console.error("HPM-H7: reduce total=", total);
                    return total.toLocaleString();
                  })()}
                  {" total pts"}
                </div>
              </div>
              {(()=>{console.error("HPM-H8: end of score summary div");return null;})()}
            </div>
          </div>
        </div>
      </div>
    </div>
  ); } catch (renderErr: any) {
    console.error("HPM-CATCH: ACTUAL ERROR:", renderErr?.message, renderErr?.stack);
    return <div style={{color:"red",padding:40,fontFamily:"monospace"}}>{String(renderErr)}</div>;
  }
};

export default HotPotatoMonitor;
