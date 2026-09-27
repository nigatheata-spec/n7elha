import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pause, Play, Square, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PlayerRow } from "@/components/teacher/PlayerManager";
import { cn } from "@/lib/utils";
import type { Json } from "@/integrations/supabase/types";

// ── Teacher controls during a game ──────────────────────────────────────────
// One small bar in the corner of the projector, the same on every mode:
// players (rename / remove), pause, end.
//
// Pause without touching any mode's timer math: every mode counts down from
// `started_at`, so while paused this device keeps pushing `started_at` forward
// by however long the pause has lasted. The clock stands still everywhere and
// resuming needs nothing more than clearing the flag. `settings.pausedAt` is
// what phones read to cover the screen; `settings.pauseBase` is the real
// `started_at`, kept so a reload of this page mid-pause picks up where it was.

type Sess = {
  id: string; status: string; started_at: string | null;
  settings: ({ pausedAt?: string; pauseBase?: string } & { [k: string]: Json | undefined }) | null;
};
type Student = { id: string; name: string; avatar_color?: number | null; avatar_face?: number | null };

export const isPaused = (session: Sess | null | undefined) => session?.status === "running" && !!session?.settings?.pausedAt;

const shiftedStart = (s: Sess) =>
  new Date(new Date(s.settings!.pauseBase!).getTime() + (Date.now() - new Date(s.settings!.pausedAt!).getTime())).toISOString();

export const GameControls = ({ session, ar }: { session: Sess; ar: boolean }) => {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Student[]>([]);
  const [arming, setArming] = useState(false);
  const armTimer = useRef<ReturnType<typeof setTimeout>>();
  const sessionId: string = session.id;
  const paused = isPaused(session);
  const sessRef = useRef(session);
  sessRef.current = session;

  useEffect(() => () => clearTimeout(armTimer.current), []);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      const { data } = await supabase.from("game_students")
        .select("id,name,avatar_color,avatar_face").eq("session_id", sessionId).order("joined_at");
      setList((data ?? []) as Student[]);
    };
    load();
    const ch = supabase.channel(`players-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_students", filter: `session_id=eq.${sessionId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [open, sessionId]);

  // Hold the clock while paused.
  useEffect(() => {
    if (!paused) return;
    const t = setInterval(() => {
      const s = sessRef.current;
      if (!isPaused(s)) return;
      supabase.from("game_sessions").update({ started_at: shiftedStart(s) }).eq("id", sessionId);
    }, 1000);
    return () => clearInterval(t);
  }, [paused, sessionId]);

  const togglePause = async () => {
    const s = sessRef.current;
    if (!isPaused(s)) {
      await supabase.from("game_sessions").update({
        settings: { ...s.settings, pausedAt: new Date().toISOString(), pauseBase: s.started_at },
      }).eq("id", sessionId);
    } else {
      const { pausedAt: _p, pauseBase: _b, ...rest } = s.settings ?? {};
      await supabase.from("game_sessions").update({ started_at: shiftedStart(s), settings: rest }).eq("id", sessionId);
    }
  };

  const end = async () => {
    if (!arming) {
      setArming(true);
      armTimer.current = setTimeout(() => setArming(false), 3000);
      return;
    }
    clearTimeout(armTimer.current);
    setArming(false);
    const s = sessRef.current;
    const { pausedAt: _p, pauseBase: _b, ...rest } = s.settings ?? {};
    await supabase.from("game_sessions").update({
      status: "finished", ended_at: new Date().toISOString(),
      ...(isPaused(s) ? { started_at: shiftedStart(s), settings: rest } : {}),
    }).eq("id", sessionId);
  };

  const btn = "h-9 w-9 rounded-full flex items-center justify-center transition-colors hover:bg-white/15";

  return (
    <>
      {paused && createPortal(
        <div className="fixed inset-0 z-[55] flex flex-col items-center justify-center gap-6"
          style={{ background: "rgba(8,10,16,0.82)", backdropFilter: "blur(6px)", color: "#FFFFFF", fontFamily: "'Almarai', system-ui, sans-serif" }}>
          <Pause className="h-20 w-20 opacity-90" />
          <div className="text-6xl font-extrabold">{ar ? "توقف مؤقت" : "Paused"}</div>
          <button onClick={togglePause}
            className="flex items-center gap-2 px-7 py-3 rounded-full text-lg font-extrabold active:scale-95 transition-transform"
            style={{ background: "#FFFFFF", color: "#141A22" }}>
            <Play className="h-5 w-5" /> {ar ? "استئناف" : "Resume"}
          </button>
        </div>,
        document.body,
      )}

      <div dir="ltr" className={cn("fixed bottom-3 left-3 z-[60] flex items-center gap-0.5 rounded-full p-1 transition-opacity",
        open || paused || arming ? "opacity-100" : "opacity-40 hover:opacity-100")}
        style={{ background: "rgba(0,0,0,0.6)", color: "#FFFFFF" }}>
        <button onClick={() => setOpen(o => !o)} aria-label={ar ? "اللاعبون" : "Players"} className={btn}>
          <Users className="h-4 w-4" />
        </button>
        <button onClick={togglePause} aria-label={paused ? (ar ? "استئناف" : "Resume") : (ar ? "إيقاف مؤقت" : "Pause")} className={btn}>
          {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>
        <button onClick={end} aria-label={ar ? "إنهاء اللعبة" : "End game"}
          className={cn("rounded-full flex items-center justify-center transition-all",
            arming ? "h-9 px-3 text-xs font-bold bg-red-500" : cn(btn, "text-red-400"))}>
          {arming ? (ar ? "إنهاء؟" : "End game?") : <Square className="h-3.5 w-3.5 fill-current" />}
        </button>
      </div>

      {open && (
        <div dir={ar ? "rtl" : "ltr"} className="fixed bottom-16 left-3 z-[60] w-72 max-h-[70vh] flex flex-col rounded-2xl p-3 shadow-2xl"
          style={{ background: "#141A22", color: "#FFFFFF", fontFamily: "'Almarai', system-ui, sans-serif" }}>
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-sm font-extrabold">{ar ? "اللاعبون" : "Players"} ({list.length})</span>
            <button onClick={() => setOpen(false)} aria-label={ar ? "إغلاق" : "Close"} className="p-1 opacity-60 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-1.5 overflow-y-auto">
            {list.map(s => <PlayerRow key={s.id} s={s} ar={ar} dark />)}
            {list.length === 0 && <div className="text-xs opacity-50 text-center py-4">{ar ? "لا يوجد لاعبون" : "No players"}</div>}
          </div>
        </div>
      )}
    </>
  );
};

/** The phone's side of a pause: covers the game until the teacher resumes. */
export const PausedOverlay = ({ session, ar }: { session: Sess; ar: boolean }) =>
  isPaused(session) ? createPortal(
    <div className="fixed inset-0 z-[2000] flex flex-col items-center justify-center gap-4 touch-none"
      onPointerDown={e => e.stopPropagation()}
      style={{ background: "rgba(8,10,16,0.88)", backdropFilter: "blur(6px)", color: "#FFFFFF", fontFamily: "'Almarai', system-ui, sans-serif" }}>
      <Pause className="h-14 w-14 opacity-90" />
      <div className="text-3xl font-extrabold">{ar ? "توقف مؤقت" : "Paused"}</div>
      <div className="text-sm font-bold opacity-60">{ar ? "انظر إلى المعلّم" : "Eyes on your teacher"}</div>
    </div>,
    document.body,
  ) : null;
