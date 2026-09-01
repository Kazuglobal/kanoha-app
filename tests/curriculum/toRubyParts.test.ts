import { describe, expect, it } from "vitest";
import { toHiragana, toRubyParts } from "@/lib/curriculum/toRubyParts";

describe("toRubyParts", () => {
  it("annotates a known kanji with ruby and preserves the original text", () => {
    const parts = toRubyParts("1Lは何mLですか");
    const annotated = parts.find((part) => part.text === "何");
    expect(annotated?.ruby).toBe("なん");
    expect(parts.map((part) => part.text).join("")).toBe("1Lは何mLですか");
  });

  it("returns a single ruby-less part when there is no kanji", () => {
    const parts = toRubyParts("すうじ");
    expect(parts).toEqual([{ text: "すうじ" }]);
  });

  it("groups a contiguous kanji compound into one ruby part (longest match)", () => {
    const suuji = toRubyParts("数字");
    expect(suuji).toEqual([{ text: "数字", ruby: "すうじ" }]);

    const mondai = toRubyParts("問題");
    expect(mondai).toEqual([{ text: "問題", ruby: "もんだい" }]);
  });

  it("passes unknown kanji through without ruby", () => {
    const parts = toRubyParts("湊");
    expect(parts).toEqual([{ text: "湊" }]);
  });

  it("preserves the full string when mixing known and unknown segments", () => {
    const parts = toRubyParts("湊で問題");
    expect(parts.map((part) => part.text).join("")).toBe("湊で問題");
    expect(parts.find((part) => part.text === "問題")?.ruby).toBe("もんだい");
  });
});

describe("toHiragana", () => {
  it("replaces known kanji with their reading", () => {
    expect(toHiragana("1Lは何mL")).toBe("1LはなんmL");
  });

  it("replaces contiguous compounds", () => {
    expect(toHiragana("数字を計算する")).toBe("すうじをけいさんする");
  });

  it("leaves unknown kanji unchanged", () => {
    expect(toHiragana("湊で問題")).toBe("湊でもんだい");
  });
});
