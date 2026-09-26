import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Square, Maximize, Users, Biohazard, Timer } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { HEAD_START_MS, POINTS } from "@/lib/humansVsZombies";
import { HVZ } from "@/lib/hvzRender";

// ── Humans vs Zombies, projector ────────────────────────────────────────────
// No map up here on purpose: the game is on the phones. The board is the
// score of the outbreak — who's still human, who's turned, and a live feed of
// every infection and stun, read off the same broadcast channel the phones
// use. Team counts come from game_students.team, which each phone flips for
// itself when it's tagged.
//
// This screen also referees the end: zombies win the moment nobody is human,
// humans win if anyone is still human when the clock runs out, and every
// survivor gets the survival bonus.

export type Row = { id: string; name: string; team: string | null; crypto: number | null; avatar_color: number | null; avatar_face: number | null };
export type Feed = { id: number; by: string; victim: string; kind: "infect" | "stun" | "ko" | "bite" };

/** `demo` fills the board with made-up players for the dev preview; nothing is read or written. */
interface Props { session: any; sessionId: string; demo?: { students: Row[]; feed: Feed[] } }

const HumansVsZombiesMonitor = ({ session, sessionId, demo }: Props) => {
  const nav = useNavigate();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const { i18n } = useTranslation();
  const ar = (session?.settings?.lang ?? i18n.language) === "ar";
  const [students, setStudents] = useState<Row[]>(demo?.students ?? []);
  const [feed, setFeed] = useState<Feed[]>(demo?.feed ?? []);
  const [now, setNow] = useState(Date.now());
  const endingRef = useRef(false);
  const studentsRef = useRef<Row[]>([]);
  studentsRef.current = students;
  const settingsRef = useRef<any>({});
  settingsRef.current = session?.settings ?? {};

  useEffect(() => {
    if (!sessionId || demo) return;
    const refresh = async () => {
      const { data } = await supabase.from("game_students")
        .select("id,name,team,crypto,avatar_color,avatar_face").eq("session_id", sessionId);
      setStudents((data ?? []) as Row[]);
    };
    refresh();
    const push = (kind: Feed["kind"]) => ({ payload }: any) => {
      if (!payload) return;
      const k: Feed["kind"] = kind === "stun" && payload.ko ? "ko" : kind;
      setFeed(f => [{ id: Date.now() + Math.random(), by: payload.byName ?? "?", victim: payload.victimName ?? "?", kind: k }, ...f].slice(0, 7));
    };
    const ch = supabase.channel(`hvz-${sessionId}`, { config: { broadcast: { self: false } } })
      .on("postgres_changes", { event: "*", schema: "public", table: "game_students", filter: `session_id=eq.${sessionId}` }, refresh)
      .on("broadcast", { event: "infect" }, push("infect"))
      .on("broadcast", { event: "stun" }, push("stun"))
      .on("broadcast", { event: "bite" }, push("bite"))
      .subscribe();
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => { supabase.removeChannel(ch); clearInterval(tick); };
  }, [sessionId, demo]);

  const startedAt = session?.started_at ? new Date(session.started_at).getTime() : 0;
  const minutes = Number(session?.settings?.minutes);
  const endsAt = startedAt && Number.isFinite(minutes) && minutes > 0 ? startedAt + minutes * 60_000 : null;
  const secsLeft = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : null;
  const releaseIn = startedAt ? Math.max(0, Math.ceil((startedAt + HEAD_START_MS - now) / 1000)) : 0;

  const finish = async (winner: "humans" | "zombies") => {
    if (endingRef.current) return;
    endingRef.current = true;
    if (winner === "humans") {
      // The survival bonus, paid by the referee so it lands even for a phone
      // that's asleep when the clock runs out.
      await Promise.all(studentsRef.current.filter(s => s.team === "human").map(s =>
        supabase.from("game_students").update({ crypto: (s.crypto ?? 0) + POINTS.survive }).eq("id", s.id)));
    }
    await supabase.from("game_sessions").update({
      status: "finished", ended_at: new Date().toISOString(),
      settings: { ...settingsRef.current, winner },
    }).eq("id", sessionId);
  };

  // Referee.
  useEffect(() => {
    if (session?.status !== "running" || !startedAt || demo) return;
    const t = setInterval(() => {
      const list = studentsRef.current;
      if (list.length === 0) return;
      const humans = list.filter(s => s.team !== "zombie").length;
      if (humans === 0 && Date.now() > startedAt + 3000) { finish("zombies"); return; }
      if (endsAt && Date.now() >= endsAt) finish(humans > 0 ? "humans" : "zombies");
    }, 500);
    return () => clearInterval(t);
  }, [session?.status, startedAt, endsAt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (session?.status === "finished") nav(`/app/games/${session.id}/results`, { replace: true, state: { justEnded: true } });
  }, [session?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const endNow = async () => {
    if (!session || !(await confirm(ar ? "إنهاء اللعبة الآن؟" : "End the game now?"))) return;
    await finish(humans.length > 0 ? "humans" : "zombies");
  };

  const goFullscreen = () => {
    const el = document.documentElement as any;
    (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  };

  const byPoints = (a: Row, b: Row) => (b.crypto ?? 0) - (a.crypto ?? 0);
  const humans = students.filter(s => s.team !== "zombie").sort(byPoints);
  const zombies = students.filter(s => s.team === "zombie").sort(byPoints);
  const total = Math.max(1, students.length);
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const Player = ({ s, zombie }: { s: Row; zombie: boolean }) => (
    <div className="flex flex-col items-center gap-1.5 w-[5.5rem] animate-scale-in">
      <div className="relative rounded-full" style={{ boxShadow: `0 0 0 4px ${zombie ? HVZ.zombieDeep : "#FFFFFF"}` }}>
        <Avatar name={s.name} size={64} colorIndex={s.avatar_color} faceIndex={s.avatar_face} />
        {zombie && <div className="absolute inset-0 rounded-full mix-blend-multiply" style={{ background: "rgba(120,200,90,0.8)" }} />}
      </div>
      <div className="max-w-full truncate text-sm font-extrabold">{s.name}</div>
      <div className="text-xs font-black tabular-nums" style={{ color: "#FFE066" }}>{s.crypto ?? 0}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 overflow-hidden text-white" style={{ background: HVZ.void }}>
      {ConfirmDialog}
      <div className="h-full flex flex-col p-5 gap-4">
        <div dir="ltr" className="flex items-center justify-between gap-3 shrink-0">
          <div className="text-sm font-bold opacity-70">
            {ar ? "الرمز" : "CODE"} <span className="text-xl font-black tracking-widest opacity-100 text-white">{session?.code}</span>
          </div>
          {secsLeft !== null && (
            <div className="flex items-center gap-2 text-4xl font-black tabular-nums">
              <Timer className="h-8 w-8 opacity-60" />{fmt(secsLeft)}
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={goFullscreen} className="text-white hover:bg-white/10 hover:text-white">
              <Maximize className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={endNow} className="bg-destructive hover:bg-destructive/90 text-white font-bold">
              <Square className="h-4 w-4 me-1" />{ar ? "إنهاء" : "END"}
            </Button>
          </div>
        </div>

        {/* The outbreak in one bar. */}
        <div className="shrink-0">
          <div dir="ltr" className="flex items-end justify-between mb-2">
            <div className="flex items-center gap-3" style={{ color: HVZ.human }}>
              <Users className="h-10 w-10" />
              <span className="text-6xl font-black tabular-nums">{humans.length}</span>
              <span className="text-xl font-black tracking-widest">{ar ? "بشر" : "HUMANS"}</span>
            </div>
            <div className="flex items-center gap-3" style={{ color: HVZ.zombie }}>
              <span className="text-xl font-black tracking-widest">{ar ? "زومبي" : "ZOMBIES"}</span>
              <span className="text-6xl font-black tabular-nums">{zombies.length}</span>
              <Biohazard className="h-10 w-10" />
            </div>
          </div>
          <div dir="ltr" className="h-5 rounded-full overflow-hidden flex" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div className="h-full transition-all duration-700" style={{ width: `${(humans.length / total) * 100}%`, background: HVZ.human }} />
            <div className="h-full flex-1 transition-all duration-700" style={{ background: HVZ.zombie }} />
          </div>
        </div>

        {releaseIn > 0 && (
          <div className="shrink-0 text-center text-2xl font-black animate-pulse" style={{ color: HVZ.zombie }}>
            {ar ? `الزومبي يخرجون من المختبر بعد ${releaseIn}` : `Zombies break out of the lab in ${releaseIn}`}
          </div>
        )}

        <div dir="ltr" className="flex-1 min-h-0 grid grid-cols-[1fr_minmax(16rem,22rem)_1fr] gap-6">
          <div className="min-h-0 overflow-y-auto">
            <div className="flex flex-wrap content-start gap-4">
              {humans.map(s => <Player key={s.id} s={s} zombie={false} />)}
            </div>
          </div>

          <div className="min-h-0 flex flex-col gap-2">
            <div className="text-xs font-black tracking-[0.3em] opacity-50 text-center">{ar ? "ما يحدث الآن" : "LIVE"}</div>
            {feed.length === 0 && (
              <div className="text-center text-sm font-bold opacity-40 mt-6">
                {ar ? "لم يُصب أحد بعد" : "Nobody has been caught yet"}
              </div>
            )}
            {feed.map(e => (
              <div key={e.id} dir={ar ? "rtl" : "ltr"} className="px-4 py-2.5 rounded-2xl text-base font-extrabold animate-fade-up"
                style={{ background: e.kind === "infect" || e.kind === "bite" ? "rgba(108,192,74,0.18)" : "rgba(78,163,242,0.18)" }}>
                <span style={{ color: e.kind === "infect" || e.kind === "bite" ? HVZ.zombie : HVZ.human }}>{e.by}</span>
                <span className="opacity-70">{e.kind === "infect" ? (ar ? " عدى " : " infected ") : e.kind === "bite" ? (ar ? " عضّ " : " bit ") : e.kind === "ko" ? (ar ? " أسقط " : " knocked out ") : (ar ? " شلّ " : " stunned ")}</span>
                <span>{e.victim}</span>
              </div>
            ))}
          </div>

          <div className="min-h-0 overflow-y-auto">
            <div className="flex flex-wrap content-start justify-end gap-4">
              {zombies.map(s => <Player key={s.id} s={s} zombie />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HumansVsZombiesMonitor;
