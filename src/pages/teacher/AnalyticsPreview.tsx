// ── Analytics — dev-only preview ────────────────────────────────────────────
// The analytics page over a synthetic term of games, with no login and no
// database, so the layout can be looked at with realistic numbers in it. The
// rows are generated, the aggregation is the real one. ?empty=1 shows the
// empty state; ?lang=en switches copy.
//
// Route is registered only when import.meta.env.DEV, so it never ships.

import { useMemo } from "react";
import { computeAnalytics } from "@/lib/analytics";
import { AnalyticsView } from "./Analytics";

const NAMES = ["أحمد", "سارة", "محمد", "نورة", "خالد", "ريم", "عبدالله", "لينا", "يوسف", "هند", "فهد", "مها"];
const MODES = ["classic", "dodgeball", "paintfight", "dontlookdown", "lavafloor"];

const AnalyticsPreview = () => {
  const params = new URLSearchParams(window.location.search);
  const ar = (params.get("lang") ?? "ar") === "ar";
  const empty = params.get("empty") === "1";

  const data = useMemo(() => {
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const quizzes = [
      { id: "qz1", title: "اختبار الكسور للصف الخامس", subject: "رياضيات" },
      { id: "qz2", title: "غزوة بدر", subject: "تاريخ" },
      { id: "qz3", title: "أهمية المياه", subject: "علوم" },
    ];
    const questions = quizzes.flatMap((q, qi) => Array.from({ length: 6 }, (_, i) => ({
      id: `${q.id}-q${i}`, quiz_id: q.id,
      text: [`ما ناتج ${qi + 2}/${i + 3} + ${i + 1}/${qi + 5}؟`, "في أي سنة هجرية وقعت الغزوة؟", "ما نسبة المياه العذبة من مياه الأرض؟"][qi] + (i ? ` (${i + 1})` : ""),
      options: ["٧", "٩", "٢٪", "٣٪"], correct_index: i % 4,
    })));
    // A term: 14 games, class of 8-12, accuracy drifting up over time with a
    // couple of genuinely hard questions that stay hard.
    const sessions = [], students = [], responses = [];
    for (let g = 0; g < 14; g++) {
      const quiz = quizzes[g % 3 === 2 ? 2 : g % 2];
      const id = `s${g}`;
      const at = new Date(2026, 7, 20 + g * 2, 10).toISOString();
      sessions.push({ id, quiz_id: quiz.id, status: "finished", started_at: at, created_at: at, settings: { mode: MODES[g % MODES.length] } });
      const n = 8 + Math.floor(rnd() * 5);
      for (let k = 0; k < n; k++) {
        const name = NAMES[k];
        const skill = 0.35 + (k / NAMES.length) * 0.55 + g * 0.012;  // Ahmed struggles, Maha flies
        const sid = `${id}-${k}`;
        let c = 0, tot = 0;
        for (const q of questions.filter(q => q.quiz_id === quiz.id)) {
          const hard = q.id.endsWith("q1") ? 0.45 : 0;   // question 2 of each quiz is the trap
          const ok = rnd() < skill - hard;
          const trapIdx = (q.correct_index + 1) % 4;
          responses.push({ session_id: id, student_id: sid, question_id: q.id, answer_index: ok ? q.correct_index : (rnd() < 0.7 ? trapIdx : (q.correct_index + 2) % 4), is_correct: ok });
          tot++; if (ok) c++;
        }
        students.push({ id: sid, session_id: id, name, correct_answers: c, total_answers: tot });
      }
    }
    return { quizzes, all: computeAnalytics(sessions, students, responses, questions, quizzes) };
  }, []);

  return (
    <div dir={ar ? "rtl" : "ltr"} className="min-h-screen bg-background p-4 md:p-8">
      <AnalyticsView
        all={empty ? computeAnalytics([], [], [], [], []) : data.all}
        quizzes={data.quizzes} error={null} ar={ar} />
    </div>
  );
};

export default AnalyticsPreview;
