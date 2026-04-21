import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const HostedGames = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [games, setGames] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("game_sessions").select("*, quizzes(title)").eq("teacher_id", user.id).order("created_at", { ascending: false }).then(({ data }) => setGames(data ?? []));
  }, [user]);

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="font-display text-3xl font-bold">{t("hosted_games")}</h1>
      {games.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">لا توجد ألعاب بعد</Card>
      ) : (
        <div className="space-y-2">
          {games.map(g => (
            <Card key={g.id} className="p-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="font-bold">{g.quizzes?.title}</div>
                <div className="text-sm text-muted-foreground">{new Date(g.created_at).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xl text-primary">{g.code}</span>
                <Badge variant={g.status === "running" ? "default" : g.status === "finished" ? "outline" : "secondary"}>{g.status}</Badge>
                {g.status === "running" || g.status === "lobby" ? (
                  <Button asChild size="sm" className="bg-gradient-cyan"><Link to={`/app/games/${g.id}/monitor`}>مراقبة</Link></Button>
                ) : g.status === "finished" ? (
                  <Button asChild size="sm" variant="outline"><Link to={`/app/games/${g.id}/results`}>النتائج</Link></Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default HostedGames;
