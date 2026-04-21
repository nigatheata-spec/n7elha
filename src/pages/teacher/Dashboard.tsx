import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileQuestion, Gamepad2, Sparkles, Plus } from "lucide-react";

const Dashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [counts, setCounts] = useState({ quizzes: 0, games: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [q, g] = await Promise.all([
        supabase.from("quizzes").select("id", { count: "exact", head: true }).eq("created_by", user.id),
        supabase.from("game_sessions").select("id", { count: "exact", head: true }).eq("teacher_id", user.id),
      ]);
      setCounts({ quizzes: q.count ?? 0, games: g.count ?? 0 });
    })();
  }, [user]);

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="animate-fade-in">
        <h1 className="font-display text-4xl font-bold tracking-tight">{t("welcome_back")}</h1>
        <p className="text-muted-foreground mt-1">{t("tagline")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileQuestion className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-3xl font-bold">{counts.quizzes}</div>
              <div className="text-sm text-muted-foreground">{t("my_quizzes")}</div>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-lg bg-accent/20 flex items-center justify-center">
              <Gamepad2 className="h-5 w-5 text-accent" />
            </div>
            <div>
              <div className="text-3xl font-bold">{counts.games}</div>
              <div className="text-sm text-muted-foreground">{t("hosted_games")}</div>
            </div>
          </div>
        </Card>
        <Card className="p-6 bg-gradient-hero border-primary/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-cyan flex items-center justify-center shadow-glow">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="font-semibold">{t("ai_generate")}</div>
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild className="bg-gradient-cyan shadow-glow h-11">
          <Link to="/app/quizzes/new"><Plus className="h-4 w-4 me-2" />{t("manual_build")}</Link>
        </Button>
        <Button asChild variant="outline" className="h-11 border-accent/40">
          <Link to="/app/quizzes/new?ai=1"><Sparkles className="h-4 w-4 me-2" />{t("ai_generate")}</Link>
        </Button>
      </div>
    </div>
  );
};

export default Dashboard;
