import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ChevronDown, Users, BookOpen } from "lucide-react";

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

  // Homework isn't a live projector view like the other modes' monitors, and
  // it has no winner, so it never gets the cinematic results screen either —
  // finished or not, it always opens its own roster page inside the app shell.
  const actionPath = (id: string, status: string, mode: string | undefined) => {
    if (mode === "homework") return `/app/games/${id}/homework`;
    if (status === "running" || status === "lobby") return `/app/games/${id}/monitor`;
    if (status === "finished") return `/app/games/${id}/results`;
    return null;
  };

  const visible = games.slice(0, shown);

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="rounded-2xl border-2 border-[hsl(var(--nb-border))] bg-white shadow-[4px_4px_0_0_hsl(var(--nb-border))] px-5 py-4 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold text-primary">{t("hosted_games")}</h1>
        <div className="flex items-center gap-5 divide-x divide-[hsl(var(--nb-border))]/20 rtl:divide-x-reverse">
          <div className="text-center">
            <div className="text-[10px] font-bold text-primary/50 uppercase tracking-wide">{ar ? "هذا الأسبوع" : "This week"}</div>
            <div className="text-xl font-extrabold text-primary mt-0.5">{thisWeek}</div>
          </div>
          <div className="text-center ps-5">
            <div className="text-[10px] font-bold text-primary/50 uppercase tracking-wide">{ar ? "هذا الشهر" : "This month"}</div>
            <div className="text-xl font-extrabold text-primary mt-0.5">{thisMonth}</div>
          </div>
        </div>
      </div>

      {/* One plain list instead of a grid of individually-boxed cards — a
          border-and-shadow per row, repeated dozens of times down the page,
          was the "too much" the single header card above was fixed for too. */}
      {games.length === 0 ? (
        <div className="px-4 py-8 rounded-lg border-2 border-[hsl(var(--nb-border))] bg-white text-center text-muted-foreground shadow-[2px_2px_0_0_hsl(var(--nb-border))]">
          {ar ? "لا توجد ألعاب بعد" : "No games yet"}
        </div>
      ) : (
        <>
          <div className="rounded-2xl border-2 border-[hsl(var(--nb-border))] bg-white divide-y divide-black/[0.06] overflow-hidden">
            {visible.map(g => {
              const mode = g.settings?.mode as string | undefined;
              const isHomework = mode === "homework";
              const path = actionPath(g.id, g.status, mode);
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
                    "flex items-center gap-3 px-4 py-3 hover:bg-black/[0.02] transition-colors",
                    !path && "cursor-default",
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {/* "Finished" is the default outcome for nearly every row, so it's
                          noise repeated down the whole list — only a state worth calling
                          out (still running, waiting, cancelled) gets a label at all. */}
                      {g.status !== "finished" && (
                        <span className={cn("text-[10px] font-bold", statusColor(g.status))}>
                          {statusLabel(g.status)}
                        </span>
                      )}
                      {isHomework && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-[#8FC44A]">
                          <BookOpen className="h-2.5 w-2.5" />
                          {ar ? "واجب" : "Homework"}
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-primary text-sm leading-snug truncate">
                      {g.quizzes?.title}
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-primary/55 shrink-0">
                    <Users className="h-3 w-3" />
                    {count}
                  </span>
                  <span className="text-xs text-primary/55 shrink-0 w-16 text-end">{date}</span>
                </Link>
              );
            })}
          </div>

          {shown < games.length && (
            <button
              onClick={() => setShown(s => s + PAGE_SIZE)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border-2 border-[hsl(var(--nb-border))] bg-white text-sm font-bold text-primary/70 hover:bg-gray-50 transition-colors"
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
