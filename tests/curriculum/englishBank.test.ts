import { describe, expect, it } from "vitest";
import { getCurriculumProblemsBySubject, getCurriculumProblemsByUnit } from "@/lib/curriculum/curriculumBank";
import { GRADE_2_ENGLISH_CURRICULUM } from "@/lib/curriculum/grade2English";
import { toRubyParts } from "@/lib/curriculum/toRubyParts";

const KANJI = /[一-鿿]/;
const english = getCurriculumProblemsBySubject("english");

describe("english curriculum bank", () => {
  it("has at least 3 problems for every english unit", () => {
    for (const { unit } of GRADE_2_ENGLISH_CURRICULUM) {
      expect(getCurriculumProblemsByUnit(unit).length, unit).toBeGreaterThanOrEqual(3);
    }
  });

  it.each(english.map((problem) => [problem.id, problem] as const))(
    "%s is a 4-choice question that contains its answer",
    (_id, problem) => {
      expect(problem.choices).toHaveLength(4);
      expect(new Set(problem.choices).size).toBe(4);
      expect(problem.choices).toContain(problem.correctAnswer);
      expect(problem.hints.answer).toBe(problem.correctAnswer);
    },
  );

  it("reads the answer aloud only in listening questions (sound → choose)", () => {
    for (const problem of english) {
      if (!problem.listenText) continue;
      if (problem.listenText.toLowerCase() === problem.correctAnswer.toLowerCase()) {
        expect(problem.problemText, problem.id).toContain("おとを きいて");
      }
    }
  });

  it("keeps child-facing text free of kanji without ruby and katakana readings for english words", () => {
    for (const problem of english) {
      for (const text of [problem.problemText, problem.subUnit, ...Object.values(problem.hints)]) {
        for (const part of toRubyParts(text)) {
          if (!part.ruby) expect(part.text, `${problem.id}: ${text}`).not.toMatch(KANJI);
        }
        expect(text, problem.id).not.toMatch(/[A-Za-z]+\s*[（(][ァ-ヶー]+[)）]/);
      }
    }
  });
});
