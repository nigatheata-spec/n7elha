import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Square, Maximize } from "lucide-react";
import { PixelShield, PixelFlame, PixelHouse, PixelPlank, PixelBrick, PixelStaircase } from "@/components/PixelIcons";
import { PixelLavaCrest, PixelLavaBody } from "@/components/PixelLava";
import { PixelRockCeiling } from "@/components/PixelRockCeiling";
import { BLOCK_SPRITES, spriteRuns, type BlockKey } from "@/lib/lavaFloorBlocks";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";

type Build = { id: string; student_id: string; student_name: string; block_type: BlockKey; height_added: number; cost: number; created_at: string };
const BLOCK_ICON: Record<BlockKey, typeof PixelPlank> = {
  plank: PixelPlank, brick: PixelBrick, staircase: PixelStaircase, house: PixelHouse,
};

// ── Tower ───────────────────────────────────────────────────────────────────
// Every purchased block is drawn as a real pixel-art platform stacked on the
// ones before it, so the projector shows the class's actual structure rising
// away from the lava instead of a number.
const TOWER_MAX  = 40;   // oldest blocks fall off the render, the top is the story
const TOWER_BUDGET_PX = 400; // vertical room the stack may occupy before it shrinks

// Width and thickness are deliberately decoupled. Each slab always spans the
// full column — the class is building ONE wide platform, and a platform that
// narrows as it grows would read as a bar chart instead. Only the layer
// thickness compresses as courses pile up, so a tall structure becomes thin
// strata rather than overflowing the screen.
const TowerBlock = ({ type, rowPx, landing }: { type: BlockKey; rowPx: number; landing: boolean }) => {
  const s = BLOCK_SPRITES[type];
  return (
    <div
      className={cn("relative w-full shrink-0", landing && "animate-lf-block-land")}
      style={{ height: s.rows * rowPx }}
      aria-hidden>
      {spriteRuns(type).map((r, i) => (
        <div key={i} className="absolute"
          style={{
            left: `${(r.x / s.cols) * 100}%`,
            width: `${(r.w / s.cols) * 100}%`,
            top: r.y * rowPx,
            height: rowPx,
            background: r.color,
          }} />
      ))}
    </div>
  );
};

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

interface Props { session: any; sessionId: string; }

const LavaFloorMonitor = ({ session, sessionId }: Props) => {
  const nav = useNavigate();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const { i18n } = useTranslation();
  const ar = (session?.settings?.lang ?? i18n.language) === "ar";
  const [students, setStudents]     = useState<any[]>([]);
  const [now, setNow]               = useState(Date.now());
  const [ending, setEnding]         = useState(false);
  const [spiking, setSpiking]       = useState(false);
  const [towerHeight, setTowerHeight] = useState(0);
  const [recentBuilds, setRecentBuilds] = useState<Build[]>([]);
  // Stack is stored bottom-of-tower first; `landingId` is whichever block is
  // mid drop-and-squash right now (one at a time — buys are rate-limited).
  const [towerStack, setTowerStack] = useState<{ id: string; type: BlockKey }[]>([]);
  const [buildCount, setBuildCount] = useState(0);
  const [landingId, setLandingId]   = useState<string | null>(null);

  const lavaRef        = useRef(0);
  const dbWriteRef     = useRef(0);
  const prevTotals     = useRef({ wrong: 0 });
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

      // Apply player-driven lava deltas — wrong answers speed the lava up
      const totalWrong = loaded.reduce((a, s) => a + ((s.hacks_received ?? 0)), 0);
      const deltaWrong = totalWrong - prevTotals.current.wrong;
      if (deltaWrong > 0) lavaRef.current = Math.min(100, lavaRef.current + deltaWrong * WRONG_PENALTY);
      prevTotals.current = { wrong: totalWrong };
    };
    refresh();

    const loadBuilds = async () => {
      const { data } = await supabase.from("lava_floor_builds").select("*")
        .eq("session_id", sessionId).order("created_at", { ascending: false });
      const rows = (data ?? []) as Build[];
      setTowerHeight(rows.reduce((a, r) => a + r.height_added, 0));
      setRecentBuilds(rows.slice(0, 8));
      setBuildCount(rows.length);
      // rows arrive newest-first; the stack renders bottom-up, so reverse the
      // most recent slice to put the oldest of them at the base.
      setTowerStack(rows.slice(0, TOWER_MAX).reverse().map(r => ({ id: r.id, type: r.block_type })));
    };
    loadBuilds();

    const ch = supabase.channel(`lf-monitor-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_sessions",  filter: `id=eq.${sessionId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_students", filter: `session_id=eq.${sessionId}` }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "lava_floor_builds", filter: `session_id=eq.${sessionId}` },
        (p: any) => {
          const b = p.new as Build;
          setTowerHeight(h => h + b.height_added);
          setRecentBuilds(list => [b, ...list].slice(0, 8));
          setBuildCount(n => n + 1);
          setTowerStack(list => [...list, { id: b.id, type: b.block_type }].slice(-TOWER_MAX));
          // No toast: the block itself lands on the tower and the feed names
          // the builder — a popup would only restate what is already on screen.
          setLandingId(b.id);
          setTimeout(() => setLandingId(cur => (cur === b.id ? null : cur)), 500);
        })
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
        }).eq("id", sessionId).then(undefined, () => {});
      }

      // Lava reached 100% → auto-end
      if (lavaRef.current >= 100 && !ending) {
        setEnding(true);
        supabase.from("game_sessions").update({
          status: "finished",
          ended_at: new Date().toISOString(),
          settings: { ...settingsRef.current, lavaLevel: 100 },
        }).eq("id", sessionId).then(undefined, () => {});
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
    if (!session || !(await confirm(ar ? "إنهاء اللعبة الآن؟" : "End the game now?"))) return;
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
  const danger      = lavaDisplay >= 80;
  const critical    = lavaDisplay >= 92;
  // Shrink the pixel scale as the tower grows so a long stack still fits the
  // projector without scrolling — never below 2px or the blocks stop reading.
  const towerRows   = towerStack.reduce((a, b) => a + BLOCK_SPRITES[b.type].rows, 0);
  const towerRowPx  = Math.max(2, Math.min(9, Math.floor(TOWER_BUDGET_PX / Math.max(1, towerRows))));
  const hiddenBlocks = Math.max(0, buildCount - towerStack.length);

  return (
    <div className="theme-lavafloor fixed inset-0 text-foreground overflow-hidden font-mono"
      style={{ background: "#0A0610" }}>
      {ConfirmDialog}

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

      {/* The wrapper deliberately keeps `z-index: auto` so it does NOT create a
          stacking context: its children then compete with the lava layers
          directly. That is what lets the platform sit BEHIND the lava (so a
          rising level visibly eats the courses it swallows) while the HUD and
          leaderboard still sit in front of it. */}
      <div className="absolute inset-0 overflow-hidden">

      {/* Top bar */}
      <div className="absolute top-3 inset-x-3 z-20 flex items-center justify-between text-xs gap-3">
        <div className="text-muted-foreground">
          {ar ? "الرمز" : "CODE"} <span className="text-primary text-base font-black tracking-widest">{session?.code}</span>
          <span className="mx-3 text-muted-foreground/30">|</span>
          <span className="font-mono font-bold" style={{ color: danger ? "#e74c3c" : "#aaa" }}>
            {lavaDisplay.toFixed(1)}% {ar ? "حمم" : "LAVA"}
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
            <Square className="h-4 w-4 me-1" />{ar ? "إنهاء" : "END"}
          </Button>
        </div>
      </div>

      <div className="h-full grid grid-cols-1 lg:grid-cols-[auto_1fr_26rem] gap-4 p-4 pt-14">

        {/* LAVA COLUMN — the main drama */}
        <div className="relative z-10 flex flex-col items-center gap-3 w-full lg:w-28">
          <div className="text-xs text-muted-foreground tracking-widest uppercase">{ar ? "حمم" : "Lava"}</div>

          {/* Vertical lava gauge. The tube is deliberately EMPTY — no backdrop and
              no painted fill. The real full-screen lava is already rising behind
              it at the true level, so leaving the tube transparent turns it into a
              window onto the actual molten line instead of a second, differently
              shaded bar that never quite matched it. */}
          <div className="pixel-progress flex-1 w-20 relative" style={{ borderColor: danger ? "hsl(14 72% 52%)" : "hsl(14 25% 30%)" }}>
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
              "pixel-button w-20 font-bold text-xs transition-all text-primary",
              spiking ? "animate-pulse" : "hover:brightness-125"
            )}
            style={{
              // Solid near-black, not a translucent tint: this control sits low
              // on the screen, which is exactly where the lava ends up, and a
              // see-through button disappears into it right when the teacher
              // most wants to reach for it.
              background: spiking ? "#1B0B06" : "#0A0610",
              borderColor: spiking ? "hsl(14 72% 52%)" : "hsl(14 45% 45%)",
            }}>
            <PixelFlame className="h-3 w-3 me-1" color="currentColor" />+10%
          </Button>
          <div className="text-[9px] text-center leading-tight px-1 rounded"
            style={{ color: "hsl(14 30% 78%)", background: "#0A0610", textShadow: "0 1px 2px #0A0610" }}>
            {ar ? <>تفجير<br/>الحمم</> : <>spike<br/>lava</>}
          </div>
        </div>

        {/* TOWER COLUMN — the platform the class actually built.
            The stack is anchored to the cave FLOOR, not to the lava line, so the
            rising lava swallows the courses the class laid first. That drowning
            base is the whole point of the mode: the platform is an escape from a
            floor that is disappearing, and the clearance between the molten line
            and the top course is the class's remaining margin. */}
        <div className="relative z-0 w-full min-w-0 min-h-[12rem] flex flex-col items-center">
          <div className="relative z-10 text-xs text-muted-foreground tracking-widest uppercase">{ar ? "المنصة" : "Platform"}</div>

          <div className="absolute inset-x-0 bottom-0 top-6 pointer-events-none">
            <div className="absolute inset-x-0 bottom-0 flex flex-col-reverse items-stretch px-2">

              {towerStack.length === 0 ? (
                <div className="text-[10px] text-muted-foreground/60 text-center leading-tight px-2">
                  {ar ? "اشتروا الكتل لبناء منصة" : "BUY BLOCKS TO BUILD A PLATFORM"}
                </div>
              ) : (
                <>
                  {/* Base marker for blocks that scrolled out of the render window */}
                  {hiddenBlocks > 0 && (
                    <div className="text-[9px] font-black tabular-nums pt-0.5 text-center" style={{ color: "hsl(200 40% 55%)" }}>
                      +{hiddenBlocks} {ar ? "أسفل" : "below"}
                    </div>
                  )}
                  {towerStack.map(b => (
                    <TowerBlock key={b.id} type={b.type} rowPx={towerRowPx} landing={b.id === landingId} />
                  ))}
                  {/* Height readout sits on top of the stack, growing with it */}
                  <div className="flex items-center gap-1 pb-1">
                    <PixelHouse className="h-3.5 w-3.5" color="currentColor" style={{ color: "hsl(200 60% 55%)" }} />
                    <span className="text-sm font-pixel font-black tabular-nums" style={{ color: "hsl(200 60% 70%)" }}>
                      {fmt(towerHeight)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: leaderboard + stats */}
        <div className="relative z-10 grid grid-rows-[1fr_auto_auto] gap-4 overflow-hidden min-h-0">

          {/* Leaderboard */}
          <div className="space-y-2 overflow-y-auto">
            {students.length === 0 ? (
              <div className="flex items-center justify-center h-full text-primary text-xl animate-pulse">
                {ar ? "> في انتظار اللاعبين..." : "> WAITING FOR PLAYERS..."}
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

          {/* Build feed — recent tower contributions */}
          {recentBuilds.length > 0 && (
            <div className="pixel-panel border-2 border-primary/20 bg-primary/5 px-3 py-2 flex items-center gap-2 overflow-x-auto">
              {recentBuilds.map(b => {
                const Icon = BLOCK_ICON[b.block_type];
                return (
                  <div key={b.id} className="flex items-center gap-1.5 shrink-0 px-2 py-1 rounded"
                    style={{ background: "hsl(200 40% 15% / 0.4)" }}>
                    <Icon className="h-4 w-4" color="hsl(200 60% 65%)" />
                    <span className="text-xs font-bold" style={{ color: "hsl(200 30% 78%)" }}>{b.student_name}</span>
                    <span className="text-xs font-black tabular-nums" style={{ color: "hsl(200 60% 65%)" }}>+{b.height_added}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Class stats bar */}
          <div className="pixel-panel border-2 border-primary/30 bg-primary/5 p-4 grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-pixel font-black text-success">{students.reduce((a, s) => a + (s.correct_answers ?? 0), 0)}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest">{ar ? "صحيح" : "correct"}</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <PixelHouse className="h-5 w-5" color="currentColor" style={{ color: "hsl(200 60% 55%)" }} />
                <span className="text-2xl font-pixel font-black" style={{ color: "hsl(200 60% 65%)" }}>{fmt(towerHeight)}</span>
              </div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest">{ar ? "ارتفاع البرج" : "tower height"}</div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default LavaFloorMonitor;
