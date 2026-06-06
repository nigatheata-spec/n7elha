import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Bitcoin, Square, Maximize, ArrowRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import DodgeballMonitor from "./DodgeballMonitor";
import HotPotatoMonitor from "./HotPotatoMonitor";
import LavaFloorMonitor from "./LavaFloorMonitor";

const fmt = (n: number) => n.toLocaleString();

const ord = (n: number) => {
  const s = ["th","st","nd","rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const GREEN = "hsl(120 100% 55%)";
const GREEN_DIM = "hsl(120 60% 38%)";
const GREEN_FAINT = "hsl(120 40% 22%)";

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
        supabase.from("hack_events").select("*").eq("session_id", sessionId).order("created_at", { ascending: false }).limit(12),
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

  useEffect(() => {
    if (!session) return;
    const mode = session.settings?.mode;
    if (mode === "hotpotato" || mode === "dodgeball" || mode === "lavafloor") return;
    if (session.status === "finished") nav(`/app/games/${session.id}/results`, { replace: true });
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

  if (!session) return (
    <div style={{ background: "#050505", color: GREEN }} className="fixed inset-0 flex items-center justify-center font-mono text-sm">
      {">"} initializing...
    </div>
  );

  if (session.settings?.mode === "dodgeball") return <DodgeballMonitor session={session} sessionId={sessionId!} />;
  if (session.settings?.mode === "hotpotato") return <HotPotatoMonitor session={session} sessionId={sessionId!} />;
  if (session.settings?.mode === "lavafloor") return <LavaFloorMonitor session={session} sessionId={sessionId!} />;

  const mm = left != null ? String(Math.floor(left / 60)).padStart(2, "0") : null;
  const ss_str = left != null ? String(left % 60).padStart(2, "0") : null;

  return (
    <div
      className="fixed inset-0 overflow-hidden font-mono flex flex-col"
      style={{ background: "#050505", color: GREEN }}
    >
      {/* dim pixel-art hacker bg */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: "url(/leaderboard-bg.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          opacity: 0.22,
          imageRendering: "pixelated",
        }}
      />
      {/* darkening + vignette overlay for contrast */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.75) 75%, rgba(0,0,0,0.92) 100%)",
        }}
      />
      {/* scanlines overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-50"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 4px)",
        }}
      />

      {/* ── TOP BAR ── */}
      <div
        className="flex items-center justify-between px-5 py-2 z-10 shrink-0"
        style={{ borderBottom: `1px solid ${GREEN_FAINT}` }}
      >
        <div style={{ color: GREEN_DIM }} className="text-xs tracking-widest uppercase">
          CODE&nbsp;<span style={{ color: GREEN }} className="text-base font-black tracking-[0.25em]">{session.code}</span>
        </div>

        {mm != null && (
          <div
            className="text-3xl font-black tabular-nums"
            style={{
              color: left != null && left < 60 ? "hsl(0 100% 60%)" : GREEN,
              textShadow: `0 0 20px ${left != null && left < 60 ? "hsl(0 100% 60% / 0.6)" : "hsl(120 100% 55% / 0.6)"}`,
            }}
          >
            {mm}:{ss_str}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={goFullscreen}
            className="text-xs px-3 py-1 border transition-colors"
            style={{ borderColor: GREEN_FAINT, color: GREEN_DIM }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = GREEN; (e.currentTarget as HTMLElement).style.color = GREEN; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = GREEN_FAINT; (e.currentTarget as HTMLElement).style.color = GREEN_DIM; }}
          >
            [ FULLSCREEN ]
          </button>
          <button
            onClick={endNow}
            className="text-xs px-3 py-1 font-bold transition-colors"
            style={{ background: "hsl(0 84% 60%)", color: "#fff" }}
          >
            [ END GAME ]
          </button>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] overflow-hidden">

        {/* LEFT — LEADERBOARD */}
        <div className="flex flex-col overflow-hidden" style={{ borderRight: `1px solid ${GREEN_FAINT}` }}>
          {/* section header */}
          <div
            className="text-xs px-5 py-2 shrink-0"
            style={{ color: GREEN_DIM, borderBottom: `1px solid ${GREEN_FAINT}` }}
          >
            $ LEADERBOARD.LIVE &nbsp;<span className="animate-pulse">█</span>
          </div>

          {/* column headers */}
          <div
            className="grid px-5 py-2 text-xs shrink-0"
            style={{
              gridTemplateColumns: "3rem 1fr auto",
              color: GREEN_DIM,
              borderBottom: `1px solid ${GREEN_FAINT}`,
              letterSpacing: "0.12em",
            }}
          >
            <span>RANK</span>
            <span>ALIAS</span>
            <span>₿ CRYPTO</span>
          </div>

          {/* rows */}
          <div className="flex-1 overflow-y-auto">
            {students.length === 0 ? (
              <div className="px-5 py-8 text-sm animate-pulse" style={{ color: GREEN_DIM }}>
                {">"} awaiting hackers...
              </div>
            ) : (
              students.map((s, i) => {
                const isFirst = i === 0;
                return (
                  <div
                    key={s.id}
                    className="grid px-5 py-3 text-sm transition-all"
                    style={{
                      gridTemplateColumns: "3rem 1fr auto",
                      borderBottom: `1px solid ${GREEN_FAINT}`,
                      background: isFirst ? "hsl(120 100% 55% / 0.04)" : "transparent",
                      color: isFirst ? GREEN : GREEN_DIM,
                    }}
                  >
                    <span
                      className="font-black"
                      style={{
                        color: isFirst ? GREEN : GREEN_DIM,
                        textShadow: isFirst ? `0 0 12px hsl(120 100% 55% / 0.5)` : "none",
                      }}
                    >
                      #{i + 1}
                    </span>
                    <span
                      className="truncate font-bold"
                      style={{
                        color: isFirst ? GREEN : "hsl(120 60% 50%)",
                        textShadow: isFirst ? `0 0 10px hsl(120 100% 55% / 0.4)` : "none",
                      }}
                    >
                      {s.name}
                    </span>
                    <span
                      className="font-black tabular-nums"
                      style={{ color: GREEN }}
                    >
                      {fmt(s.crypto ?? 0)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT — HACK LOG + STATS */}
        <div className="flex flex-col overflow-hidden">

          {/* HACK LOG */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div
              className="text-xs px-5 py-2 flex items-center justify-between shrink-0"
              style={{ color: GREEN_DIM, borderBottom: `1px solid ${GREEN_FAINT}` }}
            >
              <span>$ TAIL HACK_LOG.LIVE</span>
              <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: GREEN }} />
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
              {hacks.length === 0 ? (
                <div className="text-xs" style={{ color: GREEN_DIM }}>
                  {">"} awaiting breach events...
                </div>
              ) : (
                hacks.map((h, idx) => {
                  const hk = students.find(x => x.id === h.hacker_id)?.name ?? "?";
                  const tg = students.find(x => x.id === h.target_id)?.name ?? "?";
                  return (
                    <div
                      key={h.id}
                      className="flex items-start gap-2 text-xs leading-relaxed"
                      style={{ color: h.success ? GREEN : GREEN_DIM, opacity: 1 - idx * 0.07 }}
                    >
                      <span className="shrink-0 mt-0.5">
                        {h.success ? ">" : "✗"}
                      </span>
                      <span>
                        {h.success
                          ? <><b>{hk}</b> breached <b>{tg}</b> · stole ₿{fmt(h.crypto_transferred)}</>
                          : <><b>{hk}</b> failed to breach <b>{tg}</b></>
                        }
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* STATS BAR */}
          <div
            className="shrink-0 px-5 py-4 flex items-center justify-between"
            style={{ borderTop: `1px solid ${GREEN_FAINT}` }}
          >
            <div>
              <div className="text-xs mb-0.5" style={{ color: GREEN_DIM }}>TOTAL IN CIRCULATION</div>
              <div
                className="text-3xl font-black tabular-nums"
                style={{ color: GREEN, textShadow: `0 0 20px hsl(120 100% 55% / 0.5)` }}
              >
                ₿ {fmt(totalCrypto)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs" style={{ color: GREEN_DIM }}>{students.length} HACKERS ONLINE</div>
              {cap != null && (
                <div className="text-xs mt-0.5" style={{ color: reachedCap ? GREEN : GREEN_DIM }}>
                  GOAL: ₿{fmt(cap)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default GameMonitor;
