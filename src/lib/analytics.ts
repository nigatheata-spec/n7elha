// ── Teacher analytics — pure aggregation over what the games already record ──
//
// Every answer in every session lands in question_responses, every player in
// game_students. This module folds those into the four things a teacher
// actually asks after a few weeks of hosting:
//   * is the class getting better?                 → sessions over time
//   * which questions keep tripping them up?       → hardestQuestions
//   * which quizzes are too easy / too hard?       → perQuiz
//   * who needs a word after class?                → students
//
// It takes plain rows and returns plain numbers, so it can be tested without a
// database and so the page is nothing but a view of this output.
//
// STUDENT IDENTITY is by name. Students never log in — they type a name into a
// room code — so the same child is a fresh game_students row every session.
// Folding by normalised name is the only join there is. It's imperfect (two
// "Ahmed"s in one class merge; "ahmed " and "Ahmed" don't need to) and the page
// says so; the alternative, no cross-session view at all, is worse.

export type SessionRow = { id: string; quiz_id: string; status: string; started_at: string | null; created_at: string; settings: unknown };
export type StudentRow = { id: string; session_id: string; name: string; correct_answers: number; total_answers: number };
export type ResponseRow = { session_id: string; student_id: string; question_id: string; answer_index: number; is_correct: boolean };
export type QuestionRow = { id: string; quiz_id: string; text: string; options: unknown; correct_index: number };
export type QuizRow = { id: string; title: string; subject: string | null };

export type SessionPoint = {
  id: string; quizId: string; quizTitle: string; mode: string;
  at: string; students: number; answers: number; correct: number; pct: number | null;
};
export type QuestionStat = {
  id: string; quizId: string; quizTitle: string; text: string;
  attempts: number; correct: number; pct: number;
  /** The wrong option most students picked — usually the misconception itself. */
  trap: { index: number; text: string; share: number } | null;
};
export type QuizStat = { id: string; title: string; subject: string | null; hosted: number; students: number; answers: number; pct: number | null };
export type StudentStat = { name: string; sessions: number; answers: number; correct: number; pct: number };

export type Analytics = {
  totals: { sessions: number; students: number; answers: number; pct: number | null };
  sessions: SessionPoint[];        // chronological
  hardestQuestions: QuestionStat[]; // lowest % first, at least MIN_ATTEMPTS
  perQuiz: QuizStat[];             // most hosted first
  students: StudentStat[];         // lowest % first, at least MIN_ATTEMPTS
};

/** A percentage from fewer answers than this is noise, not a finding. */
export const MIN_ATTEMPTS = 5;

const pctOf = (correct: number, total: number) => (total > 0 ? Math.round((correct / total) * 100) : null);

export const normaliseName = (name: string) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase();

const modeOf = (settings: unknown): string => {
  if (settings && typeof settings === "object" && "mode" in settings) {
    const m = (settings as { mode?: unknown }).mode;
    if (typeof m === "string") return m;
  }
  return "classic";
};

const optionText = (options: unknown, i: number): string =>
  Array.isArray(options) && typeof options[i] === "string" ? options[i] : "";

export const computeAnalytics = (
  sessions: SessionRow[], students: StudentRow[], responses: ResponseRow[],
  questions: QuestionRow[], quizzes: QuizRow[],
): Analytics => {
  const quizById = new Map(quizzes.map(q => [q.id, q]));
  const questionById = new Map(questions.map(q => [q.id, q]));
  const sessionById = new Map(sessions.map(s => [s.id, s]));

  // Only sessions that were actually played count; a lobby that was opened and
  // abandoned is not a data point.
  const played = sessions.filter(s => s.status !== "lobby" && sessionById.has(s.id));
  const playedIds = new Set(played.map(s => s.id));

  const studentsBySession = new Map<string, StudentRow[]>();
  for (const st of students) {
    if (!playedIds.has(st.session_id)) continue;
    let list = studentsBySession.get(st.session_id);
    if (!list) { list = []; studentsBySession.set(st.session_id, list); }
    list.push(st);
  }

  // ── per session ──────────────────────────────────────────────────────────
  const sessionAgg = new Map<string, { answers: number; correct: number }>();
  const questionAgg = new Map<string, { attempts: number; correct: number; picks: Map<number, number> }>();
  let totalAnswers = 0, totalCorrect = 0;
  for (const r of responses) {
    if (!playedIds.has(r.session_id)) continue;
    totalAnswers++;
    if (r.is_correct) totalCorrect++;
    let s = sessionAgg.get(r.session_id);
    if (!s) { s = { answers: 0, correct: 0 }; sessionAgg.set(r.session_id, s); }
    s.answers++; if (r.is_correct) s.correct++;

    let q = questionAgg.get(r.question_id);
    if (!q) { q = { attempts: 0, correct: 0, picks: new Map() }; questionAgg.set(r.question_id, q); }
    q.attempts++; if (r.is_correct) q.correct++;
    q.picks.set(r.answer_index, (q.picks.get(r.answer_index) ?? 0) + 1);
  }

  const sessionPoints: SessionPoint[] = played
    .map(s => {
      const agg = sessionAgg.get(s.id) ?? { answers: 0, correct: 0 };
      return {
        id: s.id, quizId: s.quiz_id, quizTitle: quizById.get(s.quiz_id)?.title ?? "", mode: modeOf(s.settings),
        at: s.started_at ?? s.created_at,
        students: studentsBySession.get(s.id)?.length ?? 0,
        answers: agg.answers, correct: agg.correct, pct: pctOf(agg.correct, agg.answers),
      };
    })
    .sort((a, b) => a.at.localeCompare(b.at));

  // ── per question ─────────────────────────────────────────────────────────
  const hardestQuestions: QuestionStat[] = [];
  for (const [id, agg] of questionAgg) {
    if (agg.attempts < MIN_ATTEMPTS) continue;
    const q = questionById.get(id);
    if (!q) continue;
    let trap: QuestionStat["trap"] = null;
    for (const [idx, n] of agg.picks) {
      if (idx === q.correct_index) continue;
      if (!trap || n > trap.share) trap = { index: idx, text: optionText(q.options, idx), share: n };
    }
    if (trap) trap = { ...trap, share: Math.round((trap.share / agg.attempts) * 100) };
    hardestQuestions.push({
      id, quizId: q.quiz_id, quizTitle: quizById.get(q.quiz_id)?.title ?? "", text: q.text,
      attempts: agg.attempts, correct: agg.correct, pct: pctOf(agg.correct, agg.attempts) ?? 0, trap,
    });
  }
  hardestQuestions.sort((a, b) => a.pct - b.pct || b.attempts - a.attempts);

  // ── per quiz ─────────────────────────────────────────────────────────────
  const quizAgg = new Map<string, { hosted: number; students: number; answers: number; correct: number }>();
  for (const p of sessionPoints) {
    let a = quizAgg.get(p.quizId);
    if (!a) { a = { hosted: 0, students: 0, answers: 0, correct: 0 }; quizAgg.set(p.quizId, a); }
    a.hosted++; a.students += p.students; a.answers += p.answers; a.correct += p.correct;
  }
  const perQuiz: QuizStat[] = [];
  for (const [id, a] of quizAgg) {
    const q = quizById.get(id);
    perQuiz.push({ id, title: q?.title ?? "", subject: q?.subject ?? null, hosted: a.hosted, students: a.students, answers: a.answers, pct: pctOf(a.correct, a.answers) });
  }
  perQuiz.sort((a, b) => b.hosted - a.hosted || b.answers - a.answers);

  // ── per student (by name) ────────────────────────────────────────────────
  const studentAgg = new Map<string, { name: string; sessions: Set<string>; answers: number; correct: number }>();
  for (const st of students) {
    if (!playedIds.has(st.session_id)) continue;
    const key = normaliseName(st.name);
    if (!key) continue;
    let a = studentAgg.get(key);
    if (!a) { a = { name: st.name.trim(), sessions: new Set(), answers: 0, correct: 0 }; studentAgg.set(key, a); }
    a.sessions.add(st.session_id);
    a.answers += st.total_answers ?? 0;
    a.correct += st.correct_answers ?? 0;
  }
  const studentStats: StudentStat[] = [];
  for (const a of studentAgg.values()) {
    if (a.answers < MIN_ATTEMPTS) continue;
    studentStats.push({ name: a.name, sessions: a.sessions.size, answers: a.answers, correct: a.correct, pct: pctOf(a.correct, a.answers) ?? 0 });
  }
  studentStats.sort((a, b) => a.pct - b.pct || b.answers - a.answers);

  let totalStudents = 0;
  for (const list of studentsBySession.values()) totalStudents += list.length;

  return {
    totals: { sessions: played.length, students: totalStudents, answers: totalAnswers, pct: pctOf(totalCorrect, totalAnswers) },
    sessions: sessionPoints,
    hardestQuestions,
    perQuiz,
    students: studentStats,
  };
};

/** Restrict a computed view to one quiz. Cheaper than recomputing and keeps the
 *  cross-quiz student list intact, which is what a teacher wants when they
 *  narrow the questions down but still ask "and who is struggling?". */
export const forQuiz = (a: Analytics, quizId: string | null): Analytics => {
  if (!quizId) return a;
  const sessions = a.sessions.filter(s => s.quizId === quizId);
  const answers = sessions.reduce((n, s) => n + s.answers, 0);
  const correct = sessions.reduce((n, s) => n + s.correct, 0);
  return {
    totals: {
      sessions: sessions.length,
      students: sessions.reduce((n, s) => n + s.students, 0),
      answers, pct: pctOf(correct, answers),
    },
    sessions,
    hardestQuestions: a.hardestQuestions.filter(q => q.quizId === quizId),
    perQuiz: a.perQuiz.filter(q => q.id === quizId),
    students: a.students,
  };
};
