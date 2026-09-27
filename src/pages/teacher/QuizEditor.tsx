import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Upload, Save, Check, Image as ImageIcon, X, Wand2, FileText, Camera, Paperclip, Loader2 } from "lucide-react";
import { shrinkPhoto, MAX_PHOTOS } from "@/lib/photo";
import { toast } from "@/components/ui/sonner";

type Q = { id?: string; text: string; options: string[]; correct_index: number; difficulty: "easy"|"medium"|"hard"; image_url?: string | null };

const blank = (): Q => ({ text: "", options: ["", "", "", ""], correct_index: 0, difficulty: "medium", image_url: null });

const QuizEditor = () => {
  const { id } = useParams();
  const [params] = useSearchParams();
  const aiMode = params.get("ai") === "1";
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [questions, setQuestions] = useState<Q[]>([blank()]);
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState<"manual"|"ai">(aiMode ? "ai" : "manual");

  // AI panel
  const [showAI, setShowAI] = useState(aiMode);
  const [docText, setDocText] = useState("");
  const [docImages, setDocImages] = useState<string[]>([]);
  const [numQ, setNumQ] = useState(10);
  const [diff, setDiff] = useState<"easy"|"medium"|"hard">("medium");
  const [topics, setTopics] = useState("");
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imgBusy, setImgBusy] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: quiz } = await supabase.from("quizzes").select("*").eq("id", id).maybeSingle();
      if (!quiz) return;
      setTitle(quiz.title); setSubject(quiz.subject ?? ""); setGrade(quiz.grade_level ?? "");
      setSource(quiz.source as any);
      const { data: qs } = await supabase.from("questions").select("*").eq("quiz_id", id).order("position");
      if (qs?.length) {
        setQuestions(qs.map((q: any) => ({
          id: q.id, text: q.text, options: q.options as string[],
          correct_index: q.correct_index, difficulty: q.difficulty as any,
          image_url: q.image_url ?? null,
        })));
      }
    })();
  }, [id]);

  const updateQ = (i: number, patch: Partial<Q>) =>
    setQuestions(qs => qs.map((q, idx) => idx === i ? { ...q, ...patch } : q));

  const updateOpt = (i: number, oi: number, v: string) =>
    setQuestions(qs => qs.map((q, idx) => idx === i ? { ...q, options: q.options.map((o, j) => j === oi ? v : o) } : q));

  const fileToDataUrl = (file: File) => new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });

  const onUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const isImage = file.type.startsWith("image/") || ["png","jpg","jpeg","webp","gif"].includes(ext);
      if (isImage) {
        const url = await shrinkPhoto(file);
        setDocImages(imgs => [...imgs, url].slice(0, MAX_PHOTOS));
        return; // the file chip appearing is the confirmation
      }
      let text = "";
      if (ext === "txt" || ext === "md") {
        text = await file.text();
      } else if (ext === "pdf") {
        const pdfjs: any = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        const buf = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: buf }).promise;
        for (let p = 1; p <= Math.min(pdf.numPages, 30); p++) {
          const page = await pdf.getPage(p);
          const content = await page.getTextContent();
          text += content.items.map((it: any) => it.str).join(" ") + "\n\n";
        }
      } else {
        toast.info("للمستندات المعقدة الصق المحتوى يدوياً");
        text = await file.text().catch(() => "");
      }
      setDocText(text.slice(0, 30000));
      } catch (e: any) {
      toast.error(e.message || "Error");
    } finally {
      setUploading(false);
    }
  };

  const uploadQuestionImage = async (i: number, file: File) => {
    setImgBusy(i);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user?.id}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
      const { error } = await supabase.storage.from("question-images").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("question-images").getPublicUrl(path);
      updateQ(i, { image_url: data.publicUrl }); // the image rendering inline is the confirmation
    } catch (e: any) {
      toast.error(e.message || "Error");
    } finally {
      setImgBusy(null);
    }
  };

  const aiGenerateImage = async (i: number) => {
    const q = questions[i];
    if (!q.text.trim()) { toast.error("اكتب نص السؤال أولاً"); return; }
    setImgBusy(i);
    try {
      const { data, error } = await supabase.functions.invoke("generate-question-image", {
        body: { prompt: q.text },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      // data.image is a data URL; upload to bucket so it persists cheaply
      const res = await fetch(data.image);
      const blob = await res.blob();
      const path = `${user?.id}/${Date.now()}-ai.png`;
      const { error: upErr } = await supabase.storage.from("question-images").upload(path, blob, { contentType: blob.type || "image/png" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("question-images").getPublicUrl(path);
      updateQ(i, { image_url: pub.publicUrl }); // the image rendering inline is the confirmation
    } catch (e: any) {
      toast.error(e.message || "Error");
    } finally {
      setImgBusy(null);
    }
  };

  const generate = async () => {
    if (!docText.trim() && !topics.trim() && !docImages.length) {
      toast.error("ارفع مستنداً أو صورة أو اكتب موضوعاً");
      return;
    }
    if (numQ > 10) {
      toast.error("الحد الأقصى 10 أسئلة حالياً");
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: { content: docText, images: docImages, numQuestions: numQ, difficulty: diff, topics, language: document.documentElement.lang || "ar" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const qs: Q[] = (data?.questions ?? []).map((q: any) => ({
        text: q.text, options: q.options, correct_index: q.correct_index, difficulty: q.difficulty || diff,
      }));
      if (!qs.length) throw new Error("لم يتم توليد أسئلة");
      setQuestions(qs);
      if (!title && data?.title) setTitle(data.title);
      setSource("ai");
      setShowAI(false);
      
    } catch (e: any) {
      toast.error(e.message || "Error");
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    if (!user) return;
    if (!title.trim()) { toast.error(t("title")); return; }
    if (!questions.length || questions.some(q => !q.text.trim() || q.options.some(o => !o.trim()))) {
      toast.error("أكمل الأسئلة"); return;
    }
    setSaving(true);
    try {
      let quizId = id;
      if (quizId) {
        await supabase.from("quizzes").update({ title, subject, grade_level: grade, source }).eq("id", quizId);
        await supabase.from("questions").delete().eq("quiz_id", quizId);
      } else {
        const { data, error } = await supabase.from("quizzes")
          .insert({ created_by: user.id, title, subject, grade_level: grade, source }).select().single();
        if (error) throw error;
        quizId = data.id;
      }
      const rows = questions.map((q, i) => ({
        quiz_id: quizId!, position: i, text: q.text, options: q.options,
        correct_index: q.correct_index, difficulty: q.difficulty, image_url: q.image_url ?? null,
      }));
      const { error } = await supabase.from("questions").insert(rows);
      if (error) throw error;
      navigate(`/app/quizzes`); // landing back on the list with the new card is the confirmation
    } catch (e: any) {
      toast.error(e.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-3xl font-bold">{id ? t("edit") : t("create_quiz")}</h1>
        <div className="flex gap-2">
          {!showAI && <Button variant="outline" onClick={() => setShowAI(true)} className="border-accent/40">{t("ai_generate")}</Button>}
          <Button onClick={save} disabled={saving} className="bg-accent text-white hover:bg-accent/90"><Save className="h-4 w-4 me-2" />{saving ? "..." : t("save_quiz")}</Button>
        </div>
      </div>

      {/* Same box as the dashboard's: a topic, or the lesson itself as
          photos of the page or a PDF (buttons, drop, or paste). */}
      {showAI && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); Array.from(e.dataTransfer.files).forEach(onUpload); }}
          className={`relative rounded-3xl bg-white border-2 border-[hsl(var(--nb-border))] shadow-[4px_4px_0_0_hsl(var(--nb-border))] p-4 md:p-5 animate-fade-in transition-all ${generating ? "opacity-60 pointer-events-none" : ""} ${dragging ? "ring-4 ring-accent/40" : ""}`}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-sm">{t("ai_generate")}</h2>
            <button type="button" aria-label={t("cancel")} onClick={() => setShowAI(false)} className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
          <textarea
            value={topics}
            onChange={e => setTopics(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); generate(); } }}
            onPaste={e => { const imgs = Array.from(e.clipboardData.files).filter(f => f.type.startsWith("image/")); if (imgs.length) { e.preventDefault(); imgs.forEach(onUpload); } }}
            maxLength={400}
            rows={3}
            placeholder={ar ? "عن ماذا الاختبار؟ اكتب موضوعًا، أو صوّر السبورة بعد شرح الدرس..." : "What's the quiz about? Type a topic, or snap the board after your lesson..."}
            className="w-full resize-none bg-transparent outline-none text-base placeholder:text-muted-foreground/70"
          />

          {(docImages.length > 0 || docText) && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {docImages.map((src, idx) => (
                <div key={idx} className="relative">
                  <img src={src} alt="" className="h-16 w-16 object-cover rounded-xl border border-border" />
                  <button type="button" aria-label={ar ? "إزالة" : "Remove"} onClick={() => setDocImages(imgs => imgs.filter((_, j) => j !== idx))}
                    className="absolute -top-1.5 -end-1.5 h-5 w-5 rounded-full bg-foreground text-background flex items-center justify-center">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {docText && (
                <span className="inline-flex items-center gap-1.5 h-8 ps-2.5 pe-1 rounded-full bg-secondary text-secondary-foreground text-xs">
                  <FileText className="h-3.5 w-3.5" />{docText.length} {ar ? "حرف" : "chars"}
                  <button type="button" aria-label={ar ? "إزالة" : "Remove"} onClick={() => setDocText("")} className="p-0.5 rounded hover:bg-background/60"><X className="h-3 w-3" /></button>
                </span>
              )}
            </div>
          )}

          <input ref={photoRef} type="file" multiple accept="image/*" className="hidden"
            onChange={e => { Array.from(e.target.files ?? []).forEach(onUpload); e.currentTarget.value = ""; }} />
          <input ref={fileRef} type="file" accept=".pdf,.txt,.md" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.currentTarget.value = ""; }} />

          <div className="mt-3 pt-3 border-t border-border/60">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button type="button" onClick={() => photoRef.current?.click()}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border-2 border-[hsl(var(--nb-border))] text-sm font-bold hover:bg-muted transition-colors">
                <Camera className="h-4 w-4" />{ar ? "صورة" : "Photo"}
              </button>
              <button type="button" onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border-2 border-[hsl(var(--nb-border))] text-sm font-bold hover:bg-muted transition-colors">
                <Paperclip className="h-4 w-4" />{uploading ? "..." : ar ? "ملف PDF" : "PDF"}
              </button>
              <div className="inline-flex h-9 p-0.5 rounded-full bg-muted text-xs font-bold" role="radiogroup" aria-label={t("difficulty")}>
                {(["easy", "medium", "hard"] as const).map(d => (
                  <button key={d} type="button" role="radio" aria-checked={diff === d} onClick={() => setDiff(d)}
                    className={`px-3 rounded-full transition-colors ${diff === d ? "bg-[#3F5A63] text-white" : "text-muted-foreground hover:text-foreground"}`}>
                    {t(d)}
                  </button>
                ))}
              </div>
              <div className="inline-flex h-9 p-0.5 rounded-full bg-muted text-xs font-bold" role="radiogroup" aria-label={t("num_questions")}>
                {[5, 10].map(n => (
                  <button key={n} type="button" role="radio" aria-checked={numQ === n} onClick={() => setNumQ(n)}
                    className={`px-3 rounded-full transition-colors ${numQ === n ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    {n} {ar ? "أسئلة" : "Qs"}
                  </button>
                ))}
              </div>
              <Button onClick={generate} disabled={generating}
                className="ms-auto rounded-full h-10 px-5 gap-2 bg-accent text-white hover:bg-accent/90 font-bold">
                {generating && <Loader2 className="h-4 w-4 animate-spin" />}
                {ar ? "أنشئ الأسئلة" : "Create questions"}
              </Button>
            </div>

          </div>

          {dragging && (
            <div className="absolute inset-0 rounded-3xl bg-accent/10 flex items-center justify-center text-lg font-bold pointer-events-none">
              {ar ? "أفلت الصورة أو الملف هنا" : "Drop the photo or file here"}
            </div>
          )}
        </div>
      )}

      <Card className="p-6 space-y-4">
        <div><Label className="mb-1.5 block">{t("title")}</Label><Input value={title} onChange={e => setTitle(e.target.value)} maxLength={200} /></div>
      </Card>

      <div className="space-y-3">
        {questions.map((q, i) => (
          <Card key={i} className="p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-primary">#{i + 1}</span>
              <div className="flex gap-2 items-center">
                <Select value={q.difficulty} onValueChange={(v: any) => updateQ(i, { difficulty: v })}>
                  <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">{t("easy")}</SelectItem>
                    <SelectItem value="medium">{t("medium")}</SelectItem>
                    <SelectItem value="hard">{t("hard")}</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="ghost" onClick={() => setQuestions(qs => qs.filter((_, idx) => idx !== i))}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </div>
            </div>
            <Textarea value={q.text} onChange={e => updateQ(i, { text: e.target.value })} placeholder={t("question_text")} maxLength={500} rows={2} />

            {q.image_url ? (
              <div className="relative inline-block">
                <img src={q.image_url} alt="" className="max-h-48 rounded-lg border border-border" />
                <div className="absolute top-2 end-2 flex gap-1">
                  <label className="h-7 px-2 rounded-md bg-background/90 border text-xs cursor-pointer inline-flex items-center gap-1 hover:bg-background">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadQuestionImage(i, f); e.currentTarget.value = ""; }} />
                    <Upload className="h-3 w-3" /> استبدال
                  </label>
                  <button type="button" onClick={() => updateQ(i, { image_url: null })}
                    className="h-7 w-7 rounded-md bg-background/90 border inline-flex items-center justify-center hover:bg-background">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-dashed border-border hover:border-primary cursor-pointer text-xs transition-colors">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadQuestionImage(i, f); e.currentTarget.value = ""; }} />
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span>{imgBusy === i ? "..." : "إضافة صورة"}</span>
                </label>
                <button type="button" onClick={() => aiGenerateImage(i)} disabled={imgBusy === i}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-dashed border-accent/50 hover:border-accent text-xs transition-colors disabled:opacity-50">
                  <Wand2 className="h-3.5 w-3.5" />
                  <span>{imgBusy === i ? "..." : "توليد بالذكاء"}</span>
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {q.options.map((opt, oi) => (
                <button key={oi} type="button" onClick={() => updateQ(i, { correct_index: oi })}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-start transition-all ${q.correct_index === oi ? "border-success bg-success/10" : "border-border"}`}>
                  <div className={`h-6 w-6 rounded shrink-0 flex items-center justify-center text-xs font-bold ${q.correct_index === oi ? "bg-success text-success-foreground" : "bg-muted"}`}>
                    {q.correct_index === oi ? <Check className="h-3.5 w-3.5" /> : ["A","B","C","D"][oi]}
                  </div>
                  <Input value={opt} onChange={e => updateOpt(i, oi, e.target.value)} placeholder={`${t("option")} ${["A","B","C","D"][oi]}`} maxLength={200} className="border-0 bg-transparent focus-visible:ring-0 h-8 px-1" />
                </button>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Button variant="outline" onClick={() => setQuestions(qs => [...qs, blank()])} className="w-full border-dashed">
        <Plus className="h-4 w-4 me-2" />{t("add_question")}
      </Button>
    </div>
  );
};

export default QuizEditor;
