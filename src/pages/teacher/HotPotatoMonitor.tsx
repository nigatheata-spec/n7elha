import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Square, Maximize, Trophy } from "lucide-react";
import { BombIcon } from "@/components/BombIcon";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Avatar } from "@/components/Avatar";
import { isPaused } from "@/components/teacher/GameControls";
import {
  initBombs, applyPass, resolveBlasts, topUpBombs, extendFuses, pushFeed, fuseBurn,
  type Bomb, type FeedEvent, type PassRequest,
} from "@/lib/passIt";

const fmt = (n: number) => n.toLocaleString();


// Shared metal panel style — matches student screen
const metalPanel = {
  background: "linear-gradient(180deg, hsl(210 20% 14%), hsl(210 18% 10%))",
  border: "1.5px solid hsl(210 20% 22%)",
  boxShadow: "inset 0 1.5px 0 hsl(210 18% 30%), inset 0 -1px 0 hsl(210 15% 6%), 0 4px 14px hsl(0 0% 0% / 0.4)",
};

const GUN_BG = "radial-gradient(ellipse at 30% 10%, hsl(210 28% 11%) 0%, hsl(210 22% 7%) 55%, hsl(210 18% 5%) 100%)";
const PCB_GREEN = "hsl(71 48% 47%)";

interface Props { session: any; sessionId: string; }

const HotPotatoMonitor = ({ session, sessionId }: Props) => {
  const nav = useNavigate();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const { i18n } = useTranslation();
  const ar = (session?.settings?.lang ?? i18n.language) === "ar";
  const [students, setStudents] = useState<any[]>([]);
  const [now, setNow] = useState(Date.now());
  const [ending, setEnding] = useState(false);

  const studentsRef = useRef<any[]>([]);
  const sessionRef = useRef<any>(null);
  studentsRef.current = students;
  sessionRef.current = session;

  const settings        = session?.settings ?? {};
  const minutes: number = settings.minutes ?? 5;
  const savedBombs: Bomb[] = Array.isArray(settings.bombs) ? settings.bombs : [];
  const savedFeed: FeedEvent[] = Array.isArray(settings.hpFeed) ? settings.hpFeed : [];

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

  // ── Referee ───────────────────────────────────────────────────────────────
  // This screen is the only writer of the bombs (see passIt.ts). It works on a
  // local copy so a pass and a blast landing together both stick, writes each
  // change with a bumped `hpVer`, and ignores echoes older than what it has.
  const stateRef = useRef<{ bombs: Bomb[]; feed: FeedEvent[]; ver: number; blastsOlder: number }>({ bombs: [], feed: [], ver: 0, blastsOlder: 0 });
  const pausedSinceRef = useRef<number | null>(null);
  useEffect(() => {
    const v = settings.hpVer ?? 0;
    if (v >= stateRef.current.ver) stateRef.current = { bombs: savedBombs, feed: savedFeed, ver: v, blastsOlder: settings.hpBlastsOlder ?? 0 };
  }, [settings.hpVer]); // eslint-disable-line react-hooks/exhaustive-deps

  // Draw from the local copy: this screen's own writes can land before its
  // realtime subscription is up, and it shouldn't wait for an echo of itself.
  const [, setDrawn] = useState(0);
  const view = stateRef.current.ver >= (settings.hpVer ?? 0)
    ? stateRef.current
    : { bombs: savedBombs, feed: savedFeed, ver: settings.hpVer ?? 0, blastsOlder: settings.hpBlastsOlder ?? 0 };
  const bombs = view.bombs;
  const feed = view.feed;
  const blastCount = feed.filter(e => e.kind === "boom").length + view.blastsOlder;

  const commit = (next: Bomb[], nextFeed: FeedEvent[]) => {
    const st = stateRef.current;
    // Blasts that scroll off the feed still count toward the total.
    const dropped = st.feed.filter(e => !nextFeed.some(n => n.id === e.id) && e.kind === "boom").length;
    stateRef.current = { bombs: next, feed: nextFeed, ver: st.ver + 1, blastsOlder: st.blastsOlder + dropped };
    setDrawn(n => n + 1);
    const live = sessionRef.current?.settings ?? {};
    supabase.from("game_sessions").update({
      settings: { ...live, bombs: next, hpFeed: nextFeed, hpVer: stateRef.current.ver, hpBlastsOlder: stateRef.current.blastsOlder },
    }).eq("id", sessionId).then(undefined, () => {});
  };

  // Pass requests from the phones.
  useEffect(() => {
    if (!sessionId) return;
    const ch = supabase.channel(`passit-${sessionId}`)
      .on("broadcast", { event: "pass" }, ({ payload }) => {
        if (sessionRef.current?.status !== "running") return;
        const req = payload as PassRequest;
        const ids = studentsRef.current.map((x: any) => x.id);
        const st = stateRef.current;
        const r = applyPass(st.bombs, ids, req, Math.random);
        if (!r) return;
        commit(r.bombs, pushFeed(st.feed, { kind: "pass", from: req.from, to: r.to, at: new Date().toISOString() }, Math.random));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hand out bombs, blow up expired ones, add bombs as players join, and hold
  // every fuse while the game is paused.
  useEffect(() => {
    const sess = sessionRef.current;
    if (sess?.status !== "running") return;
    const ids = studentsRef.current.map((x: any) => x.id);
    if (!ids.length) return;
    const t = Date.now();
    const st = stateRef.current;
    if (isPaused(sess)) { if (pausedSinceRef.current == null) pausedSinceRef.current = t; return; }
    if (pausedSinceRef.current != null) {
      const ms = t - pausedSinceRef.current;
      pausedSinceRef.current = null;
      if (st.bombs.length) { commit(extendFuses(st.bombs, ms), st.feed); return; }
    }
    if (!st.bombs.length && !(sess.settings?.hpVer)) {
      const first = initBombs(ids, t, Math.random);
      let f = st.feed;
      for (const b of first) f = pushFeed(f, { kind: "spawn", from: null, to: b.holderId, at: new Date(t).toISOString() }, Math.random);
      commit(first, f);
      return;
    }
    const r = resolveBlasts(st.bombs, ids, t, Math.random);
    let next = topUpBombs(r.bombs, ids, t, Math.random);
    if (!r.blasts.length && !r.moved.length && next.length === st.bombs.length) return;
    let f = st.feed;
    const at = new Date(t).toISOString();
    for (const b of r.blasts) f = pushFeed(f, { kind: "boom", from: null, to: b.victim, at }, Math.random);
    for (const b of next.filter(x => !r.bombs.some(y => y.id === x.id))) f = pushFeed(f, { kind: "spawn", from: null, to: b.holderId, at }, Math.random);
    next = next.filter(Boolean);
    commit(next, f);
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!(await confirm(ar ? "إنهاء اللعبة الآن؟" : "End the game now?"))) return;
    await supabase.from("game_sessions").update({ status: "finished", ended_at: new Date().toISOString() }).eq("id", session.id);
    nav(`/app/games/${session.id}/results`, { state: { justEnded: true } });
  };

  const goFullscreen = () => {
    const el = document.documentElement as any;
    (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  };

  const nameOf = (id: string | null) => students.find(x => x.id === id)?.name ?? "?";
  const holderBurn = new Map(bombs.map(b => [b.holderId, fuseBurn(b.explodesAt, now)]));

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
        <Button onClick={() => nav(`/app/games/${session.id}/results`, { state: { justEnded: true } })}
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
      {ConfirmDialog}

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
            <span className="font-bold tabular-nums" style={{ color: PCB_GREEN }}>{bombs.length}</span>
            <span className="text-muted-foreground">{ar ? "قنابل" : bombs.length === 1 ? "bomb" : "bombs"}</span>
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
              const burn    = holderBurn.get(s.id);
              const isBomb  = burn !== undefined;
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
                  <Avatar name={s.name} colorIndex={s.avatar_color} faceIndex={s.avatar_face} />
                  <span className="font-mono text-lg font-bold flex-1 truncate"
                    style={{ color: isFirst ? "hsl(210 10% 92%)" : "hsl(210 10% 72%)" }}>
                    {s.name}
                  </span>
                  {isBomb && <BombIcon className={cn("h-6 w-6 shrink-0", burn! > 0.85 && "animate-fuse-critical")} burn={1 - burn!} sparks />}
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

          {/* Bombs in play. No seconds shown: the class can see this screen,
              and a fuse you can count down isn't a surprise. */}
          <div className="rounded-2xl p-4" style={metalPanel}>
            <div className="text-xs font-mono tracking-widest uppercase mb-3" style={{ color: "hsl(210 10% 40%)" }}>
              {ar ? "القنابل الآن" : "Bombs in play"}
            </div>
            {bombs.length ? (
              <div className="grid grid-cols-1 gap-2">
                {bombs.map(b => {
                  const h = students.find(x => x.id === b.holderId);
                  const burn = fuseBurn(b.explodesAt, now);
                  return (
                    <div key={b.id} className="flex items-center gap-3">
                      <BombIcon sparks burn={1 - burn} className={cn("h-8 w-8 shrink-0", burn > 0.85 && "animate-fuse-critical")} />
                      {h && <Avatar name={h.name} colorIndex={h.avatar_color} faceIndex={h.avatar_face} size="sm" />}
                      <span className="font-black text-lg truncate" style={{ color: "hsl(210 10% 88%)" }}>{h?.name ?? "..."}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="font-mono text-sm animate-pulse" style={{ color: "hsl(210 10% 38%)" }}>{ar ? "جارٍ توزيع القنابل..." : "Handing out bombs..."}</div>
            )}
          </div>

          {/* Live feed: passes and blasts */}
          <div className="rounded-2xl p-4 overflow-hidden flex flex-col" style={metalPanel}>
            <div className="font-mono text-xs mb-3 flex items-center justify-between uppercase tracking-widest"
              style={{ color: "hsl(210 10% 42%)" }}>
              <span>{ar ? "ما يحدث" : "Live"}</span>
              <div className="flex items-center gap-1.5">
                <span className="normal-case tracking-normal">{ar ? "انفجارات" : "blasts"}</span>
                <span className="tabular-nums font-bold" style={{ color: PCB_GREEN }}>{blastCount}</span>
              </div>
            </div>

            <div className="flex-1 overflow-hidden space-y-2">
              {feed.filter(e => e.kind !== "spawn").length === 0 ? (
                <div className="font-mono text-sm pt-1" style={{ color: "hsl(210 10% 28%)" }}>
                  {ar ? "> أجب صح لتمرير القنبلة..." : "> answer right to pass the bomb..."}
                </div>
              ) : (
                feed.filter(e => e.kind !== "spawn").map(e => (
                  <div key={e.id}
                    className="animate-blast-in flex items-center gap-2.5 px-2.5 py-2 rounded-lg"
                    style={{
                      background: e.kind === "boom" ? "hsl(0 60% 30% / 0.35)" : "hsl(210 18% 12% / 0.7)",
                      border: `1px solid ${e.kind === "boom" ? "hsl(0 60% 45% / 0.6)" : "hsl(210 20% 22%)"}`,
                    }}>
                    <BombIcon className="h-4 w-4 shrink-0" style={{ color: e.kind === "boom" ? "hsl(0 70% 65%)" : "hsl(210 10% 62%)" }} />
                    <span className="font-mono text-sm truncate">
                      {e.kind === "boom" ? (
                        <><span className="font-black" style={{ color: "hsl(0 70% 75%)" }}>{nameOf(e.to)}</span>
                          <span className="text-muted-foreground">{ar ? " انفجرت عليه" : " blew up"}</span></>
                      ) : (
                        <><span className="font-black" style={{ color: "hsl(210 12% 88%)" }}>{nameOf(e.from)}</span>
                          <span className="text-muted-foreground">{" → "}</span>
                          <span className="font-black" style={{ color: "hsl(210 12% 88%)" }}>{nameOf(e.to)}</span></>
                      )}
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
