import { describe, expect, it } from "vitest";
import {
  GRADE_2_MATH_CURRICULUM,
  isGrade2MathUnit,
  resolveVisualTemplate,
} from "@/lib/curriculum/grade2Math";
import {
  getCurriculumProblemById,
  getCurriculumProblemsByUnit,
  getCurriculumStages,
} from "@/lib/curriculum/curriculumBank";

describe("がい数とその計算 (Organizing Visual Template Unit) in Grade 4 Math", () => {
  it("includes がい数とその計算 in GRADE_2_MATH_CURRICULUM and GRADE_2_MATH_UNITS", () => {
    expect(isGrade2MathUnit("がい数とその計算")).toBe(true);
    const unitDef = GRADE_2_MATH_CURRICULUM.find((u) => u.id === "rounding");
    expect(unitDef).toBeDefined();
    expect(unitDef?.unit).toBe("がい数とその計算");
    expect(unitDef?.subUnits).toEqual([
      "四捨五入",
      "以上・以下・未満",
      "がい数の見積もり",
    ]);
    expect(unitDef?.visualTemplate).toBe("organizing");
  });

  it("resolves organizing visual template for variations", () => {
    expect(resolveVisualTemplate("がい数とその計算")).toBe("organizing");
    expect(resolveVisualTemplate("整理する力")).toBe("organizing");
    expect(resolveVisualTemplate("なかまわけ")).toBe("organizing");
    expect(resolveVisualTemplate("データを分類する")).toBe("organizing");
  });

  it("provides curriculum problems for がい数とその計算 in curriculumBank", () => {
    const problems = getCurriculumProblemsByUnit("がい数とその計算");
    expect(problems.length).toBeGreaterThanOrEqual(3);

    const p1 = getCurriculumProblemById("rounding-1");
    expect(p1).toBeDefined();
    expect(p1?.subject).toBe("math");
    expect(p1?.unit).toBe("がい数とその計算");
    expect(p1?.subUnit).toBe("四捨五入");
    expect(p1?.correctAnswer).toBe("300");
    expect(p1?.hints.praise).toBeDefined();

    const p2 = getCurriculumProblemById("rounding-2");
    expect(p2).toBeDefined();
    expect(p2?.correctAnswer).toBe("3000");

    const p3 = getCurriculumProblemById("rounding-3");
    expect(p3).toBeDefined();
    expect(p3?.correctAnswer).toBe("入る");
  });

  it("includes がい数とその計算 stage card in getCurriculumStages", () => {
    const stages = getCurriculumStages("math");
    const roundStage = stages.find((s) => s.id === "rounding");
    expect(roundStage).toBeDefined();
    expect(roundStage?.title).toBe("がい数とその計算");
    expect(roundStage?.emoji).toBe("🎯");
    expect(roundStage?.problemCount).toBeGreaterThanOrEqual(3);
    expect(roundStage?.firstProblemId).toBe("rounding-1");
  });
});
