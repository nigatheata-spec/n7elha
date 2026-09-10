// ── The sample quiz — a first game in under a minute ────────────────────────
// A brand-new teacher lands on an empty dashboard, and the product is at its
// best the moment phones light up in a room. This is the shortest path there:
// one tap creates a real quiz in their account (theirs to edit or delete like
// any other) and drops them straight into the host screen.
//
// General knowledge on purpose: it has to work for any subject and any grade,
// and it has to be answerable by the teacher's own colleagues in the staff
// room, which is where a lot of first games actually happen.

import { supabase } from "@/integrations/supabase/client";

type SampleQ = { text: string; options: [string, string, string, string]; correct_index: number; difficulty: "easy" | "medium" | "hard" };

const SAMPLE: Record<"ar" | "en", { title: string; subject: string; questions: SampleQ[] }> = {
  ar: {
    title: "اختبار تجريبي — معلومات عامة",
    subject: "معلومات عامة",
    questions: [
      { text: "ما أكبر كوكب في المجموعة الشمسية؟", options: ["الأرض", "المشتري", "زحل", "المريخ"], correct_index: 1, difficulty: "easy" },
      { text: "كم عدد أضلاع الشكل السداسي؟", options: ["خمسة", "ستة", "سبعة", "ثمانية"], correct_index: 1, difficulty: "easy" },
      { text: "ما ناتج ٧ × ٨؟", options: ["٥٤", "٥٦", "٦٤", "٤٨"], correct_index: 1, difficulty: "medium" },
      { text: "ما الغاز الذي تمتصه النباتات من الهواء؟", options: ["الأكسجين", "النيتروجين", "ثاني أكسيد الكربون", "الهيدروجين"], correct_index: 2, difficulty: "medium" },
      { text: "أي المحيطات هو الأكبر؟", options: ["الأطلسي", "الهندي", "المتجمد الشمالي", "الهادئ"], correct_index: 3, difficulty: "medium" },
    ],
  },
  en: {
    title: "Sample quiz — general knowledge",
    subject: "General knowledge",
    questions: [
      { text: "Which is the largest planet in the solar system?", options: ["Earth", "Jupiter", "Saturn", "Mars"], correct_index: 1, difficulty: "easy" },
      { text: "How many sides does a hexagon have?", options: ["Five", "Six", "Seven", "Eight"], correct_index: 1, difficulty: "easy" },
      { text: "What is 7 × 8?", options: ["54", "56", "64", "48"], correct_index: 1, difficulty: "medium" },
      { text: "Which gas do plants take in from the air?", options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"], correct_index: 2, difficulty: "medium" },
      { text: "Which ocean is the largest?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], correct_index: 3, difficulty: "medium" },
    ],
  },
};

export const sampleQuizFor = (lang: string) => SAMPLE[lang === "ar" ? "ar" : "en"];

/** Insert the sample quiz into the teacher's account and return its id. */
export const createSampleQuiz = async (userId: string, lang: string): Promise<string> => {
  const sample = sampleQuizFor(lang);
  const { data: quiz, error } = await supabase.from("quizzes")
    .insert({ created_by: userId, title: sample.title, subject: sample.subject, source: "manual" })
    .select("id").single();
  if (error) throw error;
  const rows = sample.questions.map((q, i) => ({
    quiz_id: quiz.id, position: i, text: q.text, options: q.options,
    correct_index: q.correct_index, difficulty: q.difficulty,
  }));
  const { error: qErr } = await supabase.from("questions").insert(rows);
  if (qErr) throw qErr;
  return quiz.id;
};
