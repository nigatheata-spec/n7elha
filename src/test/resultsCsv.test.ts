import { describe, it, expect } from "vitest";
import { resultsCsv } from "@/lib/results";

describe("resultsCsv", () => {
  const qs = [{ id: "q1", text: "2+2" }, { id: "q2", text: 'Say "hi"' }];
  const rows = [{ id: "a", cells: [1, "سارة", 30] }, { id: "b", cells: [2, "Omar", 10] }];
  const resp = [
    { student_id: "a", question_id: "q1", is_correct: false },
    { student_id: "a", question_id: "q1", is_correct: true },
    { student_id: "b", question_id: "q1", is_correct: false },
    { student_id: "b", question_id: "q2", is_correct: false },
  ];
  const csv = resultsCsv(["Rank", "Name", "Points"], rows, qs, resp, "% right");
  const lines = csv.slice(1).split("\r\n");

  it("starts with a BOM so Excel reads Arabic", () => expect(csv.charCodeAt(0)).toBe(0xfeff));
  it("escapes quotes", () => expect(lines[0]).toContain('"Q2: Say ""hi"""'));
  it("marks right if ever right, wrong if only wrong, blank if never asked", () => {
    expect(lines[1]).toBe('"1","سارة","30","✓",""');
    expect(lines[2]).toBe('"2","Omar","10","✗","✗"');
  });
  it("ends with each question's share right among students who saw it", () =>
    expect(lines[3]).toBe('"% right","","","50%","0%"'));
});
