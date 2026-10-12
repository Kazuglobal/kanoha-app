import { describe, expect, it } from "vitest";
import { buildProblemRecords } from "@/lib/ai/buildProblemRecords";
import type { ParsedProblem } from "@/lib/ai/schemas";

const problem: ParsedProblem = {
  correctAnswer: "1000mL",
  difficulty: "standard",
  grade: 2,
  hints: {
    answer: "1000mL",
    hint1: "1Lの中には、100mLがいくつあるかな。",
    hint2: "100mLが10こで1Lだよ。",
    praise: "よく考えたね。",
    solution: "100を10こあわせます。",
  },
  problemText: "1Lは何mLですか。",
  recommendedVisualTemplate: "volume",
  rubyTextRequired: true,
  similarProblemCount: 5,
  subUnit: "LとmL",
  subject: "math",
  unit: "水のかさ",
};

describe("buildProblemRecords", () => {
  it("maps parsed problems to problem table rows for the given child and material", () => {
    const records = buildProblemRecords([problem], "child-1", "material-1");

    expect(records).toEqual([
      {
        child_id: "child-1",
        correct_answer: "1000mL",
        difficulty: "standard",
        explanation_json: {
          ...problem.hints,
          ...(problem.mistakeType ? { mistakeType: problem.mistakeType } : {}),
          ...(problem.mistakeReason ? { mistakeReason: problem.mistakeReason } : {}),
        },
        grade: 2,
        material_id: "material-1",
        problem_text: "1Lは何mLですか。",
        status: "active",
        sub_unit: "LとmL",
        subject: "math",
        unit: "水のかさ",
      },
    ]);
  });

  it("returns one record per parsed problem", () => {
    const records = buildProblemRecords([problem, problem], "child-1", "material-1");
    expect(records).toHaveLength(2);
  });
});

describe("buildProblemExplanation (A4: AI diagnosis must survive into problems.explanation_json)", () => {
  it("keeps mistakeType and mistakeReason next to the hints when the analysis diagnosed a wrong answer", async () => {
    const { buildProblemExplanation } = await import("@/lib/ai/buildProblemRecords");
    const { parsedProblemSchema } = await import("@/lib/ai/schemas");
    const diagnosed = parsedProblemSchema.parse({
      problemText: "1Lは何mLですか。",
      detectedAnswer: "100mL",
      correctAnswer: "1000mL",
      isCorrect: false,
      subject: "math",
      grade: 2,
      unit: "水のかさ",
      subUnit: "LとmL",
      difficulty: "standard",
      mistakeType: "unit_conversion_error",
      mistakeReason: "1Lを100mLと勘違いしている可能性があります。",
      hints: { hint1: "h1", hint2: "h2", solution: "s", answer: "1000mL", praise: "p" },
      rubyTextRequired: true,
      recommendedVisualTemplate: "volume",
      similarProblemCount: 5,
    });
    expect(buildProblemExplanation(diagnosed)).toEqual({
      ...diagnosed.hints,
      mistakeType: "unit_conversion_error",
      mistakeReason: "1Lを100mLと勘違いしている可能性があります。",
    });
  });

  it("omits the diagnosis keys when the analysis had no handwritten answer", async () => {
    const { buildProblemExplanation } = await import("@/lib/ai/buildProblemRecords");
    const { parsedProblemSchema } = await import("@/lib/ai/schemas");
    const plain = parsedProblemSchema.parse({
      problemText: "2Lは何mLですか。",
      correctAnswer: "2000mL",
      subject: "math",
      grade: 2,
      unit: "水のかさ",
      subUnit: "LとmL",
      difficulty: "standard",
      hints: { hint1: "h1", hint2: "h2", solution: "s", answer: "2000mL", praise: "p" },
      rubyTextRequired: true,
      recommendedVisualTemplate: "volume",
      similarProblemCount: 5,
    });
    expect(buildProblemExplanation(plain)).toEqual(plain.hints);
  });
});
