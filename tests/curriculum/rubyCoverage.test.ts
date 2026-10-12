import { describe, expect, it } from "vitest";
import { CHILD_FIXED_STRINGS } from "@/components/child/childStrings";
import { mockAiProvider, mockProblems } from "@/lib/ai/mock";
import { DEMO_PRACTICE_STRINGS } from "@/lib/curriculum/demoCheck";
import { GRADE_2_MATH_CURRICULUM } from "@/lib/curriculum/grade2Math";
import { toRubyParts } from "@/lib/curriculum/toRubyParts";

const KANJI = /[一-鿿]/;

/** ルビ無しパートに漢字が残っていたら辞書漏れ(RubyAuto で素通しになる)。 */
const expectCovered = (text: string) => {
  for (const part of toRubyParts(text)) {
    if (!part.ruby) {
      expect(part.text, `辞書に無い漢字: "${part.text}" (in "${text}")`).not.toMatch(KANJI);
    }
  }
};

describe("ruby dictionary coverage (W6)", () => {
  it("covers every kanji in the fixed child-facing strings", () => {
    expect(CHILD_FIXED_STRINGS.length).toBeGreaterThan(30);
    for (const text of CHILD_FIXED_STRINGS) expectCovered(text);
    for (const text of DEMO_PRACTICE_STRINGS) expectCovered(text);
  });

  it("covers curriculum unit and sub-unit names", () => {
    for (const entry of GRADE_2_MATH_CURRICULUM) {
      expectCovered(entry.unit);
      for (const subUnit of entry.subUnits) expectCovered(subUnit);
    }
  });

  it("covers mock/demo problem texts, hints and similar problems", async () => {
    for (const problem of mockProblems) {
      expectCovered(problem.problemText);
      for (const value of Object.values(problem.hints)) expectCovered(value);
    }
    const standard = await mockAiProvider.generateHints("standard");
    const veryEasy = await mockAiProvider.generateHints("very_easy");
    for (const value of [...Object.values(standard), ...Object.values(veryEasy)]) {
      expectCovered(value);
    }
    const similars = await mockAiProvider.generateSimilarProblems({
      difficulty: "standard",
      problemText: "1Lは何mLですか。",
      subUnit: "LとmL",
      unit: "小数のしくみと計算",
    });
    for (const similar of similars) {
      expectCovered(similar.problemText);
      expectCovered(similar.explanation);
      expectCovered(similar.answer);
    }
  });
});
