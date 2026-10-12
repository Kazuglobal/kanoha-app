import { describe, expect, it } from "vitest";

import {
  hintsSchema,
  mistakeTypeSchema,
  parsedProblemSchema,
  similarProblemsSchema,
  unitSchema,
} from "@/lib/ai/schemas";
import { GRADE_2_MATH_UNITS } from "@/lib/curriculum/grade2Math";
import { MISTAKE_TYPE_IDS } from "@/lib/curriculum/mistakeTypes";

const validHints = {
  hint1: "Lは大きなかさのたんいだよ。",
  hint2: "1Lは100mLが10こ分だよ。",
  solution: "100mLを10こあつめます。",
  answer: "1000mL",
  praise: "たんいに気づけてえらいね。",
};

describe("AI output schemas", () => {
  it("accepts a valid parsed problem", () => {
    const result = parsedProblemSchema.parse({
      problemText: "1Lは何mLですか。",
      detectedAnswer: "100mL",
      correctAnswer: "1000mL",
      isCorrect: false,
      subject: "math",
      grade: 2,
      unit: "小数のしくみと計算",
      subUnit: "LとmL",
      difficulty: "standard",
      mistakeType: "unit_conversion_error",
      mistakeReason: "たんいをまちがえています。",
      hints: validHints,
      rubyTextRequired: true,
      recommendedVisualTemplate: "volume",
      similarProblemCount: 5,
    });

    expect(result.unit).toBe("小数のしくみと計算");
  });

  it("derives unit and mistakeType enums from the curriculum constants", () => {
    expect(unitSchema.options).toEqual([...GRADE_2_MATH_UNITS]);
    expect(mistakeTypeSchema.options).toEqual([...MISTAKE_TYPE_IDS]);
    expect(unitSchema.safeParse("かさ").success).toBe(false);
    expect(mistakeTypeSchema.safeParse("unit_confusion").success).toBe(false);
  });

  it("rejects text over the length limits", () => {
    const valid = {
      problemText: "1Lは何mLですか。",
      correctAnswer: "1000mL",
      subject: "math",
      grade: 2,
      unit: "小数のしくみと計算",
      subUnit: "LとmL",
      difficulty: "standard",
      hints: validHints,
      rubyTextRequired: true,
      recommendedVisualTemplate: null,
      similarProblemCount: 5,
    };
    expect(parsedProblemSchema.safeParse(valid).success).toBe(true);
    expect(parsedProblemSchema.safeParse({ ...valid, problemText: "あ".repeat(2001) }).success).toBe(false);
    expect(parsedProblemSchema.safeParse({ ...valid, subUnit: "あ".repeat(51) }).success).toBe(false);
    expect(parsedProblemSchema.safeParse({ ...valid, correctAnswer: "1".repeat(201) }).success).toBe(false);
    expect(hintsSchema.safeParse({ ...validHints, hint1: "あ".repeat(1001) }).success).toBe(false);
  });

  it("rejects inconsistent optional answer analysis", () => {
    expect(() =>
      parsedProblemSchema.parse({
        problemText: "1Lは何mLですか。",
        correctAnswer: "1000mL",
        isCorrect: false,
        subject: "math",
        grade: 2,
        unit: "小数のしくみと計算",
        subUnit: "LとmL",
        difficulty: "standard",
        hints: validHints,
        rubyTextRequired: true,
        recommendedVisualTemplate: null,
        similarProblemCount: 5,
      }),
    ).toThrow();
  });

  it("rejects hints with an empty answer", () => {
    expect(() => hintsSchema.parse({ ...validHints, answer: "" })).toThrow();
  });

  it("requires exactly five similar problems", () => {
    const problem = {
      problemText: "2Lは何mLですか。",
      answer: "2000mL",
      unit: "小数のしくみと計算",
      subUnit: "LとmL",
      difficulty: "standard",
      explanation: "1Lは1000mLです。",
    };

    expect(() =>
      similarProblemsSchema.parse({
        sourceProblemId: "problem-1",
        similarProblems: Array.from({ length: 4 }, () => problem),
      }),
    ).toThrow();

    expect(
      similarProblemsSchema.parse({
        sourceProblemId: "problem-1",
        similarProblems: Array.from({ length: 5 }, () => problem),
      }).similarProblems,
    ).toHaveLength(5);
  });
});
