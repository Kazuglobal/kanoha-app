import { describe, expect, it } from "vitest";

import {
  parsedProblemSchema,
  similarProblemsSchema,
  allUnitSchema,
  allMistakeTypeSchema,
  japaneseUnitSchema,
} from "@/lib/ai/schemas";
import { GRADE_2_JAPANESE_UNITS } from "@/lib/curriculum/grade2Japanese";
import { JAPANESE_MISTAKE_TYPES } from "@/lib/curriculum/mistakeTypes";

const validJapaneseHints = {
  hint1: "文の中の『どこ』について聞かれているか確認しよう。",
  hint2: "主人公がうれしかったときの言葉を探してみよう。",
  solution: "『ありがとう』と言われた場面に注目すると、気持ちがわかります。",
  answer: "うれしい気持ち",
  praise: "よく場面を見つけられたね！",
};

describe("Japanese AI schemas", () => {
  it("accepts a valid Japanese reading problem", () => {
    const result = parsedProblemSchema.parse({
      problemText: "たけしさんは、どんな気持ちでしたか。文の中からさがしましょう。",
      detectedAnswer: "かなしい",
      correctAnswer: "うれしい気持ち",
      isCorrect: false,
      subject: "japanese",
      grade: 2,
      unit: "お話の読解",
      subUnit: "登場人物の気持ち",
      difficulty: "standard",
      mistakeType: "context_comprehension_error",
      mistakeReason: "主人公の気持ちを取りちがえています。",
      hints: validJapaneseHints,
      rubyTextRequired: true,
      recommendedVisualTemplate: null,
      similarProblemCount: 5,
    });

    expect(result.subject).toBe("japanese");
    expect(result.unit).toBe("お話の読解");
    expect(result.mistakeType).toBe("context_comprehension_error");
  });

  it("accepts a valid Japanese kanji problem", () => {
    const result = parsedProblemSchema.parse({
      problemText: "次の漢字の読み方をひらがなで書きましょう。「青空」",
      correctAnswer: "あおぞら",
      subject: "japanese",
      grade: 2,
      unit: "漢字",
      subUnit: "漢字の読み",
      difficulty: "basic",
      hints: {
        hint1: "「青」と「空」をそれぞれ読んでみよう。",
        hint2: "「青」は「あお」、「空」はにごって「ぞら」になるよ。",
        solution: "合わせて「あおぞら」と読みます。",
        answer: "あおぞら",
        praise: "漢字をよく見られたね！",
      },
      rubyTextRequired: false,
      recommendedVisualTemplate: null,
      similarProblemCount: 5,
    });

    expect(result.subject).toBe("japanese");
    expect(result.unit).toBe("漢字");
  });

  it("includes all Japanese units and mistake types in options", () => {
    expect(japaneseUnitSchema.options).toEqual([...GRADE_2_JAPANESE_UNITS]);
    for (const unit of GRADE_2_JAPANESE_UNITS) {
      expect(allUnitSchema.safeParse(unit).success).toBe(true);
    }
    for (const mistake of JAPANESE_MISTAKE_TYPES) {
      expect(allMistakeTypeSchema.safeParse(mistake.id).success).toBe(true);
    }
  });

  it("generates 5 valid Japanese similar problems", () => {
    const problem = {
      problemText: "次の漢字の読み方を書きましょう。「春風」",
      answer: "はるかぜ",
      unit: "漢字",
      subUnit: "漢字の読み",
      difficulty: "standard",
      explanation: "「春（はる）」と「風（かぜ）」で「はるかぜ」です。",
    };

    const parsed = similarProblemsSchema.parse({
      sourceProblemId: "prob-jp-1",
      similarProblems: Array.from({ length: 5 }, () => problem),
    });

    expect(parsed.similarProblems).toHaveLength(5);
    expect(parsed.similarProblems[0].unit).toBe("漢字");
  });
});
