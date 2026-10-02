import { describe, expect, it } from "vitest";
import {
  CURRICULUM_PROBLEMS,
  getCurriculumProblemById,
  getCurriculumProblemsBySubject,
  getCurriculumProblemsByUnit,
  getNextCurriculumProblem,
  getCurriculumStageProgress,
  getCurriculumStages,
} from "@/lib/curriculum/curriculumBank";
import { toRubyParts } from "@/lib/curriculum/toRubyParts";

const KANJI = /[一-鿿]/;

const expectCovered = (text: string) => {
  for (const part of toRubyParts(text)) {
    if (!part.ruby) {
      expect(part.text, `辞書に無い漢字: "${part.text}" (in "${text}")`).not.toMatch(KANJI);
    }
  }
};

describe("Curriculum Bank", () => {
  it("contains rich problems for both math and japanese", () => {
    const mathProblems = getCurriculumProblemsBySubject("math");
    const japaneseProblems = getCurriculumProblemsBySubject("japanese");

    expect(mathProblems.length).toBeGreaterThanOrEqual(15);
    expect(japaneseProblems.length).toBeGreaterThanOrEqual(10);
  });

  it("finds problems by id", () => {
    const volume1 = getCurriculumProblemById("volume-1");
    expect(volume1).toBeDefined();
    expect(volume1?.correctAnswer).toBe("1000mL");

    const kanji1 = getCurriculumProblemById("kanji-1");
    expect(kanji1).toBeDefined();
    expect(kanji1?.correctAnswer).toBe("青空");
  });

  it("finds problems by unit", () => {
    const volumeProblems = getCurriculumProblemsByUnit("水のかさ");
    expect(volumeProblems.length).toBeGreaterThanOrEqual(3);

    const additionProblems = getCurriculumProblemsByUnit("たし算");
    expect(additionProblems.length).toBeGreaterThanOrEqual(3);
  });

  it("provides continuous next problem progression", () => {
    const next1 = getNextCurriculumProblem("volume-1");
    expect(next1).toBeDefined();
    expect(next1?.id).toBe("volume-2");

    const nextKanji1 = getNextCurriculumProblem("kanji-1");
    expect(nextKanji1).toBeDefined();
    expect(nextKanji1?.id).toBe("kanji-2");
  });

  it("calculates stage progress label correctly", () => {
    const progress = getCurriculumStageProgress("volume-1");
    expect(progress).toBeDefined();
    expect(progress?.unit).toBe("水のかさ");
    expect(progress?.index).toBe(1);
    expect(progress?.label).toContain("水のかさ 1 /");
  });

  it("returns stage cards for math and japanese", () => {
    const mathStages = getCurriculumStages("math");
    expect(mathStages.length).toBe(11);
    expect(mathStages[0].firstProblemId).toBeDefined();

    const japaneseStages = getCurriculumStages("japanese");
    expect(japaneseStages.length).toBeGreaterThanOrEqual(5);
    expect(japaneseStages[0].firstProblemId).toBeDefined();
  });

  it("ensures all curriculum bank problem texts and hints have ruby dictionary coverage", () => {
    for (const problem of CURRICULUM_PROBLEMS) {
      expectCovered(problem.problemText);
      expectCovered(problem.unit);
      expectCovered(problem.hints.hint1);
      expectCovered(problem.hints.hint2);
      expectCovered(problem.hints.solution);
      expectCovered(problem.hints.praise);
    }
  });
});
