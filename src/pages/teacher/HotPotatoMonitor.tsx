import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Square, Maximize, Trophy } from "lucide-react";
import { BombIcon } from "@/components/BombIcon";

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
      className="h-10 w-10 rounded-full flex items-center justify-center font-black text-white text-sm select-none shrink-0 font-mono">
      {letter}
    </div>
  );
};


// Shared metal panel style — matches student screen
const metalPanel = {
  background: "linear-gradient(180deg, hsl(210 20% 14%), hsl(210 18% 10%))",
  border: "1.5px solid hsl(210 20% 22%)",
  boxShadow: "inset 0 1.5px 0 hsl(210 18% 30%), inset 0 -1px 0 hsl(210 15% 6%), 0 4px 14px hsl(0 0% 0% / 0.4)",
};

const GUN_BG = "radial-gradient(ellipse at 30% 10%, hsl(210 28% 11%) 0%, hsl(210 22% 7%) 55%, hsl(210 18% 5%) 100%)";
const PCB_GREEN = "hsl(71 48% 47%)";

interface Props { session: any; sessionId: string; }

const randomBombMs = () => 30_000 + Math.random() * 60_000;

const HotPotatoMonitor = ({ session, sessionId }: Props) => {
  const nav = useNavigate();
  const { i18n } = useTranslation();
  const ar = (session?.settings?.lang ?? i18n.language) === "ar";
  const [students, setStudents] = useState<any[]>([]);
  const [explosionFeed, setExplosionFeed] = useState<{ name: string; at: string }[]>([]);
  const [now, setNow] = useState(Date.now());
  const [ending, setEnding] = useState(false);

  const lastProcessedExplosionRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const studentsRef = useRef<any[]>([]);
  const sessionRef = useRef<any>(null);
  studentsRef.current = students;
  sessionRef.current = session;

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
  const critical  = left < 30 && left > 0;

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

  // ── Bomb initialization ───────────────────────────────────────────────────
  useEffect(() => {
    if (initializedRef.current) return;
    if (session?.status !== "running") return;
    if (students.length === 0) return;
    if (settings.bombHolderId) { initializedRef.current = true; return; }
    initializedRef.current = true;
    const holder = students[Math.floor(Math.random() * students.length)];
    const expiresAt = new Date(Date.now() + randomBombMs()).toISOString();
    supabase.from("game_sessions").update({
      settings: { ...settings, bombHolderId: holder.id, bombExplodesAt: expiresAt }
    }).eq("id", sessionId).then(undefined, () => {});
  }, [session?.status, students.length]);

  // ── Bomb explosion detection ──────────────────────────────────────────────
  useEffect(() => {
    if (!bombExplodesAt || !bombHolderId) return;
    if (session?.status !== "running") return;
    if (new Date(bombExplodesAt).getTime() > Date.now()) return;
    if (lastProcessedExplosionRef.current === bombExplodesAt) return;
    lastProcessedExplosionRef.current = bombExplodesAt;

    const triggerExplosion = async () => {
      try {
        const { data: fresh } = await supabase.from("game_sessions")
          .select("settings").eq("id", sessionId).single();
        const live = (fresh?.settings ?? settings) as Record<string, any>;
        const victim = studentsRef.current.find((s: any) => s.id === bombHolderId);
        if (!victim) return;
        const newCount = (live.explosionCount ?? 0) + 1;
        const ts = new Date().toISOString();
        await supabase.from("game_students").update({ crypto: 0 }).eq("id", bombHolderId);
        setExplosionFeed(prev => [{ name: victim.name, at: ts }, ...prev].slice(0, 8));
        if (newCount >= (live.maxExplosions ?? maxExplosions) || left <= 0) {
          await supabase.from("game_sessions").update({
            status: "finished", ended_at: ts,
            settings: { ...live, explosionCount: newCount, lastExplosionAt: ts, lastExplosionVictimId: bombHolderId },
          }).eq("id", sessionId);
          return;
        }
        const others = studentsRef.current.filter((s: any) => s.id !== bombHolderId);
        const nextHolder = others.length > 0 ? others[Math.floor(Math.random() * others.length)] : victim;
        const nextAt = new Date(Date.now() + randomBombMs()).toISOString();
        await supabase.from("game_sessions").update({
          settings: { ...live, bombHolderId: nextHolder.id, bombExplodesAt: nextAt, explosionCount: newCount, lastExplosionAt: ts, lastExplosionVictimId: bombHolderId },
        }).eq("id", sessionId);
      } catch (err) {
        console.error("triggerExplosion:", err);
        lastProcessedExplosionRef.current = null;
      }
    };
    triggerExplosion();
  }, [now, bombExplodesAt, bombHolderId]);

  // ── Auto-end: time up ─────────────────────────────────────────────────────
  useEffect(() => {
    const sess = sessionRef.current;
    if (!sess || sess.status !== "running") return;
    if (!startedAt) return;
    if (left === 0 && !ending) {
      setEnding(true);
      supabase.from("game_sessions").update({ status: "finished", ended_at: new Date().toISOString() }).eq("id", sessionId);
    }
  }, [left, startedAt, sessionId, ending]);

  const endNow = async () => {
    if (!session) return;
    if (!confirm(ar ? "إنهاء اللعبة الآن؟" : "End the game now?")) return;
    await supabase.from("game_sessions").update({ status: "finished", ended_at: new Date().toISOString() }).eq("id", session.id);
    nav(`/app/games/${session.id}/results`);
  };

  const goFullscreen = () => {
    const el = document.documentElement as any;
    (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  };

  const bombHolder   = students.find(s => s.id === bombHolderId);
  const fuseMs       = bombExplodesAt ? Math.max(0, new Date(bombExplodesAt).getTime() - now) : 0;
  const fusePct      = bombExplodesAt ? Math.min(100, (fuseMs / 90_000) * 100) : 100;
  // PCB green → muted amber as the bomb ticks down
  const fuseColor    = fuseMs > 30_000 ? PCB_GREEN : fuseMs > 12_000 ? "hsl(42 55% 58%)" : "hsl(32 62% 58%)";
  const fuseCritical = fuseMs < 10_000 && fuseMs > 0;

  // ── GAME OVER ─────────────────────────────────────────────────────────────
  if (session?.status === "finished") {
    const top3 = students.slice(0, 3);
    const podiumColors = ["hsl(210 20% 72%)", PCB_GREEN, "hsl(25 80% 52%)"];
    const podiumOrder  = [top3[1], top3[0], top3[2]];
    const podiumHeights = ["h-20", "h-28", "h-16"];
    const podiumRanks   = [2, 1, 3];
    return (
      <div className="theme-hotpotato fixed inset-0 flex flex-col items-center justify-center gap-8 overflow-hidden"
        style={{ background: GUN_BG, fontFamily: "monospace" }}>
        <div className="pcb-trace-bg pointer-events-none absolute inset-0 z-0" />
        <div className="relative z-10 text-center">
          <BombIcon className="h-20 w-20 mx-auto mb-4" sparks />
          <div className="text-6xl font-black tracking-widest" style={{ color: PCB_GREEN }}>
            {ar ? "انتهت اللعبة" : "GAME OVER"}
          </div>
        </div>
        {top3.length > 0 && (
          <div className="relative z-10 flex gap-4 items-end">
            {podiumOrder.map((s, idx) => {
              if (!s) return <div key={idx} className="w-28" />;
              return (
                <div key={s.id} className="flex flex-col items-center gap-2">
                  <span className="font-mono font-black text-sm truncate max-w-[80px] text-center"
                    style={{ color: podiumColors[idx] }}>{s.name}</span>
                  <div className="text-xs font-mono tabular-nums" style={{ color: podiumColors[idx] }}>
                    {fmt(s.crypto ?? 0)}
                  </div>
                  <div className={cn("w-24 rounded-t-xl flex items-center justify-center font-black text-2xl", podiumHeights[idx])}
                    style={{ background: `${podiumColors[idx]}22`, border: `2px solid ${podiumColors[idx]}66` }}>
                    {podiumRanks[idx]}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <Button onClick={() => nav(`/app/games/${session.id}/results`)}
          className="relative z-10 text-lg px-10 py-5 font-mono font-bold"
          style={{ background: PCB_GREEN, color: "hsl(210 22% 7%)" }}>
          <Trophy className="h-5 w-5 me-2" /> {ar ? "عرض النتائج الكاملة" : "View Full Results"}
        </Button>
      </div>
    );
  }

  // ── RUNNING ───────────────────────────────────────────────────────────────
  return (
    <div className="theme-hotpotato fixed inset-0 flex flex-col text-foreground overflow-hidden"
      style={{ background: GUN_BG, fontFamily: "monospace" }}>

      <div className="pcb-trace-bg pointer-events-none absolute inset-0 z-0" />

      {/* Header — metal panel bar */}
      <header className="relative z-20 flex items-center gap-3 px-4 pt-3 pb-2 shrink-0"
        style={{ ...metalPanel, borderRadius: 0, borderLeft: "none", borderRight: "none", borderTop: "none" }}>

        {/* Left: session code + explosion count */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-muted-foreground font-mono text-sm whitespace-nowrap">
            {ar ? "الرمز" : "CODE"} <span className="font-black tracking-widest text-base" style={{ color: PCB_GREEN }}>{session?.code}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-sm whitespace-nowrap"
            style={{ background: "hsl(71 48% 47% / 0.08)", border: "1px solid hsl(71 48% 47% / 0.3)" }}>
            <BombIcon className="h-3.5 w-3.5 shrink-0" style={{ color: PCB_GREEN }} />
            <span className="font-bold tabular-nums" style={{ color: PCB_GREEN }}>{explosionCount}</span>
            <span className="text-muted-foreground">/ {maxExplosions}</span>
          </div>
        </div>

        {/* Center: countdown timer */}
        <div className="flex-1 flex justify-center">
          <div className="px-5 py-1.5 rounded-xl font-mono font-black text-3xl tabular-nums tracking-widest"
            style={{
              background: "hsl(210 22% 6%)",
              border: `2px solid ${critical ? "hsl(32 45% 42%)" : "hsl(210 20% 22%)"}`,
              color: critical ? "hsl(32 62% 66%)" : "hsl(210 10% 82%)",
              boxShadow: "inset 0 1px 0 hsl(210 18% 26%), 0 4px 14px hsl(0 0% 0% / 0.4)",
            }}>
            {mm}:{ss}
          </div>
        </div>

        {/* Right: controls */}
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="ghost" onClick={goFullscreen} className="text-muted-foreground hover:text-foreground">
            <Maximize className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={endNow}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-mono font-bold">
            <Square className="h-4 w-4 me-1" />{ar ? "إنهاء" : "END"}
          </Button>
        </div>
      </header>

      {/* Main grid */}
      <div className="relative z-10 flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 px-4 pb-4 pt-3">

        {/* ── LEADERBOARD ── */}
        <div className="space-y-1.5 overflow-hidden flex flex-col">
          {students.length === 0 ? (
            <div className="flex-1 flex items-center justify-center font-mono text-2xl animate-pulse"
              style={{ color: PCB_GREEN }}>{ar ? "> في انتظار اللاعبين..." : "> WAITING FOR PLAYERS..."}</div>
          ) : (
            students.slice(0, 9).map((s, i) => {
              const isBomb  = s.id === bombHolderId;
              const isFirst = i === 0;
              const rowStyle = isFirst
                ? { ...metalPanel, border: `1.5px solid hsl(71 48% 47% / 0.45)` }
                : metalPanel;
              return (
                <div key={s.id}
                  className="rounded-xl px-4 py-2.5 flex items-center gap-3 transition-all duration-500"
                  style={rowStyle}>
                  <span className="font-mono font-black text-lg w-8 shrink-0 tabular-nums"
                    style={{ color: isFirst ? PCB_GREEN : "hsl(210 10% 38%)" }}>
                    {i + 1}
                  </span>
                  <Avatar name={s.name} />
                  <span className="font-mono text-lg font-bold flex-1 truncate"
                    style={{ color: isFirst ? "hsl(210 10% 92%)" : "hsl(210 10% 72%)" }}>
                    {s.name}
                  </span>
                  {isBomb && <BombIcon className="h-6 w-6 shrink-0" burn={fusePct / 100} />}
                  <span className="font-mono text-lg font-black tabular-nums shrink-0"
                    style={{ color: isFirst ? PCB_GREEN : "hsl(210 10% 50%)" }}>
                    {fmt(s.crypto ?? 0)}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="grid grid-rows-[auto_1fr] gap-4 overflow-hidden">

          {/* Bomb holder card — no fuse bar */}
          <div className="rounded-2xl p-4" style={metalPanel}>
            <div className="text-xs font-mono tracking-widest uppercase mb-3" style={{ color: "hsl(210 10% 40%)" }}>
              {ar ? "حامل القنبلة" : "Bomb Holder"}
            </div>
            {bombHolder ? (
              <div className="flex items-center gap-3">
                <BombIcon sparks burn={fusePct / 100} className={cn("h-10 w-10 shrink-0", fuseCritical && "animate-fuse-critical")}
                  style={{ color: fuseColor }} />
                <div className="flex-1 min-w-0">
                  <div className="font-black text-xl truncate" style={{ color: fuseColor }}>{bombHolder.name}</div>
                  <div className="text-sm font-mono tabular-nums mt-0.5 font-bold" style={{ color: fuseColor }}>
                    {ar ? `${Math.ceil(fuseMs / 1000)} ث متبقية` : `${Math.ceil(fuseMs / 1000)}s remaining`}
                  </div>
                </div>
                {/* Countdown ring */}
                <svg width="52" height="52" viewBox="0 0 48 48" className="shrink-0">
                  <circle cx="24" cy="24" r="20" fill="none" stroke="hsl(210 20% 20%)" strokeWidth="3.5" />
                  <circle cx="24" cy="24" r="20" fill="none" stroke={fuseColor} strokeWidth="3.5"
                    strokeDasharray="125.66"
                    strokeDashoffset={125.66 * (1 - fusePct / 100)}
                    strokeLinecap="round"
                    transform="rotate(-90 24 24)"
                    style={{ transition: "stroke-dashoffset 0.4s linear" }} />
                </svg>
              </div>
            ) : (
              <div className="font-mono text-sm animate-pulse" style={{ color: "hsl(210 10% 38%)" }}>{ar ? "جارٍ التعيين..." : "Assigning..."}</div>
            )}
          </div>

          {/* Blast log */}
          <div className="rounded-2xl p-4 overflow-hidden flex flex-col" style={metalPanel}>
            <div className="font-mono text-xs mb-3 flex items-center justify-between uppercase tracking-widest"
              style={{ color: "hsl(210 10% 42%)" }}>
              <span>{ar ? "سجل الانفجارات" : "Blast Log"}</span>
              <div className="flex items-center gap-1.5">
                <span className="tabular-nums font-bold" style={{ color: PCB_GREEN }}>{explosionCount}</span>
                <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: PCB_GREEN }} />
              </div>
            </div>

            <div className="flex-1 overflow-hidden space-y-2">
              {explosionFeed.length === 0 ? (
                <div className="font-mono text-sm pt-1" style={{ color: "hsl(210 10% 28%)" }}>
                  {ar ? "> في انتظار أول انفجار..." : "> awaiting first explosion..."}
                </div>
              ) : (
                explosionFeed.map((e) => (
                  <div key={e.at}
                    className="animate-blast-in flex items-center gap-2.5 px-2.5 py-2 rounded-lg"
                    style={{ background: "hsl(210 18% 12% / 0.7)", border: "1px solid hsl(210 20% 22%)" }}>
                    <BombIcon className="h-4 w-4 shrink-0" style={{ color: "hsl(210 10% 62%)" }} />
                    <span className="font-mono text-sm">
                      <span className="font-black" style={{ color: "hsl(210 12% 88%)" }}>{e.name}</span>
                      <span className="text-muted-foreground">{ar ? " — انفجرت" : " — wiped"}</span>
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Bottom stats */}
            <div className="mt-3 pt-3 grid grid-cols-2 gap-3"
              style={{ borderTop: "1px solid hsl(210 20% 18%)" }}>
              <div>
                <div className="text-xs font-mono mb-0.5 uppercase tracking-widest" style={{ color: "hsl(210 10% 40%)" }}>{ar ? "أعلى نتيجة" : "Top Score"}</div>
                <div className="font-mono font-black text-xl tabular-nums" style={{ color: PCB_GREEN }}>
                  {fmt(Math.max(...students.map(s => s.crypto ?? 0), 0))}
                </div>
              </div>
              <div>
                <div className="text-xs font-mono mb-0.5 uppercase tracking-widest" style={{ color: "hsl(210 10% 40%)" }}>{ar ? "اللاعبون" : "Players"}</div>
                <div className="font-mono font-black text-xl tabular-nums" style={{ color: "hsl(210 10% 72%)" }}>
                  {students.length}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HotPotatoMonitor;
