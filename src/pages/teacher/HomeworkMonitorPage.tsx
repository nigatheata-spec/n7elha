// Homework is not a projector view like the live monitors — a teacher checks
// it at their desk, so unlike /app/games/:sessionId/monitor it lives inside
// the normal app shell (sidebar, header) rather than the full-screen route.
// This wrapper just owns the session fetch/subscription that GameMonitor
// otherwise provides to every other mode's monitor component.
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import HomeworkMonitor from "./HomeworkMonitor";

const HomeworkMonitorPage = () => {
  const { sessionId } = useParams();
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    if (!sessionId) return;
    const refresh = () => {
      supabase.from("game_sessions").select("*, quizzes(title)").eq("id", sessionId).maybeSingle()
        .then(({ data }) => setSession(data));
    };
    refresh();
    const ch = supabase.channel(`hw-session-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_sessions", filter: `id=eq.${sessionId}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId]);

  if (!session) return null;
  return <HomeworkMonitor session={session} sessionId={sessionId!} />;
};

export default HomeworkMonitorPage;
