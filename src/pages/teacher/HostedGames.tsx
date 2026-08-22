import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const HostedGames = () => {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const { user } = useAuth();
  const [games, setGames] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("game_sessions")
      .select("*, game_students(id, name)")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setGames(data ?? []));
  }, [user]);

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const thisWeek = games.filter(g => new Date(g.created_at) > weekAgo).length;
  const thisMonth = games.filter(g => new Date(g.created_at) > monthAgo).length;

  const statusColor = (status: string) => {
    if (status === "running") return "text-blue-600";
    if (status === "finished") return "text-green-600";
    if (status === "lobby") return "text-amber-600";
    return "text-gray-600";
  };

  const statusLabel = (status: string) => {
    if (status === "running") return ar ? "جاري" : "Running";
    if (status === "finished") return ar ? "انتهى" : "Finished";
    if (status === "lobby") return ar ? "في الانتظار" : "Waiting";
    return status;
  };

  const actionPath = (id: string, status: string) => {
    if (status === "running" || status === "lobby") return `/app/games/${id}/monitor`;
    if (status === "finished") return `/app/games/${id}/results`;
    return null;
  };

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-bold">{t("hosted_games")}</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="px-4 py-3 rounded-lg border-2 border-[hsl(var(--nb-border))] bg-white shadow-[2px_2px_0_0_hsl(var(--nb-border))]">
          <div className="text-xs font-bold text-primary/60 uppercase tracking-wide">{ar ? "هذا الأسبوع" : "This week"}</div>
          <div className="text-2xl font-extrabold text-primary mt-1">{thisWeek}</div>
        </div>
        <div className="px-4 py-3 rounded-lg border-2 border-[hsl(var(--nb-border))] bg-white shadow-[2px_2px_0_0_hsl(var(--nb-border))]">
          <div className="text-xs font-bold text-primary/60 uppercase tracking-wide">{ar ? "هذا الشهر" : "This month"}</div>
          <div className="text-2xl font-extrabold text-primary mt-1">{thisMonth}</div>
        </div>
      </div>

      {/* Games list */}
      {games.length === 0 ? (
        <div className="px-4 py-8 rounded-lg border-2 border-[hsl(var(--nb-border))] bg-white text-center text-muted-foreground shadow-[2px_2px_0_0_hsl(var(--nb-border))]">
          {ar ? "لا توجد ألعاب بعد" : "No games yet"}
        </div>
      ) : (
        <div className="space-y-2">
          {games.map(g => {
            const path = actionPath(g.id, g.status);
            const studentNames = (g.game_students || []).map((s: any) => s.name).slice(0, 3);
            const extraCount = Math.max(0, (g.game_students || []).length - 3);
            const date = new Date(g.created_at).toLocaleString(ar ? "ar-SA" : "en-US", {
              month: "short",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <Link
                key={g.id}
                to={path || "#"}
                className={cn(
                  "block px-4 py-3 rounded-lg border-2 border-[hsl(var(--nb-border))] bg-white hover:bg-gray-50 transition-colors shadow-[2px_2px_0_0_hsl(var(--nb-border))]",
                  !path && "cursor-default",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-primary">{g.quizzes?.title}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs font-bold text-primary/70">
                        {(g.game_students || []).length} {ar ? "طالب" : "students"}
                      </span>
                      {studentNames.length > 0 && (
                        <span className="text-xs text-primary/60">
                          {studentNames.join(", ")}
                          {extraCount > 0 && ` +${extraCount}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={cn("text-sm font-bold", statusColor(g.status))}>
                      {statusLabel(g.status)}
                    </div>
                    <div className="text-xs text-primary/50 mt-1">{date}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HostedGames;
