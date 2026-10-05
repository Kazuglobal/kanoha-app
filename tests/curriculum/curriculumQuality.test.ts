import { describe, expect, it } from "vitest";
import { CURRICULUM_PROBLEMS, getCurriculumProblemById } from "@/lib/curriculum/curriculumBank";
import { checkDemoAnswer } from "@/lib/curriculum/demoCheck";

describe("問題バンクの品質", () => {
  it("選択肢がある問題は、答えを必ず 1 つだけ含む", () => {
    for (const problem of CURRICULUM_PROBLEMS) {
      if (!problem.choices) continue;
      const hits = problem.choices.filter((choice) => choice === problem.correctAnswer);
      expect(hits, problem.id).toHaveLength(1);
      expect(new Set(problem.choices).size, problem.id).toBe(problem.choices.length);
    }
  });

  it("「公園（　）行く」は へ を選択式で聞き、文として正しい「に」を選択肢に出さない", () => {
    const problem = getCurriculumProblemById("sentences-2");
    expect(problem?.choices).toContain("へ");
    expect(problem?.choices).not.toContain("に");
    expect(problem?.hints.hint2).not.toContain("に」");
    expect(checkDemoAnswer("sentences-2", "へ")?.correct).toBe(true);
    expect(checkDemoAnswer("sentences-2", "え")?.correct).toBe(false);
  });
});
