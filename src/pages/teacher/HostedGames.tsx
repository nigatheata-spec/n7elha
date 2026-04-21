import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
            <Card key={g.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-bold">{g.quizzes?.title}</div>
                <div className="text-sm text-muted-foreground">{new Date(g.created_at).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xl text-primary">{g.code}</span>
                <Badge variant={g.status === "running" ? "default" : "secondary"}>{g.status}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default HostedGames;
