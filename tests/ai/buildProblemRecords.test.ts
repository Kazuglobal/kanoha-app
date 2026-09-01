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
        explanation_json: problem.hints,
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
