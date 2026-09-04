import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Trophy, Square, Maximize } from "lucide-react";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Avatar } from "@/components/Avatar";

const fmt = (n: number) => n.toLocaleString();


interface Props { session: any; sessionId: string; }

const ClassicMonitor = ({ session, sessionId }: Props) => {
  const nav = useNavigate();
  const { i18n } = useTranslation();
  const ar = (session?.settings?.lang ?? i18n.language) === "ar";
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [students, setStudents] = useState<any[]>([]);
  const [now, setNow] = useState(Date.now());
  const [ending, setEnding] = useState(false);
  const sessionRef = useRef<any>(session);
  sessionRef.current = session;

  useEffect(() => {
    if (!sessionId) return;
    const refresh = async () => {
      const { data: ss } = await supabase.from("game_students").select("*").eq("session_id", sessionId).order("crypto", { ascending: false });
      setStudents(ss ?? []);
    };
    refresh();
    const ch = supabase.channel(`classic-monitor-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_students", filter: `session_id=eq.${sessionId}` }, refresh)
      .subscribe();
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => { supabase.removeChannel(ch); clearInterval(tick); };
  }, [sessionId]);

  const settings = session?.settings || {};
  const minutes: number | null = settings.minutes ?? null;
  const startedAt = session?.started_at ? new Date(session.started_at).getTime() : 0;
  const elapsed = startedAt ? Math.floor((now - startedAt) / 1000) : 0;
  const totalSecs = minutes ? minutes * 60 : 0;
  const left = minutes ? Math.max(0, totalSecs - elapsed) : null;
  const totalPoints = students.reduce((a, s) => a + (s.crypto || 0), 0);

  useEffect(() => {
    const sess = sessionRef.current;
    if (!sess || sess.status !== "running") return;
    if (minutes != null && left === 0 && !ending) {
      setEnding(true);
      supabase.from("game_sessions").update({ status: "finished", ended_at: new Date().toISOString() }).eq("id", sess.id);
    }
  }, [left, ending, minutes]);

  useEffect(() => {
    if (session?.status === "finished") nav(`/app/games/${session.id}/results`, { replace: true, state: { justEnded: true } });
  }, [session?.status]);

  const endNow = async () => {
    if (!(await confirm(ar ? "إنهاء اللعبة الآن؟" : "End the game now?"))) return;
    await supabase.from("game_sessions").update({ status: "finished", ended_at: new Date().toISOString() }).eq("id", sessionId);
    nav(`/app/games/${sessionId}/results`, { state: { justEnded: true } });
  };

  const goFullscreen = () => {
    const el = document.documentElement as any;
    (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  };

  const mm = left != null ? String(Math.floor(left / 60)).padStart(2, "0") : null;
  const ss = left != null ? String(left % 60).padStart(2, "0") : null;
  const NB = "border-2 border-[hsl(var(--nb-border))]";

  return (
    <div className="fixed inset-0 overflow-hidden flex flex-col" style={{ background: "hsl(var(--background))", color: "#3F5A63" }}>
      {ConfirmDialog}
      <header className="shrink-0 flex items-center justify-between px-6 py-4">
        <div>
          <div className="text-[11px] font-bold tracking-widest" style={{ color: "hsl(199 15% 50%)" }}>
            {ar ? "كلاسيكي" : "CLASSIC"} · #{session.code}
          </div>
          <div className="text-lg font-black truncate max-w-[40vw]">{session?.quizzes?.title ?? (ar ? "اختبار" : "Quiz")}</div>
        </div>
        {mm != null && (
          <div className={cn("px-5 py-2 rounded-2xl bg-white font-black text-2xl tabular-nums", NB, "shadow-[3px_3px_0_0_hsl(var(--nb-border))]")}>
            {mm}:{ss}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={goFullscreen} className="text-[#3F5A63] hover:bg-[#3F5A63]/10">
            <Maximize className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={endNow} className={cn("bg-[#3F5A63] text-white hover:bg-[#2B3F45]", NB, "shadow-[2px_2px_0_0_hsl(var(--nb-border))]")}>
            <Square className="h-3.5 w-3.5 mr-1.5" />{ar ? "إنهاء" : "End"}
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="max-w-2xl mx-auto space-y-2">
          {students.length === 0 ? (
            <div className="text-center py-16 text-sm" style={{ color: "hsl(199 15% 55%)" }}>
              {ar ? "في انتظار اللاعبين..." : "waiting for players..."}
            </div>
          ) : (
            students.map((s, i) => (
              <div key={s.id}
                className={cn("flex items-center gap-3 px-4 py-3 rounded-2xl bg-white", NB,
                  i === 0 ? "shadow-[4px_4px_0_0_hsl(var(--nb-border))]" : "shadow-[3px_3px_0_0_hsl(var(--nb-border))]")}
                style={{ animation: `fade-up 0.3s cubic-bezier(0.16,1,0.3,1) ${Math.min(i * 40, 400)}ms both` }}>
                <span className="w-6 text-center font-black tabular-nums" style={{ color: "hsl(199 15% 55%)" }}>{i + 1}</span>
                <Avatar name={s.name} colorIndex={s.avatar_color} faceIndex={s.avatar_face} />
                <span className="flex-1 font-bold truncate">{s.name}</span>
                {i === 0 && <Trophy className="h-4 w-4 shrink-0" style={{ color: "#8FC44A" }} />}
                <span className="font-black tabular-nums text-lg">{fmt(s.crypto ?? 0)}</span>
              </div>
            ))
          )}
        </div>
      </main>

      <footer className="shrink-0 px-6 py-3 flex items-center justify-between text-xs" style={{ borderTop: "2px solid hsl(var(--nb-border))", color: "hsl(199 15% 50%)" }}>
        <span>{ar ? `${students.length} لاعب` : `${students.length} players`}</span>
        <span>{ar ? `${fmt(totalPoints)} نقطة إجمالية` : `${fmt(totalPoints)} total points`}</span>
      </footer>
    </div>
  );
};

export default ClassicMonitor;
