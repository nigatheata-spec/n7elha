import { useEffect, useRef, useState } from "react";
import { Pencil, X, Check, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { cn } from "@/lib/utils";

// ── Rename / kick ───────────────────────────────────────────────────────────
// The teacher's tools for a name that shouldn't be on the board: rename it in
// place, or remove the player. Used in the lobby roster and, during a game,
// behind a small Players button on every monitor.
//
// A kick is two writes: `approved = false` first, then the delete. The update
// is what the student's phone hears (realtime can filter an UPDATE by session,
// not a DELETE), so it can leave the game with a message; the delete a moment
// later takes the row off every leaderboard.

type Student = { id: string; name: string; avatar_color?: number | null; avatar_face?: number | null };

export const kickStudent = async (id: string) => {
  await supabase.from("game_students").update({ approved: false }).eq("id", id);
  await new Promise(r => setTimeout(r, 1500));
  await supabase.from("game_students").delete().eq("id", id);
};

export const renameStudent = (id: string, name: string) =>
  supabase.from("game_students").update({ name: name.trim().slice(0, 24) }).eq("id", id);

/** One roster line with rename and kick. Kick asks once more before it acts. */
export const PlayerRow = ({ s, ar, dark = false }: { s: Student; ar: boolean; dark?: boolean }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(s.name);
  const [arming, setArming] = useState(false);
  const [gone, setGone] = useState(false);
  const armTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { if (!editing) setDraft(s.name); }, [s.name, editing]);
  useEffect(() => () => clearTimeout(armTimer.current), []);

  const save = async () => {
    const name = draft.trim();
    setEditing(false);
    if (name && name !== s.name) await renameStudent(s.id, name);
  };
  const kick = () => {
    if (!arming) {
      setArming(true);
      armTimer.current = setTimeout(() => setArming(false), 3000);
      return;
    }
    clearTimeout(armTimer.current);
    setGone(true);
    kickStudent(s.id);
  };

  const ink = dark ? "#FFFFFF" : "#3F5A63";
  return (
    <div className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-opacity", gone && "opacity-30 pointer-events-none")}
      style={{ background: dark ? "rgba(255,255,255,0.06)" : "#FFFFFF", border: dark ? "none" : "1px solid rgba(0,0,0,0.06)" }}>
      <Avatar name={s.name} size={26} colorIndex={s.avatar_color} faceIndex={s.avatar_face} />
      {editing ? (
        <form className="flex-1 flex items-center gap-1.5 min-w-0" onSubmit={e => { e.preventDefault(); save(); }}>
          <input autoFocus value={draft} maxLength={24} onChange={e => setDraft(e.target.value)} onBlur={save}
            className="flex-1 min-w-0 rounded-md px-2 py-1 text-sm font-medium outline-none"
            style={{ background: dark ? "rgba(255,255,255,0.12)" : "#F2F4F5", color: ink }} />
          <button type="submit" aria-label={ar ? "حفظ" : "Save"} className="p-1 rounded" style={{ color: "#16a34a" }}>
            <Check className="h-4 w-4" />
          </button>
        </form>
      ) : (
        <span className="flex-1 min-w-0 truncate font-medium" style={{ color: ink }}>{s.name}</span>
      )}
      {!editing && (
        <button onClick={() => setEditing(true)} aria-label={ar ? "إعادة تسمية" : "Rename"}
          className="p-1 rounded opacity-50 hover:opacity-100 transition-opacity" style={{ color: ink }}>
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
      <button onClick={kick} aria-label={ar ? "إخراج" : "Remove"}
        className={cn("rounded transition-all flex items-center gap-1", arming ? "px-2 py-0.5 text-xs font-bold text-white bg-red-500" : "p-1 text-red-400 opacity-60 hover:opacity-100")}>
        {arming ? (ar ? "إخراج؟" : "Remove?") : <X className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
};

/**
 * During a game: a small Players button in the corner of the projector that
 * opens the roster with the same controls. Kept small and out of the way — the
 * class is looking at this screen.
 */
export const PlayersButton = ({ sessionId, ar }: { sessionId: string; ar: boolean }) => {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Student[]>([]);

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

  return (
    <>
      <button onClick={() => setOpen(o => !o)} aria-label={ar ? "اللاعبون" : "Players"}
        className="fixed bottom-3 left-3 z-[60] h-9 w-9 rounded-full flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity"
        style={{ background: "rgba(0,0,0,0.55)", color: "#FFFFFF" }}>
        <Users className="h-4 w-4" />
      </button>
      {open && (
        <div dir={ar ? "rtl" : "ltr"} className="fixed bottom-14 left-3 z-[60] w-72 max-h-[70vh] flex flex-col rounded-2xl p-3 shadow-2xl"
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
