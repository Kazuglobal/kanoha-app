import { describe, expect, it } from "vitest";

import {
  buildAnalyzeProblemsPrompt,
  buildHandwritingPrompt,
  buildHintsPrompt,
  buildSimilarProblemsPrompt,
} from "@/lib/ai/prompts";
import { GRADE_2_JAPANESE_UNITS } from "@/lib/curriculum/grade2Japanese";

describe("Japanese AI prompts", () => {
  it("builds 4-step hint prompt for japanese coach", () => {
    const prompt = buildHintsPrompt(
      "たけしさんは、どんな気持ちでしたか。",
      "standard",
      "japanese",
    );

    expect(prompt).toContain("こくごコーチ");
    expect(prompt).toContain("hint1、hint2、solution、answerの順");
    expect(prompt).toContain("問いの注目点や文中の手がかり");
    expect(prompt).toContain("praiseで必ずほめてください");
  });

  it("builds hints prompt for very_easy level in japanese", () => {
    const prompt = buildHintsPrompt(
      "次の漢字の読み方を書きましょう。「春風」",
      "very_easy",
      "japanese",
    );

    expect(prompt).toContain("こくごコーチ");
    expect(prompt).toContain("説明レベル: very_easy");
  });

  it("builds similar problems prompt for japanese curriculum", () => {
    const prompt = buildSimilarProblemsPrompt({
      difficulty: "standard",
      problemText: "次の漢字の読み方を書きましょう。「青空」",
      subUnit: "漢字の読み",
      unit: "漢字",
      subject: "japanese",
      mistakeType: "reading_error",
    });

    expect(prompt).toContain("小学2年生向け国語教材を作るAI");
    expect(prompt).toContain("単元: 漢字 / 漢字の読み");
    expect(prompt).toContain("改善したい間違え方: reading_error");
    expect(prompt).toContain("類題をちょうど5問");
  });

  it("builds analyze problems prompt with japanese units", () => {
    const prompt = buildAnalyzeProblemsPrompt(GRADE_2_JAPANESE_UNITS, "japanese");

    expect(prompt).toContain("国語学習を支援するAI");
    expect(prompt).toContain("漢字");
    expect(prompt).toContain("お話の読解");
    expect(prompt).toContain("説明文の読解");
  });

  it("builds handwriting prompt for japanese text recognition", () => {
    const prompt = buildHandwritingPrompt("漢字の読み方を書きましょう。", "japanese");

    expect(prompt).toContain("国語の手書き回答を読み取るAI");
    expect(prompt).toContain("文字（ひらがな、カタカナ、漢字、ことば）");
  });
});
