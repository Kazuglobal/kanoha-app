import "server-only";
import {
  ENGLISH_NUMBERS,
  ENGLISH_WORDS,
  LOOKALIKES,
  LOWERCASE,
  UPPERCASE,
  type EnglishWord,
  type WordCategory,
} from "@/lib/curriculum/englishWords";
import type { Level } from "@/lib/learning/level";
import { pickMany, pickOne } from "@/lib/utils/random";
import { specEntry, type ProblemSpec, type SpecContext } from "../helpers";
import type { GeneratorEntry } from "../types";
import { ENGLISH_PHRASE_GENERATORS } from "./englishPhrases";

const CATEGORY_LABEL: Readonly<Record<WordCategory, string>> = {
  animal: "どうぶつ",
  color: "いろ",
  fruit: "くだもの",
  food: "たべもの",
  body: "からだ",
  number: "かず",
};

type Format = "listenPicture" | "pictureWord" | "wordMeaning" | "listenWord";
interface Plan {
  readonly format: Format;
  /** 出題する語の むずかしさの上限(EnglishWord.level) */
  readonly maxLevel: 1 | 2 | 3;
}

/**
 * 単語の小単元の、レベルごとの出し方。聞く・えらぶ中心で、書かせない。
 * 1 = きいて えをえらぶ / 2 = えを見て 英語を えらぶ / 3 = 英語を見て(きいて)意味を えらぶ /
 * 4 = きいて えをえらぶ(すべての語) / 5 = きいて 英語を えらぶ。文字が出ない 4・5 のほうが 3 よりむずかしい。
 */
const WORD_PLANS: Readonly<Record<Level, Plan>> = {
  1: { format: "listenPicture", maxLevel: 1 },
  2: { format: "pictureWord", maxLevel: 2 },
  3: { format: "wordMeaning", maxLevel: 2 },
  4: { format: "listenPicture", maxLevel: 3 },
  5: { format: "listenWord", maxLevel: 3 },
};

const wordsOf = (category: WordCategory, maxLevel: number): EnglishWord[] =>
  ENGLISH_WORDS.filter((item) => item.category === category && item.level <= maxLevel);

/** 小単元ごとに、出題に使う語の集まり。 */
function poolOf(subUnit: string, plan: Plan): readonly EnglishWord[] {
  switch (subUnit) {
    case "どうぶつの名前":
      return wordsOf("animal", plan.maxLevel);
    case "いろの名前":
      return wordsOf("color", plan.maxLevel);
    case "くだもの":
      return wordsOf("fruit", plan.maxLevel);
    case "たべもの":
      return wordsOf("food", plan.maxLevel);
    case "からだの名前":
      return wordsOf("body", plan.maxLevel);
    case "1から10":
      return ENGLISH_NUMBERS.slice(0, plan.maxLevel === 1 ? 5 : 10);
    case "11から20":
      return ENGLISH_NUMBERS.slice(10, plan.maxLevel === 1 ? 15 : plan.maxLevel === 2 ? 17 : 20);
    default:
      throw new RangeError(`no word pool for ${subUnit}`);
  }
}

/** 絵の代わりに ひらがなで答えさせる語(からだ)。それ以外は絵。 */
const meaningOf = (item: EnglishWord): string => (item.category === "body" ? item.ja! : item.emoji);

/**
 * ヒントは、選択肢をひとつにしぼらない(はじめの字や字数は、選択肢の顔ぶれで答えが分かってしまうので使わない)。
 * ヒント 1 は、教科ごとの固定ヒント(subjects.ts)と同じ文にしない。
 */
function wordProblem(item: EnglishWord, pool: readonly EnglishWord[], format: Format): ProblemSpec {
  const others = pool.filter((candidate) => candidate.en !== item.en);
  const label = CATEGORY_LABEL[item.category];
  const meaning = item.ja ?? item.emoji;
  switch (format) {
    case "listenPicture":
      return {
        problemText: "えいごを きいて、あう えを えらぼう。",
        listenText: item.en,
        answer: item.emoji,
        wrong: others.map((candidate) => candidate.emoji),
        hint1: "おとを ゆっくり きいてみよう。",
        hint2: `${label}の えを おもいうかべて みよう。`,
        solution: `「${item.en}」は「${meaning}」のことだよ。`,
      };
    case "pictureWord":
      return {
        problemText: `${item.emoji} は えいごで どれですか。`,
        answer: item.en,
        wrong: others.map((candidate) => candidate.en),
        hint1: "えを よく みて、なんの えか かんがえよう。",
        hint2: `${label}の えいごを おもいだしてみよう。`,
        solution: `${item.emoji} は えいごで「${item.en}」だよ。`,
      };
    case "wordMeaning":
      return {
        problemText: `「${item.en}」は どれですか。`,
        listenText: item.en,
        answer: meaningOf(item),
        wrong: others.map(meaningOf),
        hint1: "えいごの おとを ゆっくり きいてみよう。",
        hint2: `${label}の なかまの ことばだよ。`,
        solution: `「${item.en}」は「${meaning}」のことだよ。`,
      };
    default:
      return {
        problemText: "きこえた えいごは どれですか。",
        listenText: item.en,
        answer: item.en,
        wrong: others.map((candidate) => candidate.en),
        hint1: "おとを よく きいてみよう。",
        hint2: `${label}の えいごを おもいうかべてみよう。`,
        solution: `きこえたのは「${item.en}」だよ。`,
      };
  }
}

function words(subUnit: string): (context: SpecContext) => ProblemSpec {
  return ({ random, level }) => {
    const plan = WORD_PLANS[level];
    const pool = poolOf(subUnit, plan);
    return wordProblem(pickOne(random, pool), pool, plan.format);
  };
}

/**
 * 大文字の I と小文字の l は、画面の字体では同じ形に見える。
 * 問題文に見せる字(どの字を聞くか)には使わない。選択肢は大文字だけ・小文字だけなので、答えや まちがいに出てもよい。
 */
const LOOKS_THE_SAME = new Set(["I", "l"]);

/** 同じ大文字・小文字の仲間(まぎらわしい字)から、まちがい候補を 3 つ以上つくる。 */
function confusables(letter: string, all: readonly string[], random: () => number): string[] {
  const group = LOOKALIKES.find((candidate) => candidate.includes(letter));
  const near = group ? group.filter((item) => item !== letter) : [];
  // にている字が 3 つそろうときは、それだけを まちがいに並べる(いちばん まぎらわしい 4 択)
  if (near.length >= 3) return near;
  return [...near, ...pickMany(random, all.filter((item) => item !== letter && !near.includes(item)), 3)];
}

const randomOthers = (letter: string, all: readonly string[], random: () => number): string[] =>
  pickMany(random, all.filter((item) => item !== letter), 6);

/** 文字の並び(つぎ・□・まえ)で聞く文字と、その並びの中での位置。見せる字に I・l が入らない位置だけを選ぶ。 */
function sequenceIndex(random: () => number, all: readonly string[], level: 3 | 4 | 5): number {
  const range = level === 3 ? [0, all.length - 2] : level === 4 ? [2, all.length - 3] : [1, all.length - 1];
  const shown = (index: number) => (level === 3 ? [index] : level === 4 ? [index - 2, index - 1, index + 1] : [index]);
  const options = Array.from({ length: range[1] - range[0] + 1 }, (_, offset) => range[0] + offset).filter(
    (index) => !shown(index).some((position) => LOOKS_THE_SAME.has(all[position])),
  );
  return pickOne(random, options);
}

/** 聞いた文字・つぎの文字・まちがいさがし。upper = 大文字を出す。 */
function letters(upper: boolean): (context: SpecContext) => ProblemSpec {
  const all = upper ? UPPERCASE : LOWERCASE;
  const kind = upper ? "大文字" : "小文字";
  return ({ random, level }) => {
    if (level <= 2) {
      const letter = pickOne(random, all);
      return {
        problemText: `えいごを きいて、あう ${kind}を えらぼう。`,
        // 小さい字は、そのまま読むと ちがう音になることがあるので、字の名前が読まれる大文字で読み上げる
        listenText: letter.toUpperCase(),
        answer: letter,
        wrong: level === 1 ? randomOthers(letter, all, random) : confusables(letter, all, random),
        hint1: "おとを ゆっくり きいてみよう。",
        hint2: "もじの かたちを おもいうかべて みよう。",
        solution: `きこえたのは「${letter}」だよ。`,
      };
    }
    const index = sequenceIndex(random, all, level as 3 | 4 | 5);
    const answer = all[level === 3 ? index + 1 : level === 4 ? index : index - 1];
    const text =
      level === 3
        ? `「${all[index]}」の つぎの もじは どれですか。`
        : level === 4
          ? `${all[index - 2]} ${all[index - 1]} □ ${all[index + 1]} のように ならんでいます。□に はいる もじは どれですか。`
          : `「${all[index]}」の まえの もじは どれですか。`;
    return {
      problemText: text,
      answer,
      wrong: randomOthers(answer, all, random).filter((item) => item !== all[index]),
      hint1: "ABCの うたを おもいだしてみよう。",
      hint2: "じゅんばんに ならべて かんがえよう。",
      solution: `じゅんばんに ならべると「${answer}」だよ。`,
    };
  };
}

/** 大文字と小文字の ペア。 */
function letterPairs({ random, level }: SpecContext): ProblemSpec {
  const toLower = level <= 2 || level === 5;
  const choices = Array.from({ length: UPPERCASE.length }, (_, index) => index).filter(
    (index) => !LOOKS_THE_SAME.has(UPPERCASE[index]) && !LOOKS_THE_SAME.has(LOWERCASE[index]),
  );
  const index = pickOne(random, choices);
  const source = toLower ? UPPERCASE[index] : LOWERCASE[index];
  const target = toLower ? LOWERCASE[index] : UPPERCASE[index];
  const targets: readonly string[] = toLower ? LOWERCASE : UPPERCASE;
  const fuzzy = level >= 2;
  const common = {
    answer: target,
    wrong: fuzzy ? confusables(target, targets, random) : randomOthers(target, targets, random),
    hint1: "かたちを くらべてみよう。",
    hint2: "ABCの うたを おもいだして、おなじ もじを さがそう。",
    solution: `「${source}」の ${toLower ? "小文字" : "大文字"}は「${target}」だよ。`,
  };
  if (level === 5) {
    return { ...common, problemText: "きいた もじの 小文字は どれですか。", listenText: source.toUpperCase() };
  }
  return { ...common, problemText: toLower ? `大文字「${source}」と おなじ もじの 小文字は どれですか。` : `小文字「${source}」の 大文字は どれですか。` };
}

const entry = (
  unit: string,
  subUnit: string,
  build: (context: SpecContext) => ProblemSpec,
  levels: GeneratorEntry["levels"],
): GeneratorEntry => specEntry({ subject: "english", unit, subUnit, levels }, build);

const wordLevels = (label: string): GeneratorEntry["levels"] => ({
  1: `${label}: きいて えを えらぶ(なじみの語)`,
  2: `${label}: えを見て 英語を えらぶ`,
  3: `${label}: 英語を見て(きいて)意味を えらぶ`,
  4: `${label}: きいて えを えらぶ(すべての語)`,
  5: `${label}: きいて 英語を えらぶ`,
});

export const ENGLISH_GENERATORS: readonly GeneratorEntry[] = [
  entry("アルファベット", "大文字", letters(true), {
    1: "きいて 大文字を えらぶ",
    2: "きいて 大文字を えらぶ(にている字がならぶ)",
    3: "つぎの もじ",
    4: "ならびの □に はいる もじ",
    5: "まえの もじ",
  }),
  entry("アルファベット", "小文字", letters(false), {
    1: "きいて 小文字を えらぶ",
    2: "きいて 小文字を えらぶ(にている字がならぶ)",
    3: "つぎの もじ",
    4: "ならびの □に はいる もじ",
    5: "まえの もじ",
  }),
  entry("アルファベット", "大文字と小文字", letterPairs, {
    1: "大文字 → 小文字",
    2: "大文字 → 小文字(にている字がならぶ)",
    3: "小文字 → 大文字",
    4: "小文字 → 大文字(にている字がならぶ)",
    5: "きいた もじの 小文字",
  }),
  ...ENGLISH_PHRASE_GENERATORS,
  entry("えいごのかず", "1から10", words("1から10"), wordLevels("1から10")),
  entry("えいごのかず", "11から20", words("11から20"), wordLevels("11から20")),
  entry("いろ", "いろの名前", words("いろの名前"), wordLevels("いろ")),
  entry("どうぶつ", "どうぶつの名前", words("どうぶつの名前"), wordLevels("どうぶつ")),
  entry("たべもの", "くだもの", words("くだもの"), wordLevels("くだもの")),
  entry("たべもの", "たべもの", words("たべもの"), wordLevels("たべもの")),
  entry("からだ", "からだの名前", words("からだの名前"), wordLevels("からだ")),
];

