import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ChevronDown, Users } from "lucide-react";

const PAGE_SIZE = 9;

const HostedGames = () => {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const { user } = useAuth();
  const [games, setGames] = useState<any[]>([]);
  const [shown, setShown] = useState(PAGE_SIZE);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("game_sessions")
      .select("*, quizzes(title), game_students(id, name)")
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

  const visible = games.slice(0, shown);

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

      {/* Games grid — wraps across columns instead of stacking one-per-row,
          which is what made a long history read as an endless scroll. */}
      {games.length === 0 ? (
        <div className="px-4 py-8 rounded-lg border-2 border-[hsl(var(--nb-border))] bg-white text-center text-muted-foreground shadow-[2px_2px_0_0_hsl(var(--nb-border))]">
          {ar ? "لا توجد ألعاب بعد" : "No games yet"}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
            {visible.map(g => {
              const path = actionPath(g.id, g.status);
              const count = (g.game_students || []).length;
              const date = new Date(g.created_at).toLocaleString(ar ? "ar" : "en-US", {
                month: "short",
                day: "2-digit",
                calendar: "gregory",
              });

              return (
                <Link
                  key={g.id}
                  to={path || "#"}
                  className={cn(
                    "block px-3.5 py-3 rounded-lg border-2 border-[hsl(var(--nb-border))] bg-white hover:bg-gray-50 transition-colors shadow-[2px_2px_0_0_hsl(var(--nb-border))]",
                    !path && "cursor-default",
                  )}
                >
                  <span className={cn("block text-[10px] font-bold", statusColor(g.status))}>
                    {statusLabel(g.status)}
                  </span>
                  <div className="mt-0.5 font-bold text-primary text-sm leading-snug truncate">
                    {g.quizzes?.title}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-primary/55">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {count}
                    </span>
                    <span>{date}</span>
                  </div>
                </Link>
              );
            })}
          </div>

          {shown < games.length && (
            <button
              onClick={() => setShown(s => s + PAGE_SIZE)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border-2 border-[hsl(var(--nb-border))] bg-white text-sm font-bold text-primary/70 hover:bg-gray-50 transition-colors shadow-[2px_2px_0_0_hsl(var(--nb-border))]"
            >
              {ar ? "عرض المزيد" : "Show more"}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default HostedGames;
