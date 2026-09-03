import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Sparkles, Trash2, FileQuestion } from "lucide-react";
import { toast } from "@/components/ui/sonner";

type Quiz = {
  id: string; title: string; subject: string | null; grade_level: string | null;
  source: string; created_at: string;
};

const Quizzes = () => {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("quizzes").select("*").eq("created_by", user.id).order("created_at", { ascending: false });
    setQuizzes(data ?? []);
    if (data?.length) {
      const ids = data.map(q => q.id);
      const { data: qs } = await supabase.from("questions").select("quiz_id").in("quiz_id", ids);
      const c: Record<string, number> = {};
      qs?.forEach((r: any) => { c[r.quiz_id] = (c[r.quiz_id] ?? 0) + 1; });
      setCounts(c);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const remove = async (id: string) => {
    if (!confirm(ar ? "حذف هذا الاختبار نهائياً؟" : "Delete this quiz permanently?")) return;
    await supabase.from("quizzes").delete().eq("id", id);
    load(); // the card disappearing from the grid is the confirmation
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="rounded-2xl border-2 border-[hsl(var(--nb-border))] bg-white shadow-[4px_4px_0_0_hsl(var(--nb-border))] px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-display text-2xl font-bold">{t("my_quizzes")}</h1>
        <div className="flex gap-2">
          <Button asChild className="bg-accent text-white hover:bg-accent/90"><Link to="/app/quizzes/new"><Plus className="h-4 w-4 me-2" />{t("manual_build")}</Link></Button>
          <Button asChild variant="outline"><Link to="/app/quizzes/new?ai=1"><Sparkles className="h-4 w-4 me-2" />{t("ai_generate")}</Link></Button>
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground">...</div>
      ) : quizzes.length === 0 ? (
        <Card className="p-12 text-center">
          <FileQuestion className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-bold text-lg">{t("no_quizzes")}</h3>
          <p className="text-muted-foreground mb-4">{t("start_first")}</p>
          <Button asChild className="bg-accent text-white hover:bg-accent/90"><Link to="/app/quizzes/new"><Plus className="h-4 w-4 me-2" />{t("create_quiz")}</Link></Button>
        </Card>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
          {quizzes.map((q) => (
            <Card key={q.id} className="p-3 sm:p-5 hover:shadow-soft transition-shadow group relative flex flex-col h-full">
              {/* Delete is tucked in the corner, out of the main action row —
                  edit and host are the two things a teacher actually reaches
                  for here, delete is occasional and doesn't need equal billing. */}
              <button
                onClick={() => remove(q.id)}
                className="absolute top-2.5 end-2.5 sm:top-4 sm:end-4 text-muted-foreground/50 hover:text-destructive transition-colors"
                aria-label={ar ? "حذف الاختبار" : "Delete quiz"}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>

              <h3 className="font-bold text-sm sm:text-lg leading-tight mb-1.5 sm:mb-2 line-clamp-2 pe-5">{q.title}</h3>
              <div className="text-xs sm:text-sm text-muted-foreground mb-1 truncate">{q.subject} {q.grade_level && `· ${q.grade_level}`}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground mb-3 sm:mb-4">{counts[q.id] ?? 0} {t("questions")}</div>

              <div className="flex gap-1.5 sm:gap-2 mt-auto">
                <Button asChild size="sm" variant="outline" className="flex-1 text-xs sm:text-sm px-2"><Link to={`/app/quizzes/${q.id}/edit`}>{t("edit")}</Link></Button>
                <Button asChild size="sm" className="flex-1 bg-[#3F5A63] text-white hover:bg-[#3F5A63]/90 text-xs sm:text-sm px-2">
                  <Link to={`/app/host/${q.id}`}>{ar ? "استضافة" : "Host"}</Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Quizzes;
