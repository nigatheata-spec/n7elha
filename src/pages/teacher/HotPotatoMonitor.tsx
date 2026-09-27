import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
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


// Pass It palette, same as the phones (HotPotatoGame).
const PI = {
  ink: "#12141C", text: "#F5F2EA", muted: "#969CB0",
  bomb: "#FF6A3D", spark: "#FFD34D", bad: "#F43F5E",
};


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
  // Join order, not score order: kids look for their own face.
  const classOrder = [...students].sort((a, b) => String(a.joined_at ?? "").localeCompare(String(b.joined_at ?? "")));
  const holderBurn = new Map(bombs.map(b => [b.holderId, fuseBurn(b.explodesAt, now)]));

  // ── GAME OVER ─────────────────────────────────────────────────────────────
  const ranked = [...students].sort((a, b) => (b.crypto ?? 0) - (a.crypto ?? 0));
  if (session?.status === "finished") {
    const top3 = ranked.slice(0, 3);
    const podium = [top3[1], top3[0], top3[2]];
    const heights = ["h-28", "h-40", "h-20"];
    const places = [2, 1, 3];
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-10 overflow-hidden"
        style={{ background: PI.ink, color: PI.text, fontFamily: "'Almarai', system-ui, sans-serif" }}>
        <div className="relative text-center">
          <BombIcon className="h-20 w-20 mx-auto mb-3" sparks />
          <div className="text-6xl font-extrabold">{ar ? "انتهت اللعبة" : "Game over"}</div>
        </div>
        {top3.length > 0 && (
          <div className="relative flex gap-6 items-end">
            {podium.map((s, idx) => s ? (
              <div key={s.id} className="flex flex-col items-center gap-2 w-40">
                <Avatar name={s.name} colorIndex={s.avatar_color} faceIndex={s.avatar_face} size={places[idx] === 1 ? 96 : 72} />
                <span className="text-xl font-extrabold truncate max-w-full">{s.name}</span>
                <span className="text-lg font-extrabold tabular-nums" style={{ color: PI.spark }}>{fmt(s.crypto ?? 0)}</span>
                <div className={cn("w-full rounded-t-2xl flex items-start justify-center pt-3 text-4xl font-extrabold", heights[idx])}
                  style={{ background: places[idx] === 1 ? PI.spark : "rgba(255,255,255,0.1)", color: places[idx] === 1 ? PI.ink : PI.text }}>
                  {places[idx]}
                </div>
              </div>
            ) : <div key={idx} className="w-40" />)}
          </div>
        )}
        <button onClick={() => nav(`/app/games/${session.id}/results`, { state: { justEnded: true } })}
          className="relative flex items-center gap-2 px-8 py-4 rounded-2xl text-xl font-extrabold active:translate-y-0.5 transition-transform"
          style={{ background: PI.spark, color: PI.ink, borderBottom: "5px solid #B8901C" }}>
          <Trophy className="h-6 w-6" /> {ar ? "النتائج الكاملة" : "Full results"}
        </button>
      </div>
    );
  }

  // ── RUNNING ───────────────────────────────────────────────────────────────
  // The class as faces, in join order so everyone can find themselves. A bomb
  // lights up whoever holds it; fuses burn with no numbers (the class can see
  // this screen).
  const top5 = ranked.slice(0, 5);
  const shown = feed.filter(e => e.kind !== "spawn").slice(0, 7);
  const avatarPx = students.length > 30 ? 52 : students.length > 18 ? 64 : 80;
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ background: PI.ink, color: PI.text, fontFamily: "'Almarai', system-ui, sans-serif" }}>
      {ConfirmDialog}

      {/* Top bar */}
      <header className="relative z-10 shrink-0 grid grid-cols-3 items-center px-6 pt-4 pb-3">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-2">
            <BombIcon className="h-9 w-9" sparks />
            <span className="text-2xl font-extrabold">{ar ? "مرّرها" : "Pass It"}</span>
          </div>
          <div className="flex items-center gap-2 h-10 px-4 rounded-full text-lg font-extrabold" style={{ background: "rgba(255,255,255,0.08)" }}>
            <span style={{ color: PI.muted }}>{ar ? "الرمز" : "Code"}</span>
            <span className="tracking-[0.2em] tabular-nums">{session?.code}</span>
          </div>
        </div>
        <div className="flex justify-center">
          <div className={cn("px-6 py-1.5 rounded-2xl text-5xl font-extrabold tabular-nums", critical && "animate-pulse")}
            style={{ background: critical ? "rgba(244,63,94,0.18)" : "rgba(255,255,255,0.06)", color: critical ? PI.bad : PI.text }}>
            {mm}:{ss}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          <div className="flex items-center gap-2 h-10 px-4 rounded-full text-lg font-extrabold" style={{ background: "rgba(255,106,61,0.16)", color: PI.bomb }}>
            <BombIcon className="h-6 w-6" />
            <span className="tabular-nums">{bombs.length}</span>
            <span className="text-base">{ar ? "قنابل" : bombs.length === 1 ? "bomb" : "bombs"}</span>
          </div>
          <button onClick={goFullscreen} aria-label={ar ? "ملء الشاشة" : "Fullscreen"}
            className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-white/10" style={{ color: PI.muted }}>
            <Maximize className="h-5 w-5" />
          </button>
          <button onClick={endNow} className="h-10 px-4 rounded-full flex items-center gap-1.5 text-base font-extrabold text-white" style={{ background: PI.bad }}>
            <Square className="h-4 w-4 fill-current" />{ar ? "إنهاء" : "End"}
          </button>
        </div>
      </header>

      <div className="relative z-10 flex-1 min-h-0 grid grid-cols-[1fr_360px] gap-6 px-6 pb-6">
        {/* The class */}
        <div className="min-h-0 overflow-hidden flex flex-wrap content-center justify-center gap-x-5 gap-y-4">
          {students.length === 0 && (
            <div className="text-3xl font-extrabold animate-pulse" style={{ color: PI.muted }}>{ar ? "بانتظار اللاعبين..." : "Waiting for players..."}</div>
          )}
          {classOrder.map(s => {
            const burn = holderBurn.get(s.id);
            const hot = burn !== undefined;
            return (
              <div key={s.id} className="flex flex-col items-center gap-1.5 transition-all duration-300" style={{ width: avatarPx + 28 }}>
                <div className={cn("relative rounded-full transition-all duration-300", hot && burn! > 0.85 && "animate-fuse-critical")}
                  style={{
                    padding: 4,
                    background: hot ? `conic-gradient(${PI.bomb} ${(1 - burn!) * 360}deg, rgba(255,255,255,0.12) 0)` : "transparent",
                    transform: hot ? "scale(1.08)" : "scale(1)",
                  }}>
                  <Avatar name={s.name} colorIndex={s.avatar_color} faceIndex={s.avatar_face} size={avatarPx} />
                  {hot && <BombIcon className="absolute -top-3 -end-4 h-10 w-10 drop-shadow-lg" burn={1 - burn!} sparks />}
                </div>
                <span className="max-w-full truncate text-base font-extrabold" style={{ color: hot ? PI.bomb : PI.text }}>{s.name}</span>
                <span className="text-sm font-bold tabular-nums -mt-1" style={{ color: PI.muted }}>{fmt(s.crypto ?? 0)}</span>
              </div>
            );
          })}
        </div>

        {/* Side: leaders + what just happened */}
        <div className="min-h-0 flex flex-col gap-6 pb-10">
          <div>
            <div className="flex items-center gap-2 mb-2 text-sm font-extrabold" style={{ color: PI.muted }}>
              <Trophy className="h-4 w-4" style={{ color: PI.spark }} />{ar ? "المتصدرون" : "Leaders"}
            </div>
            <div className="flex flex-col gap-1">
              {top5.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ background: i === 0 ? "rgba(255,211,77,0.12)" : "transparent" }}>
                  <span className="w-5 text-center text-lg font-extrabold tabular-nums" style={{ color: i === 0 ? PI.spark : PI.muted }}>{i + 1}</span>
                  <Avatar name={s.name} colorIndex={s.avatar_color} faceIndex={s.avatar_face} size={32} />
                  <span className="flex-1 min-w-0 truncate text-lg font-extrabold">{s.name}</span>
                  <span className="text-lg font-extrabold tabular-nums" style={{ color: i === 0 ? PI.spark : PI.text }}>{fmt(s.crypto ?? 0)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between mb-2 text-sm font-extrabold" style={{ color: PI.muted }}>
              <span>{ar ? "ما يحدث الآن" : "Right now"}</span>
              <span>{ar ? `${blastCount} انفجارات` : `${blastCount} ${blastCount === 1 ? "blast" : "blasts"}`}</span>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-2">
              {shown.length === 0 && (
                <div className="text-base font-bold" style={{ color: PI.muted }}>{ar ? "أجب صح لتمرّر القنبلة..." : "Answer right to pass the bomb..."}</div>
              )}
              {shown.map(e => {
                const from = students.find(x => x.id === e.from), to = students.find(x => x.id === e.to);
                return e.kind === "boom" ? (
                  <div key={e.id} className="animate-blast-in flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: "rgba(255,106,61,0.18)" }}>
                    <BombIcon className="h-7 w-7 shrink-0" burn={0} sparks />
                    {to && <Avatar name={to.name} colorIndex={to.avatar_color} faceIndex={to.avatar_face} size={28} />}
                    <span className="min-w-0 truncate text-base font-extrabold">
                      <span style={{ color: PI.bomb }}>{to?.name ?? "?"}</span>{ar ? " انفجرت معه!" : " blew up!"}
                    </span>
                  </div>
                ) : (
                  <div key={e.id} className="animate-blast-in flex items-center gap-2.5 px-3 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.05)" }}>
                    {from && <Avatar name={from.name} colorIndex={from.avatar_color} faceIndex={from.avatar_face} size={28} />}
                    <span className="min-w-0 truncate text-base font-extrabold">{from?.name ?? "?"}</span>
                    <BombIcon className="h-5 w-5 shrink-0" />
                    {to && <Avatar name={to.name} colorIndex={to.avatar_color} faceIndex={to.avatar_face} size={28} />}
                    <span className="min-w-0 truncate text-base font-extrabold">{to?.name ?? "?"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HotPotatoMonitor;
