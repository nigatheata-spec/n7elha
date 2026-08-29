import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Trophy, Timer, Square, Maximize, Zap } from "lucide-react";
import { AsteroidCard } from "@/components/AsteroidCard";
import { SpaceBackdrop } from "@/components/SpaceBackdrop";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";

// ── Letter avatar ─────────────────────────────────────────────────────────────
const AV_COLORS = ["#2563eb","#16a34a","#b45309","#dc2626","#7c3aed","#0891b2","#c2410c","#0f766e"];
const av = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return { bg: AV_COLORS[Math.abs(h) % AV_COLORS.length], letter: (name.charAt(0) || "?").toUpperCase() };
};
const Avatar = ({ name, size = "md", dim = false }: { name: string; size?: "sm" | "md"; dim?: boolean }) => {
  const { bg, letter } = av(name);
  return (
    <div style={{ background: dim ? "#555" : bg }}
      className={cn(
        "rounded-full flex items-center justify-center font-black text-white select-none shrink-0 font-mono",
        size === "md" ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs"
      )}>
      {letter}
    </div>
  );
};

// Arcane crystal icon — same as student screen
const CrystalIcon = ({ className, dim = false }: { className?: string; dim?: boolean }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="12,2 20,9 12,22 4,9"
      fill={dim ? "hsl(240 20% 35%)" : "hsl(39 95% 58%)"}
      opacity={dim ? 0.35 : 0.85} />
    <polygon points="12,2 20,9 12,8 4,9"
      fill={dim ? "hsl(240 15% 55%)" : "hsl(200 100% 92%)"}
      opacity={dim ? 0.25 : 0.7} />
    <line x1="12" y1="2" x2="12" y2="8" stroke="white" strokeWidth="0.6" opacity="0.5" />
    {!dim && <circle cx="12" cy="2" r="1.2" fill="hsl(200 100% 96%)" opacity="0.9" />}
  </svg>
);

// Player card — shared cartoon asteroid surface with roster content on top.
const PlayerCard = ({ name, lives, dim = false }: { name: string; lives: number; dim?: boolean }) => (
  <AsteroidCard seed={name} dim={dim}>
    <div className="p-3 flex flex-col gap-1.5">
      <div className="flex items-center gap-2.5">
        <Avatar name={name} size="md" dim={dim} />
        <span className={cn("font-mono font-black text-xl truncate flex-1", dim ? "text-muted-foreground/50 line-through" : "text-primary")}>{name}</span>
      </div>
      {!dim ? (
        <div className="flex gap-0.5 flex-wrap">
          {Array.from({ length: Math.min(Math.max(lives ?? 1, 0), 8) }).map((_, i) => (
            <div key={i}>
              <CrystalIcon className="h-4 w-4" />
            </div>
          ))}
        </div>
      ) : (
        <CrystalIcon className="h-4 w-4" dim />
      )}
    </div>
  </AsteroidCard>
);

// Stable starfield — same seed as student screen
const STARS = Array.from({ length: 40 }, (_, i) => ({
  x:        (i * 37 + 11) % 100,
  y:        (i * 53 + 17) % 100,
  size:     1 + (i % 3),
  color:    i % 6 === 0 ? "hsl(290 80% 82%)" : i % 4 === 0 ? "hsl(200 100% 88%)" : "hsl(260 50% 92%)",
  duration: 2.5 + (i % 4) * 0.7,
  delay:    (i * 0.31) % 4,
}));

interface Props { session: any; sessionId: string; }

const TIMER_MAX_MS = 15_000;

const DodgeballMonitor = ({ session, sessionId }: Props) => {
  const nav = useNavigate();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const { i18n } = useTranslation();
  const ar = (session?.settings?.lang ?? i18n.language) === "ar";
  const [students, setStudents] = useState<any[]>([]);
  const [taps, setTaps]         = useState<any[]>([]);
  const [timerMs, setTimerMs]   = useState(0);
  const [ending, setEnding]     = useState(false);
  const timerRafRef   = useRef<number | null>(null);
  const timerStartRef = useRef<number>(0);

  const settings       = session?.settings || {};
  const timerActive: boolean       = settings.timerActive   ?? false;
  const timerRoundId: string|null  = settings.timerRoundId  ?? null;
  const timerWinnerId: string|null = settings.timerWinnerId ?? null;

  // ── Load + subscribe ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    const refresh = async () => {
      const [{ data: ss }, tapResult] = await Promise.all([
        supabase.from("game_students").select("*").eq("session_id", sessionId).order("name"),
        timerRoundId
          ? supabase.from("dodgeball_timer_taps").select("*").eq("session_id", sessionId).eq("timer_round_id", timerRoundId).order("elapsed_ms")
          : Promise.resolve({ data: [] }),
      ]);
      setStudents(ss ?? []);
      setTaps((tapResult as any)?.data ?? []);
    };
    refresh();
    const ch = supabase.channel(`db-monitor-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_students", filter: `session_id=eq.${sessionId}` }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dodgeball_timer_taps", filter: `session_id=eq.${sessionId}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, timerRoundId]);

  useEffect(() => {
    if (!timerRoundId) { setTaps([]); return; }
    supabase.from("dodgeball_timer_taps").select("*")
      .eq("session_id", sessionId).eq("timer_round_id", timerRoundId).order("elapsed_ms")
      .then(({ data }) => setTaps(data ?? []));
  }, [timerRoundId, sessionId]);

  // ── Live timer RAF ────────────────────────────────────────────────────────
  useEffect(() => {
    if (timerActive && settings.timerStartedAt) {
      timerStartRef.current = new Date(settings.timerStartedAt).getTime();
      const tick = () => {
        const elapsed = Date.now() - timerStartRef.current;
        setTimerMs(elapsed);
        if (elapsed < TIMER_MAX_MS) {
          timerRafRef.current = requestAnimationFrame(tick);
        } else {
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

  // ── Auto-end when 1 alive ─────────────────────────────────────────────────
  useEffect(() => {
    const alive = students.filter(s => !s.eliminated);
    if (alive.length === 1 && students.length > 1 && session?.status === "running" && !ending) {
      setEnding(true);
      supabase.from("game_sessions").update({ status: "finished", ended_at: new Date().toISOString() }).eq("id", sessionId);
    }
  }, [students, session, ending, sessionId]);

  const fireTimer = async () => {
    if (timerActive) return;
    const roundId = `round-${Date.now()}`;
    await supabase.from("game_sessions").update({
      settings: { ...settings, timerActive: true, timerRoundId: roundId, timerStartedAt: new Date().toISOString(), timerWinnerId: null }
    }).eq("id", sessionId);
  };

  const endTimer = async () => {
    if (!timerActive) return;
    if (timerRafRef.current) cancelAnimationFrame(timerRafRef.current);
    const { data: latestTaps } = await supabase
      .from("dodgeball_timer_taps").select("*")
      .eq("session_id", sessionId).eq("timer_round_id", timerRoundId ?? "").order("elapsed_ms");
    const TARGET_MS = 10_000;
    let winnerId: string | null = null;
    if (latestTaps && latestTaps.length > 0) {
      const best = latestTaps.reduce((prev, cur) =>
        Math.abs(cur.elapsed_ms - TARGET_MS) < Math.abs(prev.elapsed_ms - TARGET_MS) ? cur : prev);
      winnerId = best.student_id;
      const winner = students.find(s => s.id === winnerId);
      if (winner) await supabase.from("game_students").update({ lives: (winner.lives ?? 1) + 1 }).eq("id", winnerId);
    }
    await supabase.from("game_sessions").update({
      settings: { ...settings, timerActive: false, timerRoundId, timerStartedAt: null, timerWinnerId: winnerId }
    }).eq("id", sessionId);
  };

  const endGame = async () => {
    if (!(await confirm(ar ? "إنهاء اللعبة الآن؟" : "End the game now?"))) return;
    await supabase.from("game_sessions").update({ status: "finished", ended_at: new Date().toISOString() }).eq("id", sessionId);
    nav(`/app/games/${sessionId}/results`);
  };

  const goFullscreen = () => {
    const el = document.documentElement as any;
    (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  };

  const alive      = students.filter(s => !s.eliminated);
  const eliminated = students.filter(s => s.eliminated);
  const finalRound = alive.length <= 3 && students.length > 1;
  const canFireTimer = !timerActive && alive.length > 3;
  const timerSec   = (timerMs / 1000).toFixed(2);
  const winnerName = timerWinnerId ? students.find(s => s.id === timerWinnerId)?.name : null;

  return (
    <div className="theme-dodgeball fixed inset-0 text-foreground overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 50% -10%, hsl(270 50% 14%) 0%, hsl(255 40% 7%) 55%, hsl(240 35% 5%) 100%)" }}>
      {ConfirmDialog}

      {/* Starfield — same as student screen */}
      {STARS.map((s, i) => (
        <div key={i} className="absolute rounded-full pointer-events-none"
          style={{
            left: `${s.x}%`, top: `${s.y}%`,
            width: s.size, height: s.size,
            background: s.color,
            animation: `star-twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
          }} />
      ))}

      <SpaceBackdrop />

      {/* Top bar */}
      <div className="absolute top-3 inset-x-3 z-20 flex items-center justify-between font-mono text-xs gap-3">
        <div className="text-muted-foreground">
          {ar ? "الرمز" : "CODE"} <span className="text-primary text-base font-black tracking-widest">{session.code}</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={goFullscreen} className="text-primary hover:text-primary hover:bg-primary/10">
            <Maximize className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={endGame} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-mono font-bold">
            <Square className="h-4 w-4 me-1" />{ar ? "إنهاء" : "END"}
          </Button>
        </div>
      </div>

      <div className="h-full grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 p-4 pt-14 relative">

        {/* Player grid */}
        <div className="overflow-y-auto">
          {students.length === 0 ? (
            <div className="flex items-center justify-center h-full font-mono text-2xl text-primary animate-pulse">
              {ar ? "> في انتظار اللاعبين..." : "> WAITING FOR PLAYERS..."}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {alive.map(s => (
                <PlayerCard key={s.id} name={s.name} lives={s.lives ?? 1} />
              ))}
              {eliminated.map(s => (
                <PlayerCard key={s.id} name={s.name} lives={0} dim />
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4 overflow-hidden">

          {/* Timer panel */}
          <div className="rounded-2xl p-5 transition-all"
            style={{
              background: timerActive ? "hsl(255 45% 11% / 0.9)" : "hsl(255 40% 8% / 0.7)",
              backdropFilter: "blur(6px)",
            }}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-xs text-muted-foreground flex items-center gap-2">
                <Timer className="h-3 w-3" /> {ar ? "تحدي المؤقت" : "TIMER CHALLENGE"}
              </span>
              {timerActive && <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
            </div>

            {timerActive ? (
              <div className="space-y-3">
                {(() => {
                  const arcPct   = Math.min(100, (timerMs / 10_000) * 100);
                  const arcColor = timerMs < 9_000 ? "hsl(220 20% 97%)"
                    : timerMs <= 10_500 ? "hsl(140 100% 55%)" : "hsl(0 90% 60%)";
                  const circ = 376.99; // 2π × 60
                  // Rune ticks matching student STOP button
                  const ticks = Array.from({ length: 12 }, (_, i) => {
                    const ang = (i / 12) * Math.PI * 2 - Math.PI / 2;
                    const ri = 54, ro = 62;
                    return {
                      x1: 70 + ri * Math.cos(ang), y1: 70 + ri * Math.sin(ang),
                      x2: 70 + ro * Math.cos(ang), y2: 70 + ro * Math.sin(ang),
                      major: i % 3 === 0,
                    };
                  });
                  return (
                    <div className="relative flex items-center justify-center my-1">
                      <svg width="140" height="140" viewBox="0 0 140 140">
                        <circle cx="70" cy="70" r="64" fill="none" stroke={arcColor} strokeWidth="1" opacity="0.1" />
                        {ticks.map((t, i) => (
                          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
                            stroke={arcColor} strokeWidth={t.major ? 2 : 1}
                            opacity={t.major ? 0.65 : 0.28} strokeLinecap="round" />
                        ))}
                        <circle cx="70" cy="70" r="60" fill="none" stroke={`${arcColor}20`} strokeWidth="6" />
                        <circle cx="70" cy="70" r="60" fill="none"
                          stroke={arcColor} strokeWidth="6"
                          strokeDasharray={circ}
                          strokeDashoffset={circ - (arcPct / 100) * circ}
                          strokeLinecap="round"
                          transform="rotate(-90 70 70)"
                          style={{ transition: "stroke-dashoffset 0.05s linear, stroke 0.25s ease" }} />
                        <circle cx="70" cy="70" r="3" fill={arcColor} opacity="0.2" />
                      </svg>
                      <div className="absolute text-center">
                        <div className="font-mono font-black text-3xl tabular-nums leading-none"
                          style={{ color: arcColor }}>
                          {timerSec}s
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono mt-1">{ar ? "الهدف ١٠ث" : "TARGET 10s"}</div>
                      </div>
                    </div>
                  );
                })()}
                <div className="text-center text-xs text-muted-foreground font-mono">
                  {ar ? `${taps.length} نقرة وردت` : `${taps.length} tap${taps.length !== 1 ? "s" : ""} in`}
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {taps.map(tap => {
                    const name = students.find(s => s.id === tap.student_id)?.name ?? "?";
                    const diff = Math.abs(tap.elapsed_ms - 10_000);
                    return (
                      <div key={tap.id} className="flex items-center justify-between font-mono text-xs">
                        <span className="text-primary/80 truncate max-w-[80px]">{name}</span>
                        <span className="text-muted-foreground tabular-nums">{(tap.elapsed_ms / 1000).toFixed(2)}s</span>
                        <span className={cn("font-bold tabular-nums",
                          diff < 500 ? "text-green-400" : diff < 1500 ? "text-yellow-400" : "text-primary/40")}>
                          +/-{(diff / 1000).toFixed(2)}s
                        </span>
                      </div>
                    );
                  })}
                </div>
                <Button onClick={endTimer} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-mono font-bold">
                  {ar ? "إنهاء المؤقت" : "END TIMER"}
                </Button>
              </div>
            ) : winnerName ? (
              <div className="text-center space-y-2">
                <Trophy className="h-10 w-10 mx-auto text-amber-400" />
                <div className="font-mono font-black text-xl text-primary">{winnerName}</div>
                <div className="text-xs text-muted-foreground font-mono">{ar ? "فاز بجولة المؤقت — بلورة إضافية" : "won the timer round — +1 crystal"}</div>
                <Button onClick={fireTimer} disabled={!canFireTimer}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-mono font-bold disabled:opacity-35">
                  <Zap className="h-4 w-4 me-1" />
                  {canFireTimer ? (ar ? "إطلاق المؤقت" : "FIRE TIMER") : finalRound ? (ar ? "معطل (الجولة الأخيرة)" : "DISABLED (FINAL ROUND)") : (ar ? "يلزم أكثر من ٣ أحياء" : "NEED > 3 ALIVE")}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground font-mono">
                  {alive.length <= 3 ? (ar ? "الجولة الأخيرة — المؤقت معطل" : "Final round — timer disabled") : (ar ? "أطلق تحدي مؤقت مفاجئ" : "Launch a surprise timer challenge")}
                </div>
                <Button onClick={fireTimer} disabled={!canFireTimer}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-mono font-bold disabled:opacity-35">
                  <Zap className="h-4 w-4 me-1" />
                  {canFireTimer ? (ar ? "إطلاق المؤقت" : "FIRE TIMER") : finalRound ? (ar ? "معطل (الجولة الأخيرة)" : "DISABLED (FINAL ROUND)") : (ar ? "يلزم أكثر من ٣ أحياء" : "NEED > 3 ALIVE")}
                </Button>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="rounded-2xl p-4 flex items-center justify-around font-mono"
            style={{ background: "hsl(255 40% 8% / 0.7)", backdropFilter: "blur(6px)" }}>
            <div className="text-center">
              <div className="text-3xl font-black text-primary tabular-nums">{alive.length}</div>
              <div className="text-[10px] tracking-widest text-muted-foreground uppercase">{ar ? "أحياء" : "Alive"}</div>
            </div>
            <div className="h-10 w-px bg-border" />
            <div className="text-center">
              <div className="text-3xl font-black text-muted-foreground tabular-nums">{eliminated.length}</div>
              <div className="text-[10px] tracking-widest text-muted-foreground uppercase">{ar ? "خارج" : "Out"}</div>
            </div>
            <div className="h-10 w-px bg-border" />
            <div className="text-center">
              <div className="text-3xl font-black text-primary tabular-nums">{students.length}</div>
              <div className="text-[10px] tracking-widest text-muted-foreground uppercase">{ar ? "الإجمالي" : "Total"}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DodgeballMonitor;
