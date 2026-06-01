import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Square, Maximize, Flame, Shield, Trophy, Check, X } from "lucide-react";

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
    <div style={{ background: bg }}
      className="h-10 w-10 rounded-full flex items-center justify-center font-black text-white text-sm select-none shrink-0 ring-2 ring-white/10">
      {letter}
    </div>
  );
};

// Lava column wave path — narrower amplitude to fit tube
const TUBE_WAVE = "M0,14 C75,0 225,28 300,14 C375,0 525,28 600,14 C675,0 825,28 900,14 C975,0 1125,28 1200,14 C1275,0 1425,28 1500,14 C1575,0 1725,28 1800,14 C1875,0 2025,28 2100,14 C2175,0 2325,28 2400,14 L2400,40 L0,40 Z";

// Pre-computed ember positions around the lava tube
const TUBE_EMBERS = [
  { offX: -8,  delay: 0,    dur: 1.8, size: 3 },
  { offX:  12, delay: 0.7,  dur: 2.2, size: 2 },
  { offX:  28, delay: 1.3,  dur: 1.6, size: 3 },
  { offX: -14, delay: 0.4,  dur: 2.0, size: 2 },
  { offX:  42, delay: 1.0,  dur: 1.9, size: 2 },
];

const WRONG_PENALTY   = 1;
const BRICK_LAVA_RATE = WRONG_PENALTY * 2 / 5;

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
  const tubeRef        = useRef<HTMLDivElement>(null);

  const settings  = session?.settings ?? {};
  const lavaRate  = settings.lavaRate ?? 0.08;
  const minutes   = settings.minutes ?? 8;
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
      const { data: rows } = await supabase.from("game_students").select("*")
        .eq("session_id", sessionId).order("crypto", { ascending: false });
      const loaded = rows ?? [];
      setStudents(loaded);
      const totalWrong       = loaded.reduce((a, s) => a + (s.hacks_received ?? 0), 0);
      const totalBricksSpent = loaded.reduce((a, s) => a + (s.hacks_made ?? 0), 0);
      const deltaWrong  = totalWrong       - prevTotals.current.wrong;
      const deltaBricks = totalBricksSpent - prevTotals.current.bricksSpent;
      if (deltaWrong  > 0) lavaRef.current = Math.min(100, lavaRef.current + deltaWrong  * WRONG_PENALTY);
      if (deltaBricks > 0) lavaRef.current = Math.max(0,   lavaRef.current - deltaBricks * BRICK_LAVA_RATE);
      prevTotals.current = { wrong: totalWrong, bricksSpent: totalBricksSpent };
    };
    refresh();
    const ch = supabase.channel(`lf-monitor-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_sessions",  filter: `id=eq.${sessionId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_students",  filter: `session_id=eq.${sessionId}` }, refresh)
      .subscribe();
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => { supabase.removeChannel(ch); clearInterval(tick); };
  }, [sessionId]);

  // ── Restore lava from saved state ────────────────────────────────────────
  useEffect(() => {
    if (initializedRef.current || session?.status !== "running") return;
    initializedRef.current = true;
    const saved  = settings.lavaLevel ?? 0;
    const snapAt = settings.lavaSnapshotAt;
    lavaRef.current = snapAt
      ? Math.min(100, saved + (Date.now() - new Date(snapAt).getTime()) / 1000 * lavaRate)
      : saved;
  }, [session?.status, settings.lavaLevel]);

  // ── Lava natural rise ─────────────────────────────────────────────────────
  useEffect(() => {
    if (session?.status !== "running") return;
    const t = setInterval(() => {
      lavaRef.current = Math.min(100, lavaRef.current + lavaRate * 0.5);
      const n = Date.now();
      if (n - dbWriteRef.current >= 3000) {
        dbWriteRef.current = n;
        supabase.from("game_sessions").update({
          settings: { ...settings, lavaLevel: lavaRef.current, lavaSnapshotAt: new Date().toISOString() }
        }).eq("id", sessionId).catch(() => {});
      }
      if (lavaRef.current >= 100 && !ending) {
        setEnding(true);
        supabase.from("game_sessions").update({
          status: "finished", ended_at: new Date().toISOString(),
          settings: { ...settings, lavaLevel: 100, lavaWon: false },
        }).eq("id", sessionId).catch(() => {});
      }
      setNow(Date.now());
    }, 500);
    return () => clearInterval(t);
  }, [session?.status, lavaRate, ending]);

  // ── Timer end → class wins ────────────────────────────────────────────────
  useEffect(() => {
    if (!session || session.status !== "running" || left !== 0 || ending) return;
    setEnding(true);
    supabase.from("game_sessions").update({
      status: "finished", ended_at: new Date().toISOString(),
      settings: { ...settings, lavaWon: true },
    }).eq("id", sessionId).catch(() => {});
  }, [left, session, ending]);

  // ── Navigate to results ───────────────────────────────────────────────────
  useEffect(() => {
    if (session?.status === "finished")
      nav(`/app/games/${session.id}/results`, { replace: true });
  }, [session?.status]);

  const endNow = async () => {
    if (!session || !confirm("End the game now?")) return;
    await supabase.from("game_sessions").update({
      status: "finished", ended_at: new Date().toISOString(),
      settings: { ...settings, lavaWon: lavaRef.current < 100 },
    }).eq("id", sessionId);
    nav(`/app/games/${session.id}/results`);
  };

  const spikeLava = async () => {
    if (spiking) return;
    setSpiking(true);
    lavaRef.current = Math.min(100, lavaRef.current + 10);
    await supabase.from("game_sessions").update({
      settings: { ...settings, lavaLevel: lavaRef.current, lavaSnapshotAt: new Date().toISOString() }
    }).eq("id", sessionId).catch(() => {});
    setTimeout(() => setSpiking(false), 1500);
  };

  const goFullscreen = () => {
    const el = document.documentElement as any;
    (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  };

  const lavaDisplay = Math.min(100, lavaRef.current);
  const lavaPct     = `${lavaDisplay.toFixed(1)}%`;
  const danger      = lavaDisplay >= 65;
  const critical    = lavaDisplay >= 85;
  const totalBricks = students.reduce((a, s) => a + (s.crypto ?? 0), 0);
  const totalCorrect= students.reduce((a, s) => a + (s.correct_answers ?? 0), 0);

  return (
    <div className="theme-lavafloor fixed inset-0 text-foreground overflow-hidden"
      style={{ fontFamily: "'JetBrains Mono', monospace", background: "radial-gradient(ellipse at 50% 120%, hsl(14 70% 8%) 0%, hsl(0 0% 4%) 58%)" }}>

      {/* ── Volcanic noise texture ─────────────────────────────────────── */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
        <filter id="mnoise"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
        <rect width="100%" height="100%" filter="url(#mnoise)" />
      </svg>

      {/* ── Bottom lava ambient glow ───────────────────────────────────── */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none transition-all duration-700"
        style={{ height: `${Math.min(45, lavaDisplay * 0.55)}%`, background: "linear-gradient(to top, hsl(14 90% 16% / 0.55), transparent)" }} />

      {/* ── Critical danger flash ──────────────────────────────────────── */}
      {critical && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "hsl(0 90% 45% / 0.05)", animation: "heat-flicker 1.1s ease-in-out infinite" }} />
      )}

      {/* ── TOP BAR ───────────────────────────────────────────────────── */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center px-5 py-3 gap-4"
        style={{
          borderBottom: `1px solid hsl(14 ${danger ? 80 : 30}% ${danger ? 35 : 16}% / ${danger ? 0.5 : 0.3})`,
          background: "hsl(0 0% 4% / 0.88)",
          backdropFilter: "blur(12px)",
          transition: "border-color 0.4s",
        }}>

        {/* Code + lava level */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[9px] tracking-[0.45em] uppercase" style={{ color: "hsl(14 40% 42%)" }}>CODE</span>
          <span className="text-2xl font-black tracking-[0.2em]" style={{ color: "hsl(14 100% 68%)", textShadow: "0 0 20px hsl(14 100% 55% / 0.4)" }}>
            {session?.code}
          </span>
          <div className="h-5 w-px mx-1" style={{ background: "hsl(14 30% 20%)" }} />
          <span className="text-sm font-black tabular-nums" style={{ color: danger ? "hsl(14 100% 65%)" : "hsl(14 55% 48%)" }}>
            {Math.round(lavaDisplay)}% LAVA
          </span>
        </div>

        {/* Timer — center, big */}
        <div className="flex-1 flex justify-center">
          <span className="font-black text-5xl tabular-nums"
            style={{
              color: left < 30 ? "hsl(0 85% 62%)" : "hsl(142 65% 52%)",
              textShadow: left < 30 ? "0 0 28px hsl(0 85% 55% / 0.65)" : "0 0 20px hsl(142 65% 42% / 0.5)",
              transition: "color 0.5s, text-shadow 0.5s",
            }}>
            {mm}:{ss}
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={goFullscreen}
            className="p-2 rounded-lg transition-all hover:bg-white/5 active:scale-[0.97]">
            <Maximize className="h-4 w-4" style={{ color: "hsl(14 60% 50%)" }} />
          </button>
          <button onClick={endNow}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-xs transition-all active:scale-[0.97]"
            style={{ background: "hsl(0 70% 40% / 0.2)", border: "1.5px solid hsl(0 70% 50% / 0.5)", color: "hsl(0 80% 68%)" }}>
            <Square className="h-3.5 w-3.5" />END
          </button>
        </div>
      </div>

      {/* ── MAIN LAYOUT ───────────────────────────────────────────────── */}
      <div className="absolute inset-x-0 bottom-0 flex gap-4 p-4" style={{ top: "62px" }}>

        {/* LAVA TUBE COLUMN */}
        <div className="flex flex-col items-center gap-3 shrink-0" style={{ width: "112px" }}>

          {/* Tube label */}
          <span className="text-[9px] tracking-[0.45em] uppercase" style={{ color: "hsl(14 40% 42%)" }}>LAVA</span>

          {/* Tube container */}
          <div ref={tubeRef} className="flex-1 w-full relative rounded-2xl overflow-hidden"
            style={{
              border: `2px solid hsl(14 ${danger ? 80 : 40}% ${danger ? 32 : 18}% / ${danger ? 0.6 : 0.4})`,
              background: "hsl(0 0% 5%)",
              boxShadow: danger ? `0 0 28px -4px hsl(14 100% 55% / ${critical ? 0.5 : 0.25})` : "none",
              transition: "border-color 0.4s, box-shadow 0.4s",
            }}>

            {/* Lava fill — GPU translateY */}
            <div className="absolute inset-x-0 bottom-0 h-full lava-fill lava-fill-anim"
              style={{ transform: `translateY(${100 - lavaDisplay}%)`, transition: "transform 0.55s cubic-bezier(0.25,0.46,0.45,0.94)", willChange: "transform" }}>

              {/* Wave surface inside tube */}
              <div className="absolute inset-x-0 -top-7 h-10 overflow-hidden">
                <svg className="absolute top-0 left-0 h-full"
                  style={{ width: "200%", animation: "lava-wave-x 4.5s linear infinite" }}
                  viewBox="0 0 2400 40" preserveAspectRatio="none">
                  <path d={TUBE_WAVE} fill="#bf3a20" />
                </svg>
                <svg className="absolute top-1 left-0 h-full opacity-50"
                  style={{ width: "200%", animation: "lava-wave-x 3.2s linear infinite reverse" }}
                  viewBox="0 0 2400 40" preserveAspectRatio="none">
                  <path d={TUBE_WAVE} fill="#e74c3c" />
                </svg>
                <div className="absolute inset-x-0 top-0 h-px"
                  style={{ background: "hsl(35 100% 78% / 0.65)", boxShadow: "0 0 8px 2px hsl(35 100% 62% / 0.45)" }} />
              </div>

              {/* Bubbles */}
              <div className="absolute top-5 left-[20%] h-2.5 w-2.5 rounded-full bg-black/20 lava-fill-anim" />
              <div className="absolute top-9 left-[60%] h-2 w-2 rounded-full bg-black/15" style={{ animation: "lava-bubble 3s ease-in-out 1s infinite" }} />
            </div>

            {/* % readout */}
            <div className="absolute inset-x-0 top-3 flex justify-center z-10">
              <span className="font-black text-3xl tabular-nums leading-none"
                style={{
                  color: danger ? "hsl(14 100% 68%)" : "hsl(30 15% 70%)",
                  textShadow: danger ? "0 0 20px hsl(14 100% 55% / 0.7)" : "none",
                  transition: "color 0.4s",
                }}>
                {Math.round(lavaDisplay)}
              </span>
              <span className="text-xs font-bold self-end pb-1 ms-0.5" style={{ color: "hsl(30 10% 50%)" }}>%</span>
            </div>

            {/* Critical overlay */}
            {critical && (
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: "hsl(14 100% 55% / 0.08)", animation: "heat-flicker 1s ease-in-out infinite" }} />
            )}
          </div>

          {/* Ember particles around tube top */}
          {lavaDisplay > 8 && TUBE_EMBERS.map((e, i) => (
            <div key={i} className="absolute pointer-events-none rounded-full"
              style={{
                left: `calc(56px + ${e.offX}px)`,
                bottom: `calc(${lavaPct} + 3px)`,
                width:  `${e.size}px`,
                height: `${e.size}px`,
                background: i % 2 === 0 ? "#ff9000" : "#ffdd33",
                boxShadow: `0 0 ${e.size * 2}px ${i % 2 === 0 ? "#ff7700" : "#ffbb00"}`,
                animation: `ember-float ${e.dur}s ease-out ${e.delay}s infinite`,
              }} />
          ))}

          {/* Spike button */}
          <button onClick={spikeLava} disabled={spiking}
            className="w-full py-2.5 rounded-xl flex items-center justify-center gap-1.5 font-black text-xs transition-all active:scale-[0.97] disabled:opacity-50"
            style={{
              background: spiking ? "hsl(14 100% 55% / 0.22)" : "hsl(14 100% 55% / 0.1)",
              border: `1.5px solid hsl(14 100% 55% / ${spiking ? 0.7 : 0.35})`,
              color: "hsl(14 100% 68%)",
              animation: spiking ? "heat-flicker 0.6s ease-in-out infinite" : "none",
            }}>
            <Flame className="h-3.5 w-3.5" />+10%
          </button>

          <span className="text-[9px] tracking-widest text-center uppercase" style={{ color: "hsl(14 35% 38%)" }}>
            spike lava
          </span>
        </div>

        {/* RIGHT: leaderboard + stats */}
        <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-hidden">

          {/* Leaderboard */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
            {students.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <span className="font-black text-xl tracking-[0.3em]"
                  style={{ color: "hsl(14 55% 45%)", animation: "heat-flicker 2s ease-in-out infinite" }}>
                  WAITING FOR PLAYERS...
                </span>
              </div>
            ) : (
              students.map((s, i) => {
                const bricks   = s.crypto ?? 0;
                const correct  = s.correct_answers ?? 0;
                const wrong    = (s.total_answers ?? 0) - correct;
                const isTop    = i === 0;
                const lowBricks = bricks <= 4 && session?.status === "running";

                const borderColor = isTop
                  ? "hsl(142 55% 35% / 0.7)"
                  : lowBricks
                    ? "hsl(14 90% 40% / 0.65)"
                    : `hsl(14 25% ${14 + Math.max(0, 8 - i) * 1.5}% / 0.45)`;
                const bg = isTop
                  ? "hsl(142 50% 6%)"
                  : lowBricks
                    ? "hsl(14 60% 6%)"
                    : "hsl(0 0% 5%)";

                return (
                  <div key={s.id}
                    className="rounded-2xl px-5 py-3.5 flex items-center gap-4 transition-all duration-300"
                    style={{
                      background: bg,
                      border: `1.5px solid ${borderColor}`,
                      boxShadow: isTop
                        ? "0 0 28px -6px hsl(142 65% 40% / 0.35)"
                        : lowBricks
                          ? "0 0 24px -6px hsl(14 100% 55% / 0.35)"
                          : "none",
                    }}>

                    {/* Rank */}
                    <span className="font-black text-2xl w-8 shrink-0 tabular-nums"
                      style={{ color: isTop ? "hsl(142 65% 55%)" : "hsl(30 10% 35%)" }}>
                      {i + 1}
                    </span>

                    <Avatar name={s.name} />

                    {/* Name */}
                    <span className="font-black text-xl flex-1 truncate"
                      style={{ color: isTop ? "hsl(142 65% 72%)" : "hsl(30 14% 82%)" }}>
                      {s.name}
                    </span>

                    {/* Stats */}
                    <div className="flex items-center gap-4 shrink-0 text-sm font-bold tabular-nums">
                      <span className="flex items-center gap-1" style={{ color: "hsl(142 55% 55%)" }}>
                        <Check className="h-3.5 w-3.5" />{correct}
                      </span>
                      {wrong > 0 && (
                        <span className="flex items-center gap-1" style={{ color: "hsl(14 75% 56%)" }}>
                          <X className="h-3.5 w-3.5" />{wrong}
                        </span>
                      )}
                      <div className="flex items-center gap-1.5"
                        style={{ color: lowBricks ? "hsl(14 100% 62%)" : "hsl(35 100% 62%)" }}>
                        <Shield className="h-4 w-4 shrink-0" />
                        <span className="font-black text-base">{bricks}</span>
                      </div>
                      {lowBricks && (
                        <Flame className="h-4 w-4 shrink-0"
                          style={{ color: "hsl(14 100% 62%)", animation: "heat-flicker 0.75s ease-in-out infinite" }} />
                      )}
                      {isTop && (
                        <Trophy className="h-4 w-4 shrink-0"
                          style={{ color: "hsl(142 65% 52%)", filter: "drop-shadow(0 0 6px hsl(142 65% 42%))" }} />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Class stats strip */}
          <div className="shrink-0 rounded-2xl px-6 py-4 grid grid-cols-3 gap-4"
            style={{ border: "1.5px solid hsl(14 30% 16% / 0.5)", background: "hsl(0 0% 5%)" }}>
            <div className="text-center">
              <div className="font-black text-3xl tabular-nums" style={{ color: "hsl(142 65% 58%)" }}>
                {totalCorrect}
              </div>
              <div className="text-[9px] tracking-[0.4em] uppercase mt-1" style={{ color: "hsl(30 10% 38%)" }}>CORRECT</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <Shield className="h-5 w-5 shrink-0" style={{ color: "hsl(35 100% 60%)" }} />
                <span className="font-black text-3xl tabular-nums" style={{ color: "hsl(35 100% 62%)" }}>{fmt(totalBricks)}</span>
              </div>
              <div className="text-[9px] tracking-[0.4em] uppercase mt-1" style={{ color: "hsl(30 10% 38%)" }}>BRICKS</div>
            </div>
            <div className="text-center">
              <div className="font-black text-2xl"
                style={{
                  color: critical ? "hsl(0 80% 62%)" : danger ? "hsl(14 100% 65%)" : "hsl(142 65% 58%)",
                  textShadow: danger ? `0 0 18px ${critical ? "hsl(0 80% 55%)" : "hsl(14 100% 55%)"} / 0.6` : "none",
                  animation: danger ? "heat-flicker 1.5s ease-in-out infinite" : "none",
                  transition: "color 0.4s",
                }}>
                {critical ? "CRITICAL" : danger ? "DANGER" : "SAFE"}
              </div>
              <div className="text-[9px] tracking-[0.4em] uppercase mt-1" style={{ color: "hsl(30 10% 38%)" }}>STATUS</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LavaFloorMonitor;
