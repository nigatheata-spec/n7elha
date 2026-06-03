import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Bitcoin, Square, Maximize, ArrowRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import DodgeballMonitor from "./DodgeballMonitor";
import HotPotatoMonitor from "./HotPotatoMonitor";
import LavaFloorMonitor from "./LavaFloorMonitor";

const fmt = (n: number) => n.toLocaleString();

// Letter avatar (no emojis)
const AV_COLORS = ["#2563eb","#16a34a","#b45309","#dc2626","#7c3aed","#0891b2","#c2410c","#0f766e"];
const MonitorAvatar = ({ name }: { name: string }) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  const bg = AV_COLORS[Math.abs(h) % AV_COLORS.length];
  return (
    <div style={{ background: bg }}
      className="h-10 w-10 rounded-full flex items-center justify-center font-black text-white text-sm select-none shrink-0 font-mono">
      {(name.charAt(0) || "?").toUpperCase()}
    </div>
  );
};

const ord = (n: number) => {
  const s = ["th","st","nd","rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const GameMonitor = () => {
  const { sessionId } = useParams();
  const nav = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [hacks, setHacks] = useState<any[]>([]);
  const [now, setNow] = useState(Date.now());
  const [ending, setEnding] = useState(false);
  const sessionRef = useRef<any>(null);
  sessionRef.current = session;

  useEffect(() => {
    if (!sessionId) return;
    const refresh = async () => {
      const [{ data: s }, { data: ss }, { data: hs }] = await Promise.all([
        supabase.from("game_sessions").select("*, quizzes(title)").eq("id", sessionId).maybeSingle(),
        supabase.from("game_students").select("*").eq("session_id", sessionId).order("crypto", { ascending: false }),
        supabase.from("hack_events").select("*").eq("session_id", sessionId).order("created_at", { ascending: false }).limit(10),
      ]);
      setSession(s); setStudents(ss ?? []); setHacks(hs ?? []);
    };
    refresh();
    const ch = supabase.channel(`monitor-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_sessions", filter: `id=eq.${sessionId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_students", filter: `session_id=eq.${sessionId}` }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "hack_events", filter: `session_id=eq.${sessionId}` }, refresh)
      .subscribe();
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => { supabase.removeChannel(ch); clearInterval(tick); };
  }, [sessionId]);

  const totalCrypto = useMemo(() => students.reduce((a, s) => a + (s.crypto || 0), 0), [students]);
  const settings = session?.settings || {};
  const minutes: number | null = settings.minutes ?? null;
  const cap: number | null = settings.cryptoCap ?? null;
  const startedAt = session?.started_at ? new Date(session.started_at).getTime() : 0;
  const elapsed = startedAt ? Math.floor((now - startedAt) / 1000) : 0;
  const totalSecs = minutes ? minutes * 60 : 0;
  const left = minutes ? Math.max(0, totalSecs - elapsed) : null;
  const reachedCap = cap != null && totalCrypto >= cap;

  // auto-end (only for the default mode — hotpotato/dodgeball/lavafloor handle their own)
  useEffect(() => {
    const sess = sessionRef.current;
    if (!sess || sess.status !== "running") return;
    const mode = sess.settings?.mode;
    if (mode === "hotpotato" || mode === "dodgeball" || mode === "lavafloor") return;
    const timeUp = minutes != null && left === 0;
    if (timeUp || reachedCap) {
      if (ending) return;
      setEnding(true);
      supabase.from("game_sessions").update({ status: "finished", ended_at: new Date().toISOString() }).eq("id", sess.id);
    }
  }, [left, reachedCap, ending, minutes]);

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

  if (!session) return <div className="theme-game min-h-screen bg-background text-foreground flex items-center justify-center font-mono">...</div>;

  // Route to mode-specific monitor
  if (session.settings?.mode === "dodgeball") {
    return <DodgeballMonitor session={session} sessionId={sessionId!} />;
  }
  if (session.settings?.mode === "hotpotato") {
    return <HotPotatoMonitor session={session} sessionId={sessionId!} />;
  }
  if (session.settings?.mode === "lavafloor") {
    return <LavaFloorMonitor session={session} sessionId={sessionId!} />;
  }

  if (session.status === "finished") {
    nav(`/app/games/${session.id}/results`, { replace: true });
    return null;
  }

  const mm = left != null ? String(Math.floor(left / 60)).padStart(2, "0") : null;
  const ss = left != null ? String(left % 60).padStart(2, "0") : null;

  return (
    <div className="theme-game fixed inset-0 bg-background text-foreground bg-grid overflow-hidden">
      {/* Top controls */}
      <div className="absolute top-3 inset-x-3 z-20 flex items-center justify-between font-mono text-xs gap-3">
        <div className="text-muted-foreground">
          CODE <span className="text-primary text-base font-black tracking-widest">{session.code}</span>
        </div>
        {mm != null && (
          <div className="text-center text-success font-black text-3xl text-glow-cyan tabular-nums">
            {mm}:{ss}
          </div>
        )}
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={goFullscreen} className="text-success hover:text-success hover:bg-success/10">
            <Maximize className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={endNow} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-mono font-bold">
            <Square className="h-4 w-4 me-1" />END GAME
          </Button>
        </div>
      </div>

      <div className="h-full grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 p-4 pt-14">
        {/* LEADERBOARD */}
        <div className="space-y-2 overflow-hidden flex flex-col">
          {students.length === 0 ? (
            <div className="flex-1 flex items-center justify-center font-mono text-2xl text-success animate-pulse">
              {"> WAITING_FOR_HACKERS..."}
            </div>
          ) : (
            students.slice(0, 9).map((s, i) => (
              <div key={s.id} className={cn(
                "rounded-2xl border-2 px-4 py-3 flex items-center gap-3 transition-all",
                "border-success/60 bg-success/5",
                i === 0 && "border-success bg-success/10 shadow-[0_0_30px_-5px_hsl(var(--success)/0.6)]"
              )}>
                <span className="font-mono text-success font-black text-2xl w-16 shrink-0">
                  {ord(i + 1).slice(0, -2)}<sup className="text-sm">{ord(i + 1).slice(-2)}</sup>
                </span>
                <MonitorAvatar name={s.name} />
                <span className="font-mono text-success text-2xl font-bold flex-1 truncate text-glow-cyan">{s.name}</span>
                <span className="font-mono text-success text-2xl font-black tabular-nums">
                  {fmt(s.crypto)}
                </span>
              </div>
            ))
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="grid grid-rows-[1fr_auto] gap-4 overflow-hidden">
          {/* Hack feed */}
          <div className="rounded-2xl border-2 border-success/60 bg-success/5 p-4 overflow-hidden">
            <div className="font-mono text-success/80 text-xs mb-3 flex items-center justify-between">
              <span>$ TAIL HACK_LOG.LIVE</span>
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            </div>
            <div className="space-y-3 overflow-hidden">
              {hacks.length === 0 ? (
                <div className="text-success/40 font-mono text-sm">{"> awaiting breach events..."}</div>
              ) : (
                hacks.slice(0, 6).map((h) => {
                  const hk = students.find(x => x.id === h.hacker_id)?.name ?? "?";
                  const tg = students.find(x => x.id === h.target_id)?.name ?? "?";
                  return (
                    <div key={h.id} className="flex items-start gap-2 font-mono text-success text-sm leading-tight">
                      {h.success
                        ? <ArrowRight className="h-4 w-4 shrink-0 mt-0.5 text-success" />
                        : <Lock className="h-4 w-4 shrink-0 mt-0.5 text-success/40" />
                      }
                      <span className="flex-1">
                        <b>{hk}</b> {h.success ? `took ${fmt(h.crypto_transferred)} from` : `failed to hack`} <b>{tg}</b>
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Total bitcoin tile */}
          <div className="rounded-2xl border-2 border-success bg-success/10 p-4 shadow-[0_0_30px_-5px_hsl(var(--success)/0.6)]">
            <div className="flex items-center gap-3">
              <Bitcoin className="h-12 w-12 text-success text-glow-cyan" />
              <div className="font-mono text-success text-3xl md:text-4xl font-black tabular-nums truncate">
                {fmt(totalCrypto)}
              </div>
            </div>
            <div className="font-mono text-success/60 text-[10px] mt-1 text-end">
              {cap != null ? <>GOAL: {fmt(cap)} · </> : null}{students.length} HACKERS
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default GameMonitor;
