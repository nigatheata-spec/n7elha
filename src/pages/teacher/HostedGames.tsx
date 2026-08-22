import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

const HostedGames = () => {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const { user } = useAuth();
  const [games, setGames] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("game_sessions").select("*, quizzes(title)").eq("teacher_id", user.id).order("created_at", { ascending: false }).then(({ data }) => setGames(data ?? []));
  }, [user]);

  const statusColor = (status: string) => {
    if (status === "running") return "bg-blue-50 text-blue-900 border-blue-200";
    if (status === "finished") return "bg-green-50 text-green-900 border-green-200";
    return "bg-gray-50 text-gray-900 border-gray-200";
  };

  const statusLabel = (status: string) => {
    if (status === "running") return ar ? "جاري" : "Running";
    if (status === "finished") return ar ? "انتهى" : "Finished";
    if (status === "lobby") return ar ? "في الانتظار" : "Waiting";
    return status;
  };

  const actionLabel = (status: string) => {
    if (status === "running" || status === "lobby") return ar ? "مراقبة" : "Monitor";
    if (status === "finished") return ar ? "النتائج" : "Results";
    return null;
  };

  const actionPath = (id: string, status: string) => {
    if (status === "running" || status === "lobby") return `/app/games/${id}/monitor`;
    if (status === "finished") return `/app/games/${id}/results`;
    return null;
  };

  return (
    <div className="space-y-6 max-w-full">
      <h1 className="font-display text-3xl font-bold">{t("hosted_games")}</h1>
      {games.length === 0 ? (
        <div className="px-6 py-12 rounded-lg border-2 border-[hsl(var(--nb-border))] bg-white text-center text-muted-foreground shadow-[3px_3px_0_0_hsl(var(--nb-border))]">
          {ar ? "لا توجد ألعاب بعد" : "No games yet"}
        </div>
      ) : (
        <div className="rounded-lg border-2 border-[hsl(var(--nb-border))] overflow-hidden shadow-[4px_4px_0_0_hsl(var(--nb-border))]">
          {/* header row */}
          <div className="grid grid-cols-[2fr_auto_auto_auto_auto] gap-4 px-5 py-3 bg-white border-b-2 border-[hsl(var(--nb-border))]">
            <div className="text-xs font-extrabold text-primary/70 uppercase tracking-widest">{ar ? "الاختبار" : "Quiz"}</div>
            <div className="text-xs font-extrabold text-primary/70 uppercase tracking-widest text-center">{ar ? "الرمز" : "Code"}</div>
            <div className="text-xs font-extrabold text-primary/70 uppercase tracking-widest text-center">{ar ? "الحالة" : "Status"}</div>
            <div className="text-xs font-extrabold text-primary/70 uppercase tracking-widest text-right hidden sm:block">{ar ? "التاريخ" : "Date"}</div>
            <div />
          </div>

          {/* rows */}
          <div className="divide-y-2 divide-[hsl(var(--nb-border))]">
            {games.map((g, idx) => {
              const path = actionPath(g.id, g.status);
              const label = actionLabel(g.status);
              const date = new Date(g.created_at).toLocaleString(ar ? "ar-SA" : "en-US", {
                month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
              });

              return (
                <Link
                  key={g.id}
                  to={path || "#"}
                  className={cn(
                    "grid grid-cols-[2fr_auto_auto_auto_auto] gap-4 px-5 py-4 items-center bg-white hover:bg-gray-50 transition-colors",
                    !path && "cursor-default",
                  )}
                >
                  {/* quiz title */}
                  <div className="min-w-0">
                    <div className="font-bold text-primary truncate">{g.quizzes?.title}</div>
                  </div>

                  {/* code */}
                  <div className="text-center">
                    <span className="font-mono font-bold text-lg text-[#FF8254]">{g.code}</span>
                  </div>

                  {/* status badge */}
                  <div className="text-center">
                    <span className={cn("inline-block px-3 py-1 rounded text-xs font-bold border-2", statusColor(g.status))}>
                      {statusLabel(g.status)}
                    </span>
                  </div>

                  {/* date */}
                  <div className="text-xs text-primary/60 text-right hidden sm:block">{date}</div>

                  {/* action icon */}
                  {label && (
                    <div className="flex justify-end">
                      <div className="w-8 h-8 rounded flex items-center justify-center border-2 border-[hsl(var(--nb-border))] bg-white hover:bg-gray-100 transition-colors">
                        <ChevronRight className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default HostedGames;
