import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Plus, ArrowUp, FileText, X, Loader2, Gauge, Hash, Gamepad2, Eye, Check, RefreshCw, Pencil, ChevronDown, Play, Upload, Image as ImageIcon, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  const [imgBusy, setImgBusy] = useState<number | null>(null);

  const uploadQuestionImage = async (i: number, file: File) => {
    setImgBusy(i);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user?.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("question-images").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("question-images").getPublicUrl(path);
      updateDraftQ(i, { image_url: data.publicUrl });
      toast.success("✓");
    } catch (e: any) {
      toast.error(e.message || "Error");
    } finally {
      setImgBusy(null);
    }
  };

  const [games, setGames] = useState<any[]>([]);

  const loadGames = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("game_sessions")
      .select("id,code,status,created_at,started_at,ended_at,quiz_id,quizzes(title)")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false })
      .limit(4);
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
          const { extractText } = await import("unpdf");
          const buf = await f.arrayBuffer();
          const { text: pages } = await extractText(new Uint8Array(buf), { mergePages: false });
          text = pages.slice(0, 40).join("\n\n");
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

  const saveQuiz = async (host: boolean) => {
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
        image_url: q.image_url ?? null,
      }));
      const { error: ierr } = await supabase.from("questions").insert(rows);
      if (ierr) throw ierr;
      toast.success(ar ? "تم الحفظ" : "Saved");
      if (host) nav(`/app/host/${quiz.id}`);
      else nav("/app/quizzes");
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

  // When a draft is ready, show the review as the full page (no modal, no nested scroll)
  if (draft) {
    return (
      <ReviewDraft
        draft={draft}
        ar={ar}
        saving={saving}
        busy={busy}
        imgBusy={imgBusy}
        onTitleChange={(t) => setDraft({ ...draft, title: t })}
        onUpdateQ={updateDraftQ}
        onUpdateOpt={updateDraftOption}
        onRemove={removeDraftQ}
        onAddQ={() => setDraft({ ...draft, questions: [...draft.questions, { text: "", options: ["", "", "", ""], correct_index: 0, difficulty: "medium", image_url: null }] })}
        onUploadImage={uploadQuestionImage}
        onRegen={(extra) => generateDraft(extra)}
        onSave={() => saveQuiz(false)}
        onConfirm={() => saveQuiz(true)}
        onCancel={() => setDraft(null)}
      />
    );
  }

  return (
    <div className="space-y-10 max-w-5xl mx-auto pt-2">
      {/* Hero prompt */}
      <div className="text-center space-y-6 animate-fade-in">
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-accent">
          {ar ? "ماذا نُعلّم اليوم؟" : "What should we teach today?"}
        </h1>

        <div className="rounded-3xl bg-card border border-border shadow-[0_18px_50px_-30px_hsl(var(--primary)/0.35)] p-4 md:p-5 text-start">
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder={ar ? "اطلب من نحلها توليد اختبار... (مثال: اختبار عن الكسور للصف الخامس)" : "Ask n7elha to create a quiz... (e.g. Fractions quiz for grade 5)"}
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

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/60 gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <input ref={fileRef} type="file" multiple accept=".pdf,.txt,.md" className="hidden"
                onChange={e => { handleFiles(e.target.files); if (fileRef.current) fileRef.current.value = ""; }} />
              <Button variant="ghost" size="icon" className="rounded-full h-9 w-9" onClick={() => fileRef.current?.click()}>
                <Plus className="h-4 w-4" />
              </Button>

              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-primary text-primary-foreground text-xs transition-colors hover:brightness-110">
                    <span className="font-semibold">{ar ? cur.label_ar : cur.label_en}</span>
                    <ChevronDown className="h-3 w-3 opacity-80" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-1" align="start">
                  {CREATIVITY.map((c, i) => (
                    <button key={c.key} type="button" onClick={() => setCreativity(i)}
                      className={`w-full flex items-start justify-between gap-2 px-2.5 py-2 rounded-md text-sm hover:bg-accent text-start ${creativity === i ? "bg-accent/50" : ""}`}>
                      <div className="min-w-0">
                        <div className="font-medium">{ar ? c.label_ar : c.label_en}</div>
                        <div className="text-[11px] text-muted-foreground">{ar ? c.desc_ar : c.desc_en}</div>
                      </div>
                      {creativity === i && <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-accent text-accent-foreground text-xs transition-colors hover:brightness-110">
                    <span className="font-semibold">{numQ}</span>
                    <span className="opacity-90">{ar ? "سؤال" : "Q"}</span>
                    <ChevronDown className="h-3 w-3 opacity-80" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-32 p-1 max-h-64 overflow-y-auto" align="start">
                  {[5,10,15,20,25,30,40].map(n => (
                    <button key={n} type="button" onClick={() => setNumQ(n)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-sm hover:bg-accent ${numQ === n ? "bg-accent/50" : ""}`}>
                      <span>{n}</span>
                      {numQ === n && <Check className="h-3.5 w-3.5" />}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </div>

            <Button
              onClick={() => generateDraft()}
              disabled={busy}
              className="rounded-full h-10 w-10 p-0 bg-accent text-accent-foreground hover:bg-accent/90 shadow-md"
              aria-label="generate"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          {ar ? "أو" : "or"}{" "}
          <Link to="/app/quizzes/new" className="underline underline-offset-4 hover:text-foreground">{ar ? "أنشئ يدوياً" : "build manually"}</Link>
        </div>
      </div>

      {/* Past games */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold flex items-center gap-2 text-primary"><Gamepad2 className="h-5 w-5" />{ar ? "ألعابي السابقة" : "My past games"}</h2>
          <Link to="/app/games" className="text-sm text-primary/70 hover:text-accent">{ar ? "عرض الكل" : "View all"} →</Link>
        </div>

        {games.length === 0 ? (
          <div className="py-14 flex flex-col items-center gap-3 text-center rounded-2xl border border-dashed border-border">
            <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center">
              <Gamepad2 className="h-6 w-6 opacity-30" />
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              {ar ? "ولّد اختباراً من الأعلى لتستضيف أول لعبة" : "Generate a quiz above to host your first game"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {games.map((g) => (
              <Link
                key={g.id}
                to={g.status === "lobby" || g.status === "running" ? `/app/games/${g.id}/monitor` : `/app/games/${g.id}/results`}
                className="group flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:border-accent/50 hover:shadow-[0_8px_24px_-10px_hsl(var(--accent)/0.18)] transition-all"
              >
                <div className="shrink-0 w-[72px]">
                  <div className="font-mono text-[22px] font-black text-primary tracking-widest leading-none">{g.code}</div>
                  <div className="text-[11px] text-muted-foreground mt-1 font-mono">{new Date(g.created_at).toLocaleDateString(ar ? "ar" : "en")}</div>
                </div>
                <div className="flex-1 min-w-0 border-l border-border ps-4">
                  <div className="font-semibold text-foreground truncate text-sm">{g.quizzes?.title ?? "—"}</div>
                  <Badge
                    variant={g.status === "running" ? "default" : g.status === "lobby" ? "secondary" : "outline"}
                    className="mt-1.5 text-[10px] h-5 px-2"
                  >
                    {g.status === "lobby" ? (ar ? "ردهة" : "lobby") : g.status === "running" ? (ar ? "مباشر" : "live") : (ar ? "منتهية" : "ended")}
                  </Badge>
                </div>
                <Eye className="h-4 w-4 text-muted-foreground/40 group-hover:text-accent transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ReviewDraft = ({
  draft, ar, saving, busy, imgBusy,
  onTitleChange, onUpdateQ, onUpdateOpt, onRemove, onAddQ, onUploadImage,
  onRegen, onSave, onConfirm, onCancel,
}: {
  draft: { title: string; questions: any[] };
  ar: boolean;
  saving: boolean;
  busy: boolean;
  imgBusy: number | null;
  onTitleChange: (t: string) => void;
  onUpdateQ: (i: number, patch: Partial<any>) => void;
  onUpdateOpt: (i: number, oi: number, val: string) => void;
  onRemove: (i: number) => void;
  onAddQ: () => void;
  onUploadImage: (i: number, file: File) => void;
  onRegen: (extra: string) => void;
  onSave: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  const [feedback, setFeedback] = useState("");
  return (
    <div className="max-w-4xl mx-auto space-y-5 pt-2 pb-10">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-xl md:text-2xl font-bold">{ar ? "مراجعة الاختبار قبل الحفظ" : "Review quiz before saving"}</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel} aria-label="close"><X className="h-4 w-4" /></Button>
      </div>

      <Card className="p-4 md:p-5 space-y-1">
        <label className="text-xs text-muted-foreground">{ar ? "عنوان الاختبار" : "Quiz title"}</label>
        <Input value={draft.title} onChange={(e) => onTitleChange(e.target.value)} className="font-semibold text-lg" />
      </Card>

      <div className="space-y-3">
        {draft.questions.map((q, i) => (
          <Card key={i} className="p-5 space-y-3">
            {/* Header row */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-primary">#{i + 1}</span>
              <div className="flex items-center gap-2">
                <Select value={q.difficulty || "medium"} onValueChange={(v) => onUpdateQ(i, { difficulty: v })}>
                  <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">{ar ? "سهل" : "Easy"}</SelectItem>
                    <SelectItem value="medium">{ar ? "متوسط" : "Medium"}</SelectItem>
                    <SelectItem value="hard">{ar ? "صعب" : "Hard"}</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onRemove(i)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>

            {/* Question text */}
            <Textarea
              value={q.text}
              onChange={(e) => onUpdateQ(i, { text: e.target.value })}
              rows={2}
              className="text-sm"
              placeholder={ar ? "نص السؤال" : "Question text"}
              maxLength={500}
            />

            {/* Image */}
            {q.image_url ? (
              <div className="relative inline-block">
                <img src={q.image_url} alt="" className="max-h-48 rounded-lg border border-border" />
                <div className="absolute top-2 end-2 flex gap-1">
                  <label className="h-7 px-2 rounded-md bg-background/90 border text-xs cursor-pointer inline-flex items-center gap-1 hover:bg-background">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadImage(i, f); e.currentTarget.value = ""; }} />
                    <Upload className="h-3 w-3" />{ar ? "استبدال" : "Replace"}
                  </label>
                  <button type="button" onClick={() => onUpdateQ(i, { image_url: null })}
                    className="h-7 w-7 rounded-md bg-background/90 border inline-flex items-center justify-center hover:bg-background">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ) : (
              <label className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-dashed border-border hover:border-primary cursor-pointer text-xs transition-colors">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadImage(i, f); e.currentTarget.value = ""; }} />
                <ImageIcon className="h-3.5 w-3.5" />
                <span>{imgBusy === i ? "..." : (ar ? "إضافة صورة" : "Add image")}</span>
              </label>
            )}

            {/* Options */}
            <div className="grid sm:grid-cols-2 gap-2">
              {(q.options || []).map((opt: string, oi: number) => (
                <button key={oi} type="button" onClick={() => onUpdateQ(i, { correct_index: oi })}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-start transition-all ${q.correct_index === oi ? "border-success bg-success/10" : "border-border"}`}>
                  <div className={`h-6 w-6 rounded shrink-0 flex items-center justify-center text-xs font-bold ${q.correct_index === oi ? "bg-success text-success-foreground" : "bg-muted"}`}>
                    {q.correct_index === oi ? <Check className="h-3.5 w-3.5" /> : ["A","B","C","D"][oi]}
                  </div>
                  <Input
                    value={opt}
                    onChange={(e) => { e.stopPropagation(); onUpdateOpt(i, oi, e.target.value); }}
                    onClick={(e) => e.stopPropagation()}
                    className="border-0 bg-transparent h-7 px-1 text-sm"
                    placeholder={`${ar ? "خيار" : "Option"} ${["A","B","C","D"][oi] ?? oi + 1}`}
                    maxLength={200}
                  />
                </button>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Add question */}
      <button type="button" onClick={onAddQ}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-border hover:border-primary text-sm text-muted-foreground hover:text-foreground transition-colors">
        <Plus className="h-4 w-4" />{ar ? "إضافة سؤال" : "Add question"}
      </button>

      <Card className="p-4 md:p-5 space-y-3">
        <label className="text-xs text-muted-foreground flex items-center gap-2">
          <Pencil className="h-3 w-3" />
          {ar ? "اطلب تعديلات من الذكاء (اختياري)" : "Ask AI for changes (optional)"}
        </label>
        <Textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={2}
          placeholder={ar ? "مثال: اجعل الأسئلة أصعب، أضف أمثلة عددية..." : "e.g. Make harder, add numeric examples..."}
        />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={saving || busy}>{ar ? "إلغاء" : "Cancel"}</Button>
          <Button variant="secondary" onClick={() => { onRegen(feedback); setFeedback(""); }} disabled={busy || saving}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <RefreshCw className="h-4 w-4 me-2" />}
            {ar ? "إعادة التوليد" : "Regenerate"}
          </Button>
          <Button variant="outline" onClick={onSave} disabled={saving || busy}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Check className="h-4 w-4 me-2" />}
            {ar ? "حفظ" : "Save"}
          </Button>
          <Button onClick={onConfirm} disabled={saving || busy} className="bg-success text-success-foreground hover:bg-success/90">
            {saving ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Play className="h-4 w-4 me-2" />}
            {ar ? "حفظ واستضافة" : "Save & host"}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;
