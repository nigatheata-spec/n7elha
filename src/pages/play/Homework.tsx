// ── Homework ────────────────────────────────────────────────────────────────
// The asynchronous game mode: no room code, no lobby, no live opponents. The
// teacher shares one link, students open it whenever they want, answer the
// quiz once at their own pace, and see their own score at the end.
//
// Two things make this different from Classic, and both are deliberate:
//
//   1. Questions run in `position` order and each is asked exactly once, so
//      every student sits the same paper. Classic picks at random forever
//      because it is a timed race; a homework set has to be finite and fair.
//   2. Progress is resumable. A student who closes the tab (or whose phone
//      dies) comes back to the question they were on rather than starting
//      over — their answered-question ids are read back from
//      `question_responses`, which is the same table the teacher's analytics
//      already read, so nothing new has to be stored to make this work.
//
// Identity is the same localStorage handle the live modes use, so a student
// can only be one person per session on one device.

import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { Check, X, BookOpen, PartyPopper, Lock } from "lucide-react";
import { playSelect, playCorrect, playWrong, playGameOver, primeAudio } from "@/lib/sound";
import logoMark from "@/assets/logo-mark.png";
import { Seo } from "@/components/Seo";

type Q = { id: string; text: string; options: string[]; correct_index: number; position: number; image_url?: string };
type Stage = "loading" | "closed" | "name" | "question" | "reveal" | "done";

// Same four answer fills as Classic, so a student who has played live in class
// recognises the shape of the screen immediately.
const ANSWER_COLORS = ["#3a9e6e", "#3F5A63", "#C8783A", "#8B4A3A"];
const NB = "border-2 border-[hsl(var(--nb-border))]";

const Homework = () => {
  const { sessionId } = useParams();
  const { i18n } = useTranslation();

  const [session, setSession] = useState<any>(null);
  const [quizTitle, setQuizTitle] = useState("");
  const [questions, setQuestions] = useState<Q[]>([]);
  const [me, setMe] = useState<any>(null);
  const [stage, setStage] = useState<Stage>("loading");
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  const ar = (session?.settings?.lang ?? i18n.language) === "ar";
  const dueAt: string | null = session?.settings?.dueAt ?? null;
  const pastDue = !!dueAt && Date.now() > new Date(dueAt).getTime();

  useEffect(() => {
    const onFirstTouch = () => { primeAudio(); window.removeEventListener("pointerdown", onFirstTouch); };
    window.addEventListener("pointerdown", onFirstTouch, { once: true });
    return () => window.removeEventListener("pointerdown", onFirstTouch);
  }, []);

  // ── Load the assignment, and resume wherever this student left off ────────
  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      const { data: s } = await supabase
        .from("game_sessions").select("*, quizzes(id, title)").eq("id", sessionId).maybeSingle();
      if (!s) { setStage("closed"); return; }
      setSession(s);
      setQuizTitle((s as any).quizzes?.title ?? "");

      const { data: qs } = await supabase
        .from("questions").select("*").eq("quiz_id", s.quiz_id).order("position");
      const list: Q[] = (qs ?? []).map((q: any) => ({ ...q, options: Array.isArray(q.options) ? q.options : [] }));
      setQuestions(list);

      const cfg = (s.settings ?? {}) as { dueAt?: string };
      const closed = s.status === "finished" || s.status === "cancelled"
        || (!!cfg.dueAt && Date.now() > new Date(cfg.dueAt).getTime());

      const storedId = localStorage.getItem(`hash_student_${sessionId}`);
      if (!storedId) { setStage(closed ? "closed" : "name"); return; }

      const { data: student } = await supabase
        .from("game_students").select("*").eq("id", storedId).maybeSingle();
      if (!student) {
        localStorage.removeItem(`hash_student_${sessionId}`);
        setStage(closed ? "closed" : "name");
        return;
      }
      setMe(student);

      // Resume by question id rather than by a stored counter: the counter can
      // drift if a write fails, but a response row is proof the question was
      // actually answered. The score is recomputed from those rows too, since
      // game_students.correct_answers is only ever written once, at the very
      // end — see the finish-time write in `next()` below.
      const { data: responses } = await supabase
        .from("question_responses").select("question_id, is_correct").eq("student_id", student.id);
      const done = new Set((responses ?? []).map((r: any) => r.question_id));
      setScore((responses ?? []).filter((r: any) => r.is_correct).length);
      const next = list.findIndex(q => !done.has(q.id));

      if (next === -1 || list.length === 0) setStage("done");
      else if (closed) setStage("closed");
      else { setIdx(next); setStage("question"); }
    })();
  }, [sessionId]);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !sessionId || joining) return;
    setJoining(true);
    try {
      const { data: student, error } = await supabase
        .from("game_students").insert({ session_id: sessionId, name: name.trim() }).select().single();
      if (error) throw error;
      localStorage.setItem(`hash_student_${sessionId}`, student.id);
      setMe(student);
      setIdx(0);
      setStage(questions.length ? "question" : "done");
    } catch (err: any) {
      toast.error(err.message || (ar ? "تعذّر البدء" : "Could not start"));
    } finally {
      setJoining(false);
    }
  };

  const q = questions[idx];

  const answer = async (choice: number) => {
    if (picked !== null || !q || !me) return;
    playSelect();
    setPicked(choice);
    const correct = choice === q.correct_index;
    if (correct) { playCorrect(); setScore(s => s + 1); } else playWrong();
    setStage("reveal");

    // Fire-and-forget, like the live modes: a slow round trip must never hold
    // up the reveal a student is waiting on. A dropped write costs one row and
    // the resume logic simply re-asks that question. This is the only write
    // per question — game_students itself is untouched until the assignment
    // is actually finished (see `next()`), so the teacher's monitor has
    // nothing to update on and a mid-quiz refresh is a no-op for them.
    supabase.from("question_responses").insert({
      session_id: sessionId, student_id: me.id, question_id: q.id,
      question_index: idx, answer_index: choice, is_correct: correct,
    }).then(() => {});
  };

  const next = () => {
    setPicked(null);
    if (idx + 1 >= questions.length) {
      playGameOver();
      setStage("done");
      // The one and only game_students write: this is what the teacher's
      // monitor actually watches, so a submission is what makes it move.
      supabase.from("game_students").update({
        total_answers: questions.length, correct_answers: score,
      }).eq("id", me.id).then(() => {});
    } else { setIdx(i => i + 1); setStage("question"); }
  };

  const dueLabel = useMemo(() => {
    if (!dueAt) return null;
    return new Date(dueAt).toLocaleString(ar ? "ar" : "en-GB", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });
  }, [dueAt, ar]);

  const shell = (children: React.ReactNode) => (
    <div className="min-h-[100dvh] flex flex-col" style={{ background: "hsl(var(--background))" }}>
      <Seo
        path={`/hw/${sessionId ?? ""}`}
        titleAr="واجب — نفلها"
        titleEn="Homework — nefelha"
        descriptionAr="واجب تفاعلي من معلمك على منصة نفلها."
        descriptionEn="An interactive homework assignment from your teacher on nefelha."
        index={false}
      />
      <header className="shrink-0 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <img src={logoMark} alt="nefelha" className="h-6 w-6 object-contain shrink-0" />
          <span className="font-bold text-sm truncate" style={{ color: "#3F5A63" }}>{quizTitle || "nefelha"}</span>
        </div>
        {stage === "question" || stage === "reveal" ? (
          <span className={cn("px-3 py-1.5 rounded-full font-black text-sm tabular-nums bg-white", NB,
            "shadow-[3px_3px_0_0_hsl(var(--nb-border))]")} style={{ color: "#3F5A63" }}>
            {idx + 1} / {questions.length}
          </span>
        ) : null}
      </header>
      <main className="flex-1 flex flex-col min-h-0 px-4 pb-5">{children}</main>
    </div>
  );

  // ── Loading ──────────────────────────────────────────────────────────────
  if (stage === "loading") {
    return shell(
      <div className="flex-1 flex items-center justify-center text-sm font-bold" style={{ color: "#3F5A63" }}>…</div>
    );
  }

  // ── Closed (finished, cancelled, or past the due date) ───────────────────
  if (stage === "closed") {
    return shell(
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 max-w-sm mx-auto w-full">
        <div className={cn("h-14 w-14 rounded-2xl bg-white flex items-center justify-center", NB,
          "shadow-[4px_4px_0_0_hsl(var(--nb-border))]")}>
          <Lock className="h-6 w-6" style={{ color: "#3F5A63" }} />
        </div>
        <h1 className="text-2xl font-black" style={{ color: "#3F5A63" }}>
          {ar ? "هذا الواجب مقفل" : "This homework is closed"}
        </h1>
        <p className="text-sm" style={{ color: "hsl(199 15% 45%)" }}>
          {pastDue
            ? (ar ? `انتهى موعد التسليم في ${dueLabel}` : `The deadline passed on ${dueLabel}`)
            : (ar ? "أنهى معلّمك هذا الواجب." : "Your teacher has closed this assignment.")}
        </p>
      </div>
    );
  }

  // ── Name entry ───────────────────────────────────────────────────────────
  if (stage === "name") {
    return shell(
      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full gap-6">
        <div className="text-center space-y-2">
          <div className={cn("mx-auto h-14 w-14 rounded-2xl bg-[#8FC44A] flex items-center justify-center", NB,
            "shadow-[4px_4px_0_0_hsl(var(--nb-border))]")}>
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-black pt-2" style={{ color: "#3F5A63" }}>
            {quizTitle || (ar ? "واجب" : "Homework")}
          </h1>
          <p className="text-sm" style={{ color: "hsl(199 15% 45%)" }}>
            {ar ? `${questions.length} سؤال · اكتب اسمك للبدء` : `${questions.length} questions · enter your name to begin`}
          </p>
          {dueLabel && (
            <p className="text-xs font-bold" style={{ color: "#C8783A" }}>
              {ar ? `التسليم قبل ${dueLabel}` : `Due ${dueLabel}`}
            </p>
          )}
        </div>

        <form onSubmit={start} className="space-y-3">
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={40}
            placeholder={ar ? "اسمك الكامل..." : "Your full name..."}
            dir="auto"
            className={cn("w-full h-14 px-4 text-center text-lg font-bold rounded-2xl bg-white", NB,
              "shadow-[4px_4px_0_0_hsl(var(--nb-border))] focus:outline-none placeholder:text-black/25")}
            style={{ color: "#3F5A63" }}
          />
          <button
            type="submit"
            disabled={!name.trim() || joining}
            className={cn("w-full h-14 rounded-2xl font-black text-lg bg-[#3F5A63] text-white", NB,
              "shadow-[4px_4px_0_0_hsl(var(--nb-border))] transition-transform active:scale-[0.98] disabled:opacity-40")}
          >
            {ar ? "ابدأ الواجب" : "Start homework"}
          </button>
          <p className="text-center text-xs" style={{ color: "hsl(199 15% 55%)" }}>
            {ar ? "اسمك يظهر لمعلّمك فقط" : "Your name is only shown to your teacher"}
          </p>
        </form>
      </div>
    );
  }

  // ── Done ─────────────────────────────────────────────────────────────────
  if (stage === "done") {
    const total = questions.length || 1;
    const pct = Math.round((score / total) * 100);
    return shell(
      <div className="flex-1 flex flex-col items-center justify-center gap-5 max-w-sm mx-auto w-full text-center">
        <div className={cn("h-14 w-14 rounded-2xl bg-[#8FC44A] flex items-center justify-center", NB,
          "shadow-[4px_4px_0_0_hsl(var(--nb-border))]")}>
          <PartyPopper className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-2xl font-black" style={{ color: "#3F5A63" }}>
          {ar ? "خلصت الواجب!" : "Homework complete!"}
        </h1>

        <div className={cn("w-full rounded-2xl bg-white p-6", NB, "shadow-[5px_5px_0_0_hsl(var(--nb-border))]")}>
          <div className="text-5xl font-black tabular-nums" style={{ color: "#3F5A63" }}>
            {score}<span className="text-2xl opacity-40">/{questions.length}</span>
          </div>
          <div className="mt-3 h-3 w-full rounded-full bg-black/[0.07] overflow-hidden">
            <div className="h-full rounded-full bg-[#8FC44A] transition-[width] duration-700"
              style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-2 text-sm font-bold tabular-nums" style={{ color: "hsl(199 15% 45%)" }}>
            {pct}%
          </div>
        </div>

        <p className="text-sm" style={{ color: "hsl(199 15% 45%)" }}>
          {ar ? "تم إرسال نتيجتك لمعلّمك. تقدر تقفل الصفحة." : "Your result has been sent to your teacher. You can close this page."}
        </p>
      </div>
    );
  }

  // ── Question / reveal ────────────────────────────────────────────────────
  if (!q) return shell(null);
  const showResult = picked !== null;

  return shell(
    <div className="flex-1 flex flex-col max-w-md mx-auto w-full gap-4 min-h-0">
      {/* progress rail */}
      <div className="h-2 w-full rounded-full bg-black/[0.07] overflow-hidden shrink-0">
        <div className="h-full rounded-full bg-[#8FC44A] transition-[width] duration-300"
          style={{ width: `${(idx / (questions.length || 1)) * 100}%` }} />
      </div>

      <div className={cn("rounded-2xl bg-white p-5 shrink-0", NB, "shadow-[4px_4px_0_0_hsl(var(--nb-border))]")}>
        {q.image_url && (
          <img src={q.image_url} alt="" className={cn("mb-3 max-h-[22vh] w-auto object-contain rounded-xl mx-auto", NB)} />
        )}
        <p dir="auto" className="text-lg font-bold text-center leading-snug" style={{ color: "#3F5A63" }}>
          {q.text}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 auto-rows-min content-center flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {q.options.map((opt, i) => {
          const isCorrect = i === q.correct_index;
          const isPicked = picked === i;
          let bg = ANSWER_COLORS[i % ANSWER_COLORS.length];
          let opacity = 1;
          let shadow = "shadow-[4px_4px_0_0_hsl(var(--nb-border))]";
          if (showResult) {
            if (isCorrect) shadow = "shadow-[5px_5px_0_0_hsl(var(--nb-border))] scale-[1.02]";
            else if (isPicked) bg = "hsl(0 84% 60%)";
            else opacity = 0.35;
          }
          return (
            <button
              key={i}
              disabled={showResult}
              onClick={() => answer(i)}
              className={cn("relative rounded-2xl px-3 py-4 min-h-[84px] flex items-center justify-center font-bold text-sm md:text-base leading-snug text-center transition-all active:scale-[0.97]",
                NB, shadow)}
              style={{ background: bg, color: "white", opacity }}
            >
              {showResult && isCorrect && <Check className="h-4 w-4 absolute left-2 top-2" strokeWidth={3} />}
              {showResult && isPicked && !isCorrect && <X className="h-4 w-4 absolute left-2 top-2" strokeWidth={3} />}
              <span dir="auto">{opt}</span>
            </button>
          );
        })}
      </div>

      {/* Homework advances on a tap rather than a timer: the point is to read
          the right answer and understand it, not to be rushed to the next one. */}
      {showResult && (
        <button
          onClick={next}
          className={cn("shrink-0 py-3.5 rounded-2xl font-black text-base bg-[#3F5A63] text-white", NB,
            "shadow-[4px_4px_0_0_hsl(var(--nb-border))] active:scale-[0.98] transition-transform")}
        >
          {idx + 1 >= questions.length ? (ar ? "إنهاء" : "Finish") : (ar ? "السؤال التالي" : "Next question")}
        </button>
      )}
    </div>
  );
};

export default Homework;
