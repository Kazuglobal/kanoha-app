import { describe, expect, it } from "vitest";
import {
  ENGLISH_NUMBERS,
  ENGLISH_WORDS,
  GREETINGS,
  LOOKALIKES,
  LOWERCASE,
  NAMES,
  POLITE_PHRASES,
  UPPERCASE,
} from "@/lib/curriculum/englishWords";

const KATAKANA = /[ァ-ヺヽ-ヿ]/;
const HIRAGANA_ONLY = /^[ぁ-ゟ ー、。]+$/;
const ALL_WORDS = [...ENGLISH_WORDS, ...ENGLISH_NUMBERS];

describe("英語の単語表", () => {
  it("英語は ASCII の小文字だけで、同じ語がない", () => {
    for (const item of ALL_WORDS) expect(item.en, item.en).toMatch(/^[a-z]+$/);
    expect(new Set(ALL_WORDS.map((item) => item.en)).size).toBe(ALL_WORDS.length);
  });

  it("絵(数字)はすべての語にあり、同じ絵を 2 つの語で使わない", () => {
    for (const item of ALL_WORDS) expect(item.emoji.length, item.en).toBeGreaterThan(0);
    expect(new Set(ALL_WORDS.map((item) => item.emoji)).size).toBe(ALL_WORDS.length);
  });

  it("ひらがなの意味は カタカナを まぜず、同じ分類の中で重ならない", () => {
    for (const item of ALL_WORDS) if (item.ja) expect(KATAKANA.test(item.ja), item.en).toBe(false);
    for (const category of ["animal", "color", "fruit", "food", "body"] as const) {
      const meanings = ENGLISH_WORDS.filter((item) => item.category === category && item.ja).map((item) => item.ja);
      expect(new Set(meanings).size, category).toBe(meanings.length);
    }
  });

  it("からだの語は ひらがなの意味を すべて持つ(選択肢をひらがなで出すため)", () => {
    for (const item of ENGLISH_WORDS.filter((word) => word.category === "body")) expect(item.ja, item.en).toBeTruthy();
  });

  it("どの分類にも、レベル 1 の語が 4 つ以上ある(4 択を作れる)", () => {
    for (const category of ["animal", "color", "fruit", "food", "body"] as const) {
      expect(ENGLISH_WORDS.filter((item) => item.category === category && item.level === 1).length, category).toBeGreaterThanOrEqual(4);
    }
  });

  it("語と絵の ひもづけ(見本)", () => {
    const pairs = new Map(ALL_WORDS.map((item) => [item.en, item.emoji]));
    expect(pairs.get("dog")).toBe("🐶");
    expect(pairs.get("cat")).toBe("🐱");
    expect(pairs.get("apple")).toBe("🍎");
    expect(pairs.get("red")).toBe("🔴");
    expect(pairs.get("blue")).toBe("🔵");
    expect(pairs.get("ear")).toBe("👂");
    expect(pairs.get("seven")).toBe("7");
    expect(pairs.get("twenty")).toBe("20");
  });

  it("1〜20 の数が順にそろっている", () => {
    expect(ENGLISH_NUMBERS).toHaveLength(20);
    expect(ENGLISH_NUMBERS.map((item) => item.emoji)).toEqual(Array.from({ length: 20 }, (_, index) => String(index + 1)));
  });
});

describe("アルファベットの表", () => {
  it("大文字・小文字が 26 字ずつ、対応している", () => {
    expect(UPPERCASE).toHaveLength(26);
    expect(LOWERCASE).toHaveLength(26);
    UPPERCASE.forEach((letter, index) => expect(letter.toLowerCase()).toBe(LOWERCASE[index]));
  });

  it("にている字の組は、4 字でそろった大文字か小文字", () => {
    for (const group of LOOKALIKES) {
      expect(new Set(group).size).toBe(group.length);
      expect(group.length).toBeGreaterThanOrEqual(4);
      const upper = group.every((letter) => UPPERCASE.includes(letter as (typeof UPPERCASE)[number]));
      const lower = group.every((letter) => LOWERCASE.includes(letter as (typeof LOWERCASE)[number]));
      expect(upper || lower, group.join("")).toBe(true);
    }
  });
});

describe("あいさつの表", () => {
  const all = [...GREETINGS, ...POLITE_PHRASES];

  it("英語は ASCII、日本語の意味・場面は ひらがなだけ、意味は重ならない", () => {
    for (const item of all) {
      expect(item.en).toMatch(/^[\x20-\x7E]+$/);
      expect(HIRAGANA_ONLY.test(item.ja), item.ja).toBe(true);
      expect(HIRAGANA_ONLY.test(item.situation), item.situation).toBe(true);
    }
    expect(new Set(all.map((item) => item.ja)).size).toBe(all.length);
    expect(new Set(all.map((item) => item.en)).size).toBe(all.length);
  });

  it("朝・昼・夕・夜の あいさつには 絵がある", () => {
    expect(GREETINGS).toHaveLength(4);
    expect(new Set(GREETINGS.map((item) => item.emoji)).size).toBe(4);
  });

  it("へんじのある ことばは 3 つ以上(へんじを えらぶ問題を作れる)", () => {
    expect(POLITE_PHRASES.filter((item) => item.reply).length).toBeGreaterThanOrEqual(3);
  });

  it("おわかれの 2 語は 同じ組(まぎらわしいので選択肢にいっしょに出さない)", () => {
    const groups = new Map(POLITE_PHRASES.map((item) => [item.en, item.group]));
    expect(groups.get("Goodbye.")).toBe(groups.get("See you."));
    expect(groups.get("Thank you.")).toBe(groups.get("You're welcome."));
  });

  it("名前の候補は 4 つ以上", () => {
    expect(NAMES.length).toBeGreaterThanOrEqual(4);
  });

  it("へんじを えらぶ問題の まちがいは 3 つ以上あり、へんじそのものや、名前を言う文は ふくまない(「Here you are.」のへんじを除く)", () => {
    for (const phrase of POLITE_PHRASES.filter((item) => item.reply)) {
      expect(phrase.wrongReplies?.length ?? 0, phrase.en).toBeGreaterThanOrEqual(3);
      expect(phrase.wrongReplies, phrase.en).not.toContain(phrase.reply);
    }
  });
});
