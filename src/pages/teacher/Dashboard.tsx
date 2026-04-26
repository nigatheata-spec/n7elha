import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Plus, ArrowUp, FileText, X, Loader2, Gauge, Hash, Gamepad2, Eye, Check, RefreshCw, Pencil } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const CREATIVITY = [
  { value: 0, key: "strict", label_ar: "حرفي", label_en: "Strict", desc_ar: "التزام تام بالمحتوى", desc_en: "Stay 100% with the source" },
  { value: 1, key: "balanced", label_ar: "متوازن", label_en: "Balanced", desc_ar: "تنويع بسيط في الصياغة", desc_en: "Slight rephrasing" },
  { value: 2, key: "creative", label_ar: "مبدع", label_en: "Creative", desc_ar: "أرقام وأمثلة جديدة", desc_en: "New numbers, twists, examples" },
];

const Dashboard = () => {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const { user } = useAuth();
  const nav = useNavigate();

  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<{ name: string; text: string }[]>([]);
  const [creativity, setCreativity] = useState(1);
  const [numQ, setNumQ] = useState(15);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Review step
  const [draft, setDraft] = useState<{ title: string; questions: any[] } | null>(null);
  const [saving, setSaving] = useState(false);

  const [games, setGames] = useState<any[]>([]);

  const loadGames = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("game_sessions")
      .select("id,code,status,created_at,started_at,ended_at,quiz_id,quizzes(title)")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false })
      .limit(12);
    setGames(data ?? []);
  };
  useEffect(() => { loadGames(); /* eslint-disable-next-line */ }, [user]);

  const handleFiles = async (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list);
    for (const f of arr) {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      try {
        let text = "";
        if (ext === "txt" || ext === "md") {
          text = await f.text();
        } else if (ext === "pdf") {
          const pdfjs: any = await import("pdfjs-dist");
          pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.149/build/pdf.worker.min.mjs";
          const buf = await f.arrayBuffer();
          const pdf = await pdfjs.getDocument({ data: buf }).promise;
          for (let p = 1; p <= Math.min(pdf.numPages, 40); p++) {
            const page = await pdf.getPage(p);
            const content = await page.getTextContent();
            text += content.items.map((it: any) => it.str).join(" ") + "\n\n";
          }
        } else {
          text = await f.text().catch(() => "");
        }
        setFiles(p => [...p, { name: f.name, text: text.slice(0, 30000) }]);
      } catch (e: any) {
        toast.error(`${f.name}: ${e.message}`);
      }
    }
  };

  const generateDraft = async (extraInstruction?: string) => {
    if (!user) return;
    if (!prompt.trim() && files.length === 0) {
      toast.error(ar ? "اكتب طلبك أو ارفع مصدر" : "Write a prompt or upload a file");
      return;
    }
    setBusy(true);
    try {
      const content = files.map(f => `# ${f.name}\n${f.text}`).join("\n\n");
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: {
          content,
          topics: prompt + (extraInstruction ? `\n\nتعديلات المعلم: ${extraInstruction}` : ""),
          numQuestions: numQ,
          creativity: CREATIVITY[creativity].key,
          language: i18n.language,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const qs = data?.questions ?? [];
      if (!qs.length) throw new Error("AI returned no questions");

      const title = data.title || prompt.slice(0, 60) || (ar ? "اختبار جديد" : "New Quiz");
      setDraft({ title, questions: qs });
      toast.success(ar ? `جاهز للمراجعة (${qs.length} سؤال)` : `Ready to review (${qs.length} questions)`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmAndHost = async () => {
    if (!user || !draft) return;
    setSaving(true);
    try {
      const { data: quiz, error: qerr } = await supabase.from("quizzes")
        .insert({ created_by: user.id, title: draft.title, source: "ai", description: prompt.slice(0, 200) })
        .select().single();
      if (qerr) throw qerr;
      const rows = draft.questions.map((q: any, i: number) => ({
        quiz_id: quiz.id, position: i, text: q.text, options: q.options,
        correct_index: q.correct_index, difficulty: q.difficulty || "medium",
      }));
      const { error: ierr } = await supabase.from("questions").insert(rows);
      if (ierr) throw ierr;
      toast.success(ar ? "تم الحفظ" : "Saved");
      nav(`/app/host/${quiz.id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const updateDraftQ = (i: number, patch: Partial<any>) => {
    if (!draft) return;
    const qs = [...draft.questions];
    qs[i] = { ...qs[i], ...patch };
    setDraft({ ...draft, questions: qs });
  };
  const updateDraftOption = (i: number, oi: number, val: string) => {
    if (!draft) return;
    const qs = [...draft.questions];
    const opts = [...(qs[i].options || [])];
    opts[oi] = val;
    qs[i] = { ...qs[i], options: opts };
    setDraft({ ...draft, questions: qs });
  };
  const removeDraftQ = (i: number) => {
    if (!draft) return;
    setDraft({ ...draft, questions: draft.questions.filter((_, j) => j !== i) });
  };

  const cur = CREATIVITY[creativity];

  return (
    <div className="space-y-10 max-w-5xl mx-auto pt-2">
      {/* Hero prompt */}
      <div className="text-center space-y-6 animate-fade-in">
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
          {ar ? "ماذا نُعلّم اليوم؟" : "What should we teach today?"}
        </h1>

        <div className="rounded-3xl bg-card border border-border shadow-xl p-4 md:p-5 text-start">
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder={ar ? "اطلب من هاش توليد اختبار... (مثال: اختبار عن الكسور للصف الخامس)" : "Ask Hash to create a quiz... (e.g. Fractions quiz for grade 5)"}
            rows={3}
            className="w-full resize-none bg-transparent outline-none text-lg placeholder:text-muted-foreground/70"
            maxLength={2000}
          />

          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {files.map((f, i) => (
                <Badge key={i} variant="secondary" className="gap-1.5 py-1.5 ps-2 pe-1">
                  <FileText className="h-3 w-3" />
                  <span className="max-w-[180px] truncate">{f.name}</span>
                  <button onClick={() => setFiles(p => p.filter((_, j) => j !== i))} className="hover:bg-background/60 rounded p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/60">
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" multiple accept=".pdf,.txt,.md" className="hidden"
                onChange={e => { handleFiles(e.target.files); if (fileRef.current) fileRef.current.value = ""; }} />
              <Button variant="ghost" size="icon" className="rounded-full h-9 w-9" onClick={() => fileRef.current?.click()}>
                <Plus className="h-4 w-4" />
              </Button>

              <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground px-2">
                <Gauge className="h-3.5 w-3.5" />
                <span>{ar ? cur.label_ar : cur.label_en}</span>
                <span className="text-muted-foreground/50">·</span>
                <Hash className="h-3.5 w-3.5" />
                <span>{numQ}</span>
              </div>
            </div>

            <Button
              onClick={generateAndHost}
              disabled={busy}
              className="rounded-full h-10 w-10 p-0 bg-foreground text-background hover:bg-foreground/90 shadow-md"
              aria-label="generate"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Controls */}
        <div className="grid sm:grid-cols-2 gap-4 text-start max-w-3xl mx-auto">
          <Card className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold flex items-center gap-2"><Gauge className="h-4 w-4 text-primary" />{ar ? "إبداع الذكاء" : "AI creativity"}</div>
              <Badge variant="outline">{ar ? cur.label_ar : cur.label_en}</Badge>
            </div>
            <Slider value={[creativity]} min={0} max={2} step={1} onValueChange={([v]) => setCreativity(v)} />
            <p className="text-xs text-muted-foreground">{ar ? cur.desc_ar : cur.desc_en}</p>
          </Card>
          <Card className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold flex items-center gap-2"><Hash className="h-4 w-4 text-primary" />{ar ? "عدد الأسئلة" : "Number of questions"}</div>
              <Badge variant="outline">{numQ}</Badge>
            </div>
            <Slider value={[numQ]} min={5} max={40} step={1} onValueChange={([v]) => setNumQ(v)} />
            <p className="text-xs text-muted-foreground">{ar ? "تتكرر عشوائياً حتى ينتهي الوقت" : "Loop randomly until time runs out"}</p>
          </Card>
        </div>

        <div className="text-sm text-muted-foreground">
          {ar ? "أو" : "or"}{" "}
          <Link to="/app/quizzes/new" className="underline underline-offset-4 hover:text-foreground">{ar ? "أنشئ يدوياً" : "build manually"}</Link>
        </div>
      </div>

      {/* Past games */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold flex items-center gap-2"><Gamepad2 className="h-5 w-5" />{ar ? "ألعابي السابقة" : "My past games"}</h2>
          <Link to="/app/games" className="text-sm text-muted-foreground hover:text-foreground">{ar ? "عرض الكل" : "View all"} →</Link>
        </div>

        {games.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground bg-muted/30">
            {ar ? "ابدأ لعبتك الأولى من الأعلى ☝️" : "Host your first game from above ☝️"}
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {games.map((g) => (
              <Card key={g.id} className="p-4 hover:border-primary/50 transition-colors group">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="font-semibold truncate">{g.quizzes?.title ?? "—"}</div>
                  <Badge variant={g.status === "running" ? "default" : g.status === "lobby" ? "secondary" : "outline"} className="shrink-0">
                    {g.status === "lobby" ? (ar ? "ردهة" : "lobby") : g.status === "running" ? (ar ? "مباشر" : "live") : (ar ? "منتهية" : "ended")}
                  </Badge>
                </div>
                <div className="font-mono text-2xl font-black text-primary mb-2 tracking-widest">{g.code}</div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{new Date(g.created_at).toLocaleDateString(ar ? "ar" : "en")}</span>
                  {(g.status === "lobby" || g.status === "running") ? (
                    <Button asChild size="sm" variant="ghost" className="h-7"><Link to={`/app/games/${g.id}/monitor`}><Eye className="h-3 w-3 me-1" />{ar ? "افتح" : "Open"}</Link></Button>
                  ) : (
                    <Button asChild size="sm" variant="ghost" className="h-7"><Link to={`/app/games/${g.id}/results`}>{ar ? "النتائج" : "Results"}</Link></Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
