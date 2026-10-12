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

describe("整理する力 (Organizing Unit) in Grade 2 Math", () => {
  it("includes 整理する力 in GRADE_2_MATH_CURRICULUM and GRADE_2_MATH_UNITS", () => {
    expect(isGrade2MathUnit("整理する力")).toBe(true);
    const unitDef = GRADE_2_MATH_CURRICULUM.find((u) => u.id === "organizing");
    expect(unitDef).toBeDefined();
    expect(unitDef?.unit).toBe("整理する力");
    expect(unitDef?.subUnits).toEqual([
      "なかまわけ",
      "整理してかぞえる",
      "表や図にあらわす",
    ]);
    expect(unitDef?.visualTemplate).toBe("organizing");
  });

  it("resolves organizing visual template for variations", () => {
    expect(resolveVisualTemplate("整理する力")).toBe("organizing");
    expect(resolveVisualTemplate("なかまわけ")).toBe("organizing");
    expect(resolveVisualTemplate("データを分類する")).toBe("organizing");
  });

  it("provides curriculum problems for 整理する力 in curriculumBank", () => {
    const problems = getCurriculumProblemsByUnit("整理する力");
    expect(problems.length).toBeGreaterThanOrEqual(3);

    const p1 = getCurriculumProblemById("organizing-1");
    expect(p1).toBeDefined();
    expect(p1?.subject).toBe("math");
    expect(p1?.unit).toBe("整理する力");
    expect(p1?.subUnit).toBe("なかまわけ");
    expect(p1?.correctAnswer).toBe("4こ");
    expect(p1?.hints.praise).toBeDefined();

    const p2 = getCurriculumProblemById("organizing-2");
    expect(p2).toBeDefined();
    expect(p2?.correctAnswer).toBe("12こ");

    const p3 = getCurriculumProblemById("organizing-3");
    expect(p3).toBeDefined();
    expect(p3?.correctAnswer).toBe("ドッジボール");
  });

  it("includes 整理する力 stage card in getCurriculumStages", () => {
    const stages = getCurriculumStages("math");
    const organizingStage = stages.find((s) => s.id === "organizing");
    expect(organizingStage).toBeDefined();
    expect(organizingStage?.title).toBe("整理する力");
    expect(organizingStage?.emoji).toBe("📁");
    expect(organizingStage?.problemCount).toBeGreaterThanOrEqual(3);
    expect(organizingStage?.firstProblemId).toBe("organizing-1");
  });
});
