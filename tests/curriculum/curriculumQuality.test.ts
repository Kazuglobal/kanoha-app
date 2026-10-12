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

describe("小2の学びに合わせた問題の見直し", () => {
  it("英語のヒントは「◯で はじまる」で 答えを しぼらせない", () => {
    for (const problem of CURRICULUM_PROBLEMS.filter((p) => p.subject === "english")) {
      for (const hint of [problem.hints.hint1, problem.hints.hint2]) {
        const initial = hint.match(/^「([A-Za-z])」で はじまる/);
        if (!initial || !problem.choices) continue;
        const starts = problem.choices.filter((c) => c.toLowerCase().startsWith(initial[1].toLowerCase()));
        expect(starts.length, `${problem.id}: ${hint}`).toBeGreaterThan(1);
      }
    }
  });

  it("読解の問題には 読む文(【お話】【せつめい】)と 選択肢がある", () => {
    for (const id of ["reading-story-1", "reading-explanation-1"]) {
      const problem = getCurriculumProblemById(id);
      expect(problem?.problemText).toMatch(/^【(お話|せつめい)】/);
      expect(problem?.choices?.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("国語の答えに 2年で習わない「低」を使わない", () => {
    expect(getCurriculumProblemById("vocabulary-1")?.correctAnswer).toBe("ひくい");
    expect(checkDemoAnswer("vocabulary-1", "低い")?.correct).toBe(true);
  });

  it.each([
    ["fractions-2", "1/4"],
    ["fractions-2", "4ぶんの1"],
    ["fractions-3", "8分の1"],
    ["time-3", "24"],
    ["length-4", "5cm9mm"],
    ["boxes-2", "12ほん"],
    ["kanji-5", "新しい"],
    ["large-numbers-3", "307"],
  ])("%s は「%s」を正解にする", (id, answer) => {
    expect(checkDemoAnswer(id, answer)?.correct).toBe(true);
  });

  it("分数の書きかえで ちがう分数を正解にしない", () => {
    expect(checkDemoAnswer("fractions-2", "1/8")?.correct).toBe(false);
    expect(checkDemoAnswer("fractions-2", "4")?.correct).toBe(false);
  });

  it("作文と表現のステージが出る(問題がある)", () => {
    expect(CURRICULUM_PROBLEMS.filter((p) => p.unit === "作文と表現").length).toBeGreaterThanOrEqual(2);
  });
});
