import { describe, it, expect } from "vitest";
import { computeAnalytics, forQuiz, normaliseName, MIN_ATTEMPTS } from "@/lib/analytics";

const quizzes = [{ id: "qz1", title: "Fractions", subject: "Math" }, { id: "qz2", title: "Badr", subject: "History" }];
const questions = [
  { id: "q1", quiz_id: "qz1", text: "1/2 + 1/4", options: ["3/4", "2/6", "1/6", "3/6"], correct_index: 0 },
  { id: "q2", quiz_id: "qz1", text: "2/3 of 9", options: ["3", "6", "9", "2"], correct_index: 1 },
  { id: "q3", quiz_id: "qz2", text: "Year of Badr", options: ["1", "2", "3", "4"], correct_index: 1 },
];
const sessions = [
  { id: "s1", quiz_id: "qz1", status: "finished", started_at: "2026-09-01T10:00:00Z", created_at: "2026-09-01T09:50:00Z", settings: { mode: "classic" } },
  { id: "s2", quiz_id: "qz1", status: "finished", started_at: "2026-09-03T10:00:00Z", created_at: "2026-09-03T09:50:00Z", settings: { mode: "dodgeball" } },
  { id: "s3", quiz_id: "qz2", status: "finished", started_at: "2026-09-02T10:00:00Z", created_at: "2026-09-02T09:50:00Z", settings: {} },
  { id: "lobby", quiz_id: "qz1", status: "lobby", started_at: null, created_at: "2026-09-04T09:50:00Z", settings: {} },
];
const st = (id: string, session: string, name: string, c: number, t: number) =>
  ({ id, session_id: session, name, correct_answers: c, total_answers: t });
const students = [
  st("a1", "s1", "Ahmed", 3, 6), st("b1", "s1", "Sara", 6, 6),
  st("a2", "s2", "ahmed ", 1, 6), st("b2", "s2", "Sara", 5, 6),
  st("a3", "s3", "Ahmed", 2, 2), st("z", "lobby", "Ghost", 0, 0),
];
// q1: everyone wrong except Sara, and the wrong answers all pick option 1.
const r = (session: string, student: string, q: string, a: number, ok: boolean) =>
  ({ session_id: session, student_id: student, question_id: q, answer_index: a, is_correct: ok });
const responses = [
  r("s1", "a1", "q1", 1, false), r("s1", "b1", "q1", 0, true),
  r("s1", "a1", "q2", 1, true),  r("s1", "b1", "q2", 1, true),
  r("s2", "a2", "q1", 1, false), r("s2", "b2", "q1", 1, false),
  r("s2", "a2", "q2", 0, false), r("s2", "b2", "q2", 1, true),
  r("s2", "a2", "q1", 1, false), // a second attempt, so q1 clears MIN_ATTEMPTS
  r("s3", "a3", "q3", 1, true),
  r("lobby", "z", "q1", 0, true), // never played: must not count
];

describe("analytics", () => {
  const a = computeAnalytics(sessions, students, responses, questions, quizzes);

  it("ignores sessions that never left the lobby", () => {
    expect(a.totals.sessions).toBe(3);
    expect(a.totals.students).toBe(5);
    expect(a.totals.answers).toBe(10);
    expect(a.sessions.map(s => s.id)).not.toContain("lobby");
  });

  it("orders sessions by when they were played, not created", () => {
    expect(a.sessions.map(s => s.id)).toEqual(["s1", "s3", "s2"]);
    expect(a.sessions[0].mode).toBe("classic");
    expect(a.sessions[1].mode).toBe("classic");  // no mode in settings falls back
    expect(a.sessions[2].mode).toBe("dodgeball");
  });

  it("names the hardest question and the wrong answer most students fell for", () => {
    const q1 = a.hardestQuestions.find(q => q.id === "q1");
    expect(q1).toBeDefined();
    expect(q1!.attempts).toBe(5);
    expect(q1!.pct).toBe(20);
    expect(q1!.trap).toEqual({ index: 1, text: "2/6", share: 80 });
    expect(a.hardestQuestions[0].id).toBe("q1");
  });

  it("does not report a question on too few answers to mean anything", () => {
    // q2 has 4 attempts, q3 has 1 — neither clears the bar.
    expect(MIN_ATTEMPTS).toBe(5);
    expect(a.hardestQuestions.map(q => q.id)).toEqual(["q1"]);
  });

  it("folds the same student across sessions by name, case and spacing aside", () => {
    expect(normaliseName("  Ahmed ")).toBe("ahmed");
    const ahmed = a.students.find(s => normaliseName(s.name) === "ahmed");
    expect(ahmed).toEqual({ name: "Ahmed", sessions: 3, answers: 14, correct: 6, pct: 43 });
    const sara = a.students.find(s => s.name === "Sara");
    expect(sara?.pct).toBe(92);
    expect(a.students[0].name).toBe("Ahmed");   // lowest first: who needs a word
  });

  it("counts how often each quiz was hosted and how it went", () => {
    expect(a.perQuiz[0]).toMatchObject({ id: "qz1", hosted: 2, students: 4 });
    expect(a.perQuiz[1]).toMatchObject({ id: "qz2", hosted: 1, pct: 100 });
  });

  it("narrows to one quiz without losing the student list", () => {
    const f = forQuiz(a, "qz2");
    expect(f.totals).toEqual({ sessions: 1, students: 1, answers: 1, pct: 100 });
    expect(f.hardestQuestions).toEqual([]);
    expect(f.perQuiz.map(q => q.id)).toEqual(["qz2"]);
    expect(f.students).toBe(a.students);
    expect(forQuiz(a, null)).toBe(a);
  });

  it("returns null percentages rather than dividing by zero", () => {
    const empty = computeAnalytics([], [], [], [], []);
    expect(empty.totals).toEqual({ sessions: 0, students: 0, answers: 0, pct: null });
    expect(empty.sessions).toEqual([]);
  });
});
