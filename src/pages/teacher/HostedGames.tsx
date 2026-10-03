import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronLeft, Users } from "lucide-react";
import { QuietAccents } from "@/components/teacher/DashboardAccents";
import { modeName } from "@/lib/modeLabels";

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

  // Only states worth calling out get a pill; "finished" is nearly every row.
  const STATUS: Record<string, { ar: string; en: string; bg: string; fg: string }> = {
    running: { ar: "جارية الآن", en: "Live now", bg: "#E1F0D2", fg: "#3D6B12" },
    lobby: { ar: "في الانتظار", en: "Waiting", bg: "#F6E7C8", fg: "#8A5A0B" },
    cancelled: { ar: "أُلغيت", en: "Cancelled", bg: "#EEE9E0", fg: "#6B6357" },
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

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(ar ? "ar-EG-u-nu-latn" : "en-GB", { day: "numeric", month: "short" });

  return (
    <div className="relative isolate min-h-[calc(100dvh-2rem)] md:min-h-[calc(100dvh-4rem)]">
      <QuietAccents />
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* ── Header ── */}
      <div className="rounded-2xl border-2 border-[hsl(var(--nb-border))] bg-white shadow-[4px_4px_0_0_hsl(var(--nb-border))] px-5 py-4 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold text-primary">{t("hosted_games")}</h1>
        <div className="flex items-stretch">
          {[
            { n: thisWeek, label: ar ? "هذا الأسبوع" : "This week" },
            { n: thisMonth, label: ar ? "هذا الشهر" : "This month" },
            { n: games.length, label: ar ? "الكل" : "All time" },
          ].map((m, i) => (
            <div key={i} className={cn("px-4 text-center", i > 0 && "border-s border-black/10")}>
              <div className="text-2xl font-bold leading-none text-[#1F3439]">{m.n}</div>
              <div className="mt-1.5 text-[12px] text-black/50">{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {games.length === 0 ? (
        <div className="px-4 py-12 rounded-2xl border-2 border-[hsl(var(--nb-border))] bg-white text-center text-muted-foreground">
          {ar ? "لا توجد ألعاب بعد" : "No games yet"}
        </div>
      ) : (
        <>
          <div className="rounded-2xl border-2 border-[hsl(var(--nb-border))] bg-white shadow-[4px_4px_0_0_hsl(var(--nb-border))] divide-y divide-black/[0.07] overflow-hidden">
            {visible.map(g => {
              const mode = g.settings?.mode as string | undefined;
              const path = actionPath(g.id, g.status, mode);
              const count = (g.game_students || []).length;
              const st = STATUS[g.status];
              return (
                <Link
                  key={g.id}
                  to={path || "#"}
                  className={cn(
                    "group flex items-center gap-4 px-5 py-3.5 transition-colors",
                    path ? "hover:bg-[#8FC44A]/[0.08]" : "cursor-default",
                  )}
                >
                  <div className="w-16 shrink-0 text-[13px] font-bold text-[#1F3439] whitespace-nowrap">{fmtDate(g.created_at)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[15px] text-primary leading-snug truncate">{g.quizzes?.title || "—"}</div>
                    <div className="mt-1 flex items-center gap-2 text-[12px] text-black/50">
                      <span>{modeName(mode, ar)}</span>
                      {st && (
                        <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: st.bg, color: st.fg }}>
                          {ar ? st.ar : st.en}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold text-primary/70 shrink-0">
                    <Users className="h-3.5 w-3.5" />
                    {count}
                  </span>
                  <ChevronLeft className={cn("h-4 w-4 shrink-0 ltr:rotate-180", path ? "text-black/25 group-hover:text-primary" : "invisible")} />
                </Link>
              );
            })}
          </div>

          {shown < games.length && (
            <button
              onClick={() => setShown(s => s + PAGE_SIZE)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-[hsl(var(--nb-border))] bg-white text-sm font-bold text-primary/70 hover:bg-gray-50 transition-colors"
            >
              {ar ? "عرض المزيد" : "Show more"}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          )}
        </>
      )}
    </div>
    </div>
  );
};

export default HostedGames;
