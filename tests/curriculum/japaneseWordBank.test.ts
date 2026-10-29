import { describe, expect, it } from "vitest";
import { misspellings } from "@/lib/generation/generators/japanese";
import { ANTONYMS, LOANWORDS, NATIVE_WORDS, ONOMATOPOEIA, WORD_CATEGORIES } from "@/lib/curriculum/japaneseWordBank";

const KATAKANA_TO_HIRAGANA = (text: string) =>
  [...text].map((char) => (char >= "ァ" && char <= "ヶ" ? String.fromCharCode(char.charCodeAt(0) - 0x60) : char)).join("");

describe("はんたいの意味の ことば", () => {
  const words = ANTONYMS.flatMap((item) => [item.a, item.b]);

  it("どの ことばも 1 つの組にしか入っていない(はんたいが 1 つにきまる)", () => {
    expect(new Set(words).size).toBe(words.length);
  });

  it("どの種類も、意味の近くない組が 2 組以上ほかにある(まちがい候補をつくれる)", () => {
    for (const kind of ["adjective", "position", "verb"] as const) {
      const of = ANTONYMS.filter((item) => item.kind === kind);
      expect(new Set(of.map((item) => item.cluster)).size, kind).toBeGreaterThanOrEqual(3);
    }
  });

  it("ひらがなだけ", () => {
    for (const word of words) expect(word, word).toMatch(/^[ぁ-ゖ]+$/);
  });
});

describe("なかま分け", () => {
  const all = WORD_CATEGORIES.flatMap((item) => item.words);

  it("どの ことばも 1 つの なかまにしか入っていない", () => {
    expect(new Set(all).size).toBe(all.length);
  });

  it("どのなかまも 4 つ以上の ことばがあり、名前(ラベル)がちがう", () => {
    for (const item of WORD_CATEGORIES) expect(item.words.length, item.id).toBeGreaterThanOrEqual(4);
    expect(new Set(WORD_CATEGORIES.map((item) => item.label)).size).toBe(WORD_CATEGORIES.length);
  });

  it("ひらがな・カタカナだけ", () => {
    for (const word of all) expect(word, word).toMatch(/^[ぁ-ゖァ-ヺー]+$/);
  });
});

describe("様子を表す言葉", () => {
  it("ことばも 場面も かさならず、どの種類も 5 つ以上", () => {
    expect(new Set(ONOMATOPOEIA.map((item) => item.word)).size).toBe(ONOMATOPOEIA.length);
    expect(new Set(ONOMATOPOEIA.map((item) => item.scene)).size).toBe(ONOMATOPOEIA.length);
    for (const kind of ["animal", "weather", "manner", "feeling"] as const) {
      expect(ONOMATOPOEIA.filter((item) => item.kind === kind).length, kind).toBeGreaterThanOrEqual(5);
    }
  });

  it("なきごえ・おとはカタカナ、ようすはひらがなで書く(2年生のきまり)", () => {
    const isKatakana = (word: string) => /^[ァ-ヺー]+$/.test(word);
    const isHiragana = (word: string) => /^[ぁ-ゖー]+$/.test(word);
    for (const item of ONOMATOPOEIA) {
      const isSound = item.scene.endsWith("なきごえ") || item.scene.endsWith("おと");
      expect(isSound ? isKatakana(item.word) : isHiragana(item.word), `${item.word}: ${item.scene}`).toBe(true);
    }
  });

  it("「ころがる」に ひびく 3 つ(ころころ・ゴロゴロ・ぐるぐる)は同じ cluster で、いっしょに出さない", () => {
    const rolling = ONOMATOPOEIA.filter((item) => item.cluster === "roll").map((item) => item.word);
    expect(rolling.sort()).toEqual(["ぐるぐる", "ころころ", "ゴロゴロ"].sort());
  });
});

describe("くだもの・からだ", () => {
  it("「もも」は からだ(ふともも)ともよめるので、くだものに入れない", () => {
    const fruit = WORD_CATEGORIES.find((item) => item.id === "fruit")!.words;
    expect(fruit).not.toContain("もも");
    expect(fruit).not.toContain("いちご");
    expect(fruit).not.toContain("すいか");
  });
});

describe("カタカナの ことば", () => {
  it("ひらがなは カタカナを ひらがなに直したものと同じで、どれもかさならない", () => {
    for (const item of LOANWORDS) expect(item.hiragana, item.katakana).toBe(KATAKANA_TO_HIRAGANA(item.katakana));
    expect(new Set(LOANWORDS.map((item) => item.katakana)).size).toBe(LOANWORDS.length);
  });

  it("どの ことばも、3 つ以上の まちがったつづりを作れる", () => {
    for (const item of LOANWORDS) expect(misspellings(item.katakana).length, item.katakana).toBeGreaterThanOrEqual(3);
  });

  it("まちがったつづりは、答えとも 本当の ことばとも ちがう", () => {
    for (const item of LOANWORDS) {
      for (const wrong of misspellings(item.katakana)) {
        expect(wrong).not.toBe(item.katakana);
        expect(LOANWORDS.map((other) => other.katakana)).not.toContain(wrong);
      }
    }
  });

  it("ふつう ひらがなで書く ことばは、カタカナの ことばのひらがなとかさならない", () => {
    expect(NATIVE_WORDS.length).toBeGreaterThanOrEqual(8);
    for (const word of NATIVE_WORDS) expect(LOANWORDS.map((item) => item.hiragana)).not.toContain(word);
  });
});
