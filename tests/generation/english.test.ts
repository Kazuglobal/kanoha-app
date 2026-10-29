import { describe, expect, it } from "vitest";
import { ENGLISH_NUMBERS, ENGLISH_WORDS, GREETINGS, LOOKALIKES, LOWERCASE, POLITE_PHRASES, UPPERCASE, type EnglishWord } from "@/lib/curriculum/englishWords";
import { ENGLISH_GENERATORS } from "@/lib/generation/generators/english";
import type { GeneratedProblem } from "@/lib/generation/types";
import { LEVELS, type Level } from "@/lib/learning/level";
import { describeBasics, generateAt } from "./support";

const byName = (subUnit: string) => ENGLISH_GENERATORS.find((entry) => entry.subUnit === subUnit)!;
const build = (subUnit: string, level: Level): GeneratedProblem[] => generateAt(byName(subUnit), level);

const WORD_UNITS = [
  ["どうぶつの名前", "animal"],
  ["いろの名前", "color"],
  ["くだもの", "fruit"],
  ["たべもの", "food"],
  ["からだの名前", "body"],
] as const;
const ALL_WORDS: readonly EnglishWord[] = [...ENGLISH_WORDS, ...ENGLISH_NUMBERS];
const wordOf = (en: string): EnglishWord => ALL_WORDS.find((item) => item.en === en)!;
const meaningOf = (item: EnglishWord) => (item.category === "body" ? item.ja! : item.emoji);
const LOOKS_THE_SAME = ["I", "l"];

describe("英語の生成器: 小単元がそろっている", () => {
  it("英語の単元表の小単元が、すべて生成器を持つ", () => {
    const expected = [
      ["アルファベット", "大文字"], ["アルファベット", "小文字"], ["アルファベット", "大文字と小文字"],
      ["あいさつ", "朝と昼のあいさつ"], ["あいさつ", "おれいとおわかれ"], ["あいさつ", "名前をつたえる"],
      ["えいごのかず", "1から10"], ["えいごのかず", "11から20"],
      ["いろ", "いろの名前"], ["どうぶつ", "どうぶつの名前"],
      ["たべもの", "くだもの"], ["たべもの", "たべもの"], ["からだ", "からだの名前"],
    ];
    expect(ENGLISH_GENERATORS.map((entry) => [entry.unit, entry.subUnit])).toEqual(expected);
  });
});

describeBasics(ENGLISH_GENERATORS, { choiceLevels: [...LEVELS], minVariety: () => 3 });

describe("単語の問題: 絵・英語・意味が合う", () => {
  const SUB_UNITS = [...WORD_UNITS.map(([name]) => name), "1から10", "11から20"];
  const itemOf = (problem: GeneratedProblem): EnglishWord =>
    problem.listenText ? wordOf(problem.listenText) : ALL_WORDS.find((word) => problem.problemText.startsWith(`${word.emoji} は`))!;

  it.each(SUB_UNITS)("%s: レベルごとの形式で、答えが合い、選択肢が同じ分類の語", (subUnit) => {
    for (const level of LEVELS) {
      for (const problem of build(subUnit, level)) {
        const text = problem.problemText;
        const item = itemOf(problem);
        const sameCategory = (choices: readonly string[], toWord: (choice: string) => EnglishWord) => choices.every((choice) => toWord(choice).category === item.category);
        if (level === 1 || level === 4) {
          expect(problem.correctAnswer, text).toBe(item.emoji);
          expect(sameCategory(problem.choices!, (choice) => ALL_WORDS.find((word) => word.emoji === choice)!), text).toBe(true);
        } else if (level === 2) {
          expect(problem.listenText).toBeUndefined();
          expect(problem.correctAnswer, text).toBe(item.en);
          expect(sameCategory(problem.choices!, wordOf), text).toBe(true);
        } else if (level === 3) {
          expect(text).toBe(`「${item.en}」は どれですか。`);
          expect(problem.listenText).toBe(item.en);
          expect(problem.correctAnswer, text).toBe(meaningOf(item));
        } else {
          expect(problem.correctAnswer, text).toBe(item.en);
          expect(sameCategory(problem.choices!, wordOf), text).toBe(true);
        }
      }
    }
  });

  it.each(WORD_UNITS)("%s: 出題する語の むずかしさが レベルの上限をこえない", (subUnit, category) => {
    const caps: Record<Level, number> = { 1: 1, 2: 2, 3: 2, 4: 3, 5: 3 };
    for (const level of LEVELS) {
      for (const problem of build(subUnit, level)) {
        const target = itemOf(problem);
        expect(target.category).toBe(category);
        expect(target.level, `${subUnit} L${level}: ${target.en}`).toBeLessThanOrEqual(caps[level]);
      }
    }
  });

  it("数: 1から10 は 1〜10、11から20 は 11〜20 だけ", () => {
    for (const level of LEVELS) {
      for (const problem of build("1から10", level)) expect(Number(itemOf(problem).emoji)).toBeLessThanOrEqual(10);
      for (const problem of build("11から20", level)) expect(Number(itemOf(problem).emoji)).toBeGreaterThanOrEqual(11);
    }
  });

  it("ヒントは「はじめの字」「字数」で答えをしぼらない(選択肢をひとつにしない)", () => {
    for (const entry of ENGLISH_GENERATORS) {
      for (const level of LEVELS) {
        for (const problem of generateAt(entry, level, ["h1", "h2", "h3", "h4"])) {
          for (const hint of [problem.hints.hint1, problem.hints.hint2]) {
            expect(hint, `${entry.subUnit} L${level}`).not.toMatch(/から はじまる|もじの ことば/);
          }
        }
      }
    }
  });

  it("絵が似た語(face と mouth、penguin と bird)を単語表に入れない", () => {
    expect(ENGLISH_WORDS.some((item) => item.en === "face")).toBe(false);
    expect(ENGLISH_WORDS.some((item) => item.en === "penguin")).toBe(false);
  });
});

describe("アルファベット", () => {
  it("レベル 1・2: きいた もじ(大文字の名前で読む)が答え。レベル 2 は にている字だけがならぶ", () => {
    for (const [subUnit, all] of [["大文字", UPPERCASE], ["小文字", LOWERCASE]] as const) {
      for (const level of [1, 2] as const) {
        for (const problem of build(subUnit, level)) {
          expect(problem.listenText).toBe(problem.correctAnswer.toUpperCase());
          expect(problem.choices!.every((choice) => (all as readonly string[]).includes(choice))).toBe(true);
          const group = LOOKALIKES.find((candidate) => candidate.includes(problem.correctAnswer));
          if (level === 2 && group && group.length >= 4) {
            expect(new Set(problem.choices)).toEqual(new Set(group));
          }
        }
      }
    }
  });

  it("つぎの もじ・□に はいる もじ・まえの もじ が合い、I と l は問題文に出ない", () => {
    for (const [subUnit, all] of [["大文字", UPPERCASE], ["小文字", LOWERCASE]] as const) {
      for (const problem of build(subUnit, 3)) {
        const shown = /「(.)」/.exec(problem.problemText)![1];
        expect(LOOKS_THE_SAME).not.toContain(shown);
        expect(problem.correctAnswer).toBe(all[all.indexOf(shown as never) + 1]);
      }
      for (const problem of build(subUnit, 4)) {
        const match = /^(.) (.) □ (.) のように/.exec(problem.problemText)!;
        expect(match.slice(1).some((letter) => LOOKS_THE_SAME.includes(letter))).toBe(false);
        const missing = all[all.indexOf(match[2] as never) + 1];
        expect(problem.correctAnswer).toBe(missing);
        expect(all[all.indexOf(missing as never) + 1]).toBe(match[3]);
      }
      for (const problem of build(subUnit, 5)) {
        const shown = /「(.)」/.exec(problem.problemText)![1];
        expect(LOOKS_THE_SAME).not.toContain(shown);
        expect(problem.correctAnswer).toBe(all[all.indexOf(shown as never) - 1]);
      }
    }
  });

  it("大文字と小文字: ペアが合い、見せる字に I と l を使わない", () => {
    for (const level of LEVELS) {
      for (const problem of build("大文字と小文字", level)) {
        const source = problem.listenText ?? /「(.)」/.exec(problem.problemText)![1];
        expect(LOOKS_THE_SAME).not.toContain(source);
        const upper = UPPERCASE.includes(source as never);
        const expected = upper ? source.toLowerCase() : source.toUpperCase();
        expect(problem.correctAnswer).toBe(level === 5 ? source.toLowerCase() : expected);
      }
    }
  });
});

describe("あいさつ", () => {
  const PICTURES = ["🌅", "☀️", "🌆", "😴"];

  it("朝・昼・夕・夜の絵は 4 つで、どれも別の場面(夕と夜を同じ絵にしない)", () => {
    expect(GREETINGS.map((item) => item.emoji)).toEqual(PICTURES);
  });

  it("朝と昼: 英語・日本語・絵・場面が対応している", () => {
    for (const level of LEVELS) {
      for (const problem of build("朝と昼のあいさつ", level)) {
        const item = GREETINGS.find((greeting) =>
          level <= 2
            ? greeting.en === problem.listenText
            : level === 3
              ? problem.problemText.startsWith(`${greeting.emoji} の`)
              : level === 4
                ? problem.problemText.startsWith(`${greeting.situation}の`)
                : problem.problemText.startsWith(`「${greeting.ja}」`),
        )!;
        const expected = level === 1 ? item.emoji : level === 2 ? item.ja : item.en;
        expect(problem.correctAnswer, problem.problemText).toBe(expected);
      }
    }
  });

  it("おれいとおわかれ: 対応が合い、同じ場面で使える ことばを 選択肢に並べない", () => {
    for (const level of LEVELS) {
      for (const problem of build("おれいとおわかれ", level)) {
        if (level === 5) {
          const item = POLITE_PHRASES.find((phrase) => phrase.en === problem.listenText)!;
          expect(problem.correctAnswer).toBe(item.reply);
          continue;
        }
        const item = POLITE_PHRASES.find((phrase) =>
          level === 1 || level === 3
            ? phrase.en === problem.listenText
            : level === 2
              ? problem.problemText.startsWith(`「${phrase.ja}」`)
              : problem.problemText.startsWith(`${phrase.situation}、`),
        )!;
        const pick = (phrase: (typeof POLITE_PHRASES)[number]) => (level === 1 ? phrase.ja : level === 3 ? phrase.situation : phrase.en);
        expect(problem.correctAnswer, problem.problemText).toBe(pick(item));
        const sameGroup = POLITE_PHRASES.filter((phrase) => phrase.group === item.group && phrase !== item).map(pick);
        for (const choice of problem.choices!) expect(sameGroup).not.toContain(choice);
      }
    }
  });

  it("へんじをえらぶ問題: 3 種類の言葉がそろい、名前を言う文は「Nice to meet you.」のへんじに並ばない", () => {
    const heard = new Set(build("おれいとおわかれ", 5).map((problem) => problem.listenText));
    expect(heard.size).toBe(3);
    for (const problem of build("名前をつたえる", 4)) {
      expect(problem.choices!.filter((choice) => /^My name is /.test(choice))).toEqual([]);
    }
  });

  it("名前をつたえる: こたえる文・名前・へんじ・聞きわけ", () => {
    for (const problem of build("名前をつたえる", 1)) {
      expect(problem.listenText).toBe("What's your name?");
      expect(problem.correctAnswer).toMatch(/^My name is [A-Z][a-z]+\.$/);
      expect(problem.choices!.filter((choice) => /^My name is /.test(choice))).toHaveLength(1);
    }
    for (const problem of build("名前をつたえる", 2)) {
      expect(problem.listenText).toBe(`My name is ${problem.correctAnswer}.`);
    }
    for (const problem of build("名前をつたえる", 3)) {
      expect(problem.listenText).toBe("How are you?");
      expect(problem.correctAnswer).toBe("I'm fine, thank you.");
    }
    for (const problem of build("名前をつたえる", 4)) {
      expect(problem.listenText).toBe("Nice to meet you.");
      expect(problem.correctAnswer).toBe("Nice to meet you, too.");
    }
    const answers: Record<string, RegExp> = {
      "What's your name?": /^My name is [A-Z][a-z]+\.$/,
      "How are you?": /^I'm fine, thank you\.$/,
      "Nice to meet you.": /^Nice to meet you, too\.$/,
    };
    const heard = new Set<string>();
    for (const problem of build("名前をつたえる", 5)) {
      heard.add(problem.listenText!);
      expect(problem.correctAnswer).toMatch(answers[problem.listenText!]);
    }
    expect(heard.size).toBe(3);
  });
});

describe("英語の問題は書かせない・カタカナを付けない", () => {
  it("すべての問題に 4 択があり、カタカナがない", () => {
    for (const entry of ENGLISH_GENERATORS) {
      for (const level of LEVELS) {
        for (const problem of generateAt(entry, level, ["a", "b", "c"])) {
          expect(problem.choices).toHaveLength(4);
          const shown = [problem.problemText, ...problem.choices!, ...Object.values(problem.hints)].join("");
          expect(/[ァ-ヺヽ-ヿ]/.test(shown), `${entry.subUnit} L${level}: ${problem.problemText}`).toBe(false);
        }
      }
    }
  });
});
