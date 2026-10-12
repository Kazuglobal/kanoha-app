import { describe, expect, it } from "vitest";

import { scrubPiiFromHints, scrubPiiFromProblem, scrubPii, scrubPiiFromSimilarProblem } from "@/lib/ai/pii";
import type { ParsedProblem, SimilarProblemDraft } from "@/lib/ai/schemas";

describe("scrubPii", () => {
  it.each([
    ["みどり小学校の こくばん", "〇〇の こくばん"],
    ["ひがし小の うんどうかい", "〇〇の うんどうかい"],
    ["あおば中学校の おにいさん", "〇〇の おにいさん"],
    ["やまだ先生に みせよう", "〇〇に みせよう"],
    ["2年3組の みんな", "〇〇の みんな"],
    ["3組の ともだち", "〇〇の ともだち"],
    ["なまえ: たろう", "〇〇"],
    ["名前:はなこ です", "〇〇 です"],
    ["氏名: 山田太郎", "〇〇"],
    ["東京都新宿区に すんでいます", "〇〇に すんでいます"],
    ["北海道札幌市の おみせ", "〇〇の おみせ"],
  ])("scrubs %s", (input, expected) => {
    expect(scrubPii(input)).toBe(expected);
  });

  it("does NOT scrub 学年表記(『2年生』はクラス名ではない)", () => {
    expect(scrubPii("2年生の もんだいです。")).toBe("2年生の もんだいです。");
  });

  it("leaves ordinary math text untouched", () => {
    const text = "1Lは何mLですか。100mLが10こで1Lです。";
    expect(scrubPii(text)).toBe(text);
  });
});

const hints = {
  answer: "1000mL",
  hint1: "みどり小学校で ならったね。",
  hint2: "100mLが10こだよ。",
  praise: "やまだ先生も よろこぶよ。",
  solution: "100を10こ あつめます。",
};

describe("scrub helpers", () => {
  it("scrubPiiFromHints scrubs texts but keeps the answer untouched", () => {
    const scrubbed = scrubPiiFromHints(hints);
    expect(scrubbed.hint1).toBe("〇〇で ならったね。");
    expect(scrubbed.praise).toBe("〇〇も よろこぶよ。");
    expect(scrubbed.answer).toBe("1000mL");
    expect(scrubbed.hint2).toBe(hints.hint2);
  });

  it("scrubPiiFromProblem scrubs problemText / hints / mistakeReason and keeps enums and answers", () => {
    const problem: ParsedProblem = {
      problemText: "みどり小学校の 2年3組で くばられた もんだい。1Lは何mLですか。",
      correctAnswer: "1000mL",
      subject: "math",
      grade: 2,
      unit: "小数のしくみと計算",
      subUnit: "LとmL",
      difficulty: "standard",
      mistakeReason: undefined,
      hints,
      rubyTextRequired: true,
      recommendedVisualTemplate: "volume",
      similarProblemCount: 5,
    };
    const scrubbed = scrubPiiFromProblem(problem);
    expect(scrubbed.problemText).toBe("〇〇の 〇〇で くばられた もんだい。1Lは何mLですか。");
    expect(scrubbed.hints.hint1).toBe("〇〇で ならったね。");
    expect(scrubbed.correctAnswer).toBe("1000mL");
    expect(scrubbed.unit).toBe("小数のしくみと計算");
    expect(scrubbed.mistakeReason).toBeUndefined();
    // 元オブジェクトは変更しない(イミュータブル)
    expect(problem.problemText).toContain("小学校");
  });

  it("scrubPiiFromProblem scrubs a present mistakeReason", () => {
    const problem: ParsedProblem = {
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
      mistakeReason: "やまだ先生の せつめいと ちがうやり方をした。",
      hints,
      rubyTextRequired: true,
      recommendedVisualTemplate: null,
      similarProblemCount: 5,
    };
    expect(scrubPiiFromProblem(problem).mistakeReason).toBe("〇〇の せつめいと ちがうやり方をした。");
  });

  it("scrubPiiFromSimilarProblem scrubs problemText and explanation, keeps the answer", () => {
    const draft: SimilarProblemDraft = {
      problemText: "ひがし小の プールに 2Lの 水を いれます。何mLですか。",
      answer: "2000mL",
      unit: "小数のしくみと計算",
      subUnit: "LとmL",
      difficulty: "standard",
      explanation: "みどり小学校でも ならう かんがえ方です。",
    };
    const scrubbed = scrubPiiFromSimilarProblem(draft);
    expect(scrubbed.problemText).toBe("〇〇の プールに 2Lの 水を いれます。何mLですか。");
    expect(scrubbed.explanation).toBe("〇〇でも ならう かんがえ方です。");
    expect(scrubbed.answer).toBe("2000mL");
  });
});
