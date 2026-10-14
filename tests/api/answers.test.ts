import { describe, expect, it } from "vitest";
import { answersMatch, toReading, matchChoiceFromSpeech } from "@/lib/utils/answers";
import { getCurriculumProblemsBySubject } from "@/lib/curriculum/curriculumBank";

describe("answersMatch", () => {
  it("normalizes full-width characters and whitespace", () => {
    expect(answersMatch(" １０００ mL ", "1000mL")).toBe(true);
  });

  it("accepts hiragana and katakana equivalents", () => {
    expect(answersMatch("アオゾラ", "あおぞら")).toBe(true);
    expect(answersMatch("あおぞら", "アオゾラ")).toBe(true);
  });

  it("accepts kanji equivalents from dictionary", () => {
    expect(answersMatch("青空", "あおぞら")).toBe(true);
    expect(answersMatch("あおぞら", "青空")).toBe(true);
  });

  it("does not accept a client-selected incorrect answer", () => {
    expect(answersMatch("100mL", "1000mL")).toBe(false);
  });

  it("accepts purely numeric input when expected answer has units (e.g. 1000 for 1000mL)", () => {
    expect(answersMatch("1000", "1000mL")).toBe(true);
    expect(answersMatch("１０００", "1000mL")).toBe(true);
    expect(answersMatch("1000ミリリットル", "1000mL")).toBe(true);
    expect(answersMatch("1000ml", "1000mL")).toBe(true);
    expect(answersMatch("1000みりりっとる", "1000mL")).toBe(true);
    expect(answersMatch("1000", "1000ミリリットル")).toBe(true);
  });

  it("accepts numeric input without units for various Grade 2 units", () => {
    expect(answersMatch("10", "10dL")).toBe(true);
    expect(answersMatch("100", "100cm")).toBe(true);
    expect(answersMatch("10", "10mm")).toBe(true);
    expect(answersMatch("60", "60分")).toBe(true);
    expect(answersMatch("43", "43こ")).toBe(true);
    expect(answersMatch("26", "26まい")).toBe(true);
    expect(answersMatch("12", "12個")).toBe(true);
    expect(answersMatch("3", "3つ")).toBe(true);
    expect(answersMatch("13", "13人")).toBe(true);
  });

  it("handles compound unit strings like 3L7dL and 3時45分", () => {
    expect(answersMatch("3リットル7デシリットル", "3L7dL")).toBe(true);
    expect(answersMatch("3l7dl", "3L7dL")).toBe(true);
    expect(answersMatch("3時45分", "3じ45ふん")).toBe(true);
    expect(answersMatch("3:45", "3時45分")).toBe(true);
  });

  it("accepts hiragana for kanji words with okurigana (国語)", () => {
    expect(answersMatch("ひくい", "低い")).toBe(true);
    expect(answersMatch("低い", "ひくい")).toBe(true);
    expect(answersMatch("ともだち", "友だち")).toBe(true);
    expect(answersMatch("たかい", "低い")).toBe(false);
  });

  it("ignores surrounding brackets and punctuation", () => {
    expect(answersMatch("「ひくい」", "低い")).toBe(true);
    expect(answersMatch("ひくい。", "低い")).toBe(true);
  });

  it("accepts either form when the expected answer carries a reading in parentheses", () => {
    expect(answersMatch("ひくい", "低い（ひくい）")).toBe(true);
    expect(answersMatch("低い", "低い(ひくい)")).toBe(true);
    expect(answersMatch("たかい", "低い（ひくい）")).toBe(false);
  });

  it("every 国語 bank answer written in kanji can also be answered in hiragana", () => {
    for (const problem of getCurriculumProblemsBySubject("japanese")) {
      const reading = toReading(problem.correctAnswer);
      expect(reading, problem.id).not.toMatch(/[\u4e00-\u9fff]/);
      expect(answersMatch(reading, problem.correctAnswer), problem.id).toBe(true);
    }
  });

  it("accepts kanji numbers (手書きや音声入力)", () => {
    expect(answersMatch("三", "3")).toBe(true);
    expect(answersMatch("十二", "12")).toBe(true);
    expect(answersMatch("三個", "3個")).toBe(true);
    expect(answersMatch("三こ", "3こ")).toBe(true);
    expect(answersMatch("百", "100")).toBe(true);
  });

  it("accepts hiragana numbers (音声入力)", () => {
    expect(answersMatch("さん", "3")).toBe(true);
    expect(answersMatch("じゅうに", "12")).toBe(true);
    expect(answersMatch("さんじゅうご", "35")).toBe(true);
    expect(answersMatch("さんこ", "3こ")).toBe(true);
    expect(answersMatch("さん", "3つ")).toBe(true);
  });

  it("strips spoken fillers like こたえは and 〜です (音声入力)", () => {
    expect(answersMatch("こたえは3です", "3")).toBe(true);
    expect(answersMatch("3です", "3")).toBe(true);
    expect(answersMatch("さんです", "3")).toBe(true);
    expect(answersMatch("あおぞらです", "あおぞら")).toBe(true);
    expect(answersMatch("答えは青空", "あおぞら")).toBe(true);
    expect(answersMatch("3こです", "3こ")).toBe(true);
  });
});

describe("matchChoiceFromSpeech", () => {
  const englishChoices = ["apple", "banana", "orange", "grape"];
  const japaneseChoices = ["いぬ", "ねこ", "うさぎ", "とり"];
  const mathChoices = ["12", "15", "18", "21"];

  it("matches choice by index or spoken position", () => {
    expect(matchChoiceFromSpeech("1番", englishChoices)).toBe("apple");
    expect(matchChoiceFromSpeech("2ばん", englishChoices)).toBe("banana");
    expect(matchChoiceFromSpeech("3つ目", englishChoices)).toBe("orange");
    expect(matchChoiceFromSpeech("4番目", englishChoices)).toBe("grape");
  });

  it("matches choice directly by text", () => {
    expect(matchChoiceFromSpeech("ねこ", japaneseChoices)).toBe("ねこ");
    expect(matchChoiceFromSpeech("ネコ", japaneseChoices)).toBe("ねこ");
    expect(matchChoiceFromSpeech("こたえはうさぎです", japaneseChoices)).toBe("うさぎ");
  });

  it("matches english words from katakana speech", () => {
    expect(matchChoiceFromSpeech("アップル", englishChoices)).toBe("apple");
    expect(matchChoiceFromSpeech("バナナ", englishChoices)).toBe("banana");
    expect(matchChoiceFromSpeech("こたえはりんごです", englishChoices)).toBe("apple");
  });

  it("matches math numbers from speech", () => {
    expect(matchChoiceFromSpeech("15", mathChoices)).toBe("15");
    expect(matchChoiceFromSpeech("じゅうご", mathChoices)).toBe("15");
    expect(matchChoiceFromSpeech("答えは12です", mathChoices)).toBe("12");
  });
});

