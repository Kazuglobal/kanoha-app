import "server-only";
import { KANJI_WORDS, type KanjiWord } from "@/lib/curriculum/gradeKanji";
import { ANTONYMS, LOANWORDS, NATIVE_WORDS, ONOMATOPOEIA, WORD_CATEGORIES, type Loanword, type Onomatopoeia } from "@/lib/curriculum/japaneseWordBank";
import type { Level } from "@/lib/learning/level";
import { pickMany, pickOne, shuffle } from "@/lib/utils/random";
import { specEntry, type ProblemSpec, type SpecContext } from "../helpers";
import type { GeneratorEntry } from "../types";
import { JAPANESE_SENTENCE_GENERATORS } from "./japaneseSentences";

/** 漢字の問題で、レベルごとに出す語。1年→2年、1字→熟語・送りがな の順にむずかしくなる。 */
const KANJI_POOLS: Readonly<Record<Level, (word: KanjiWord) => boolean>> = {
  1: (word) => word.grade === 1 && word.kind === "single",
  2: (word) => word.grade === 1 && word.kind === "compound",
  3: (word) => word.grade === 2 && word.kind === "single",
  4: (word) => word.grade === 2 && word.kind === "compound",
  5: () => true,
};

/** 同じ長さに近い語を先に、まちがい候補にする。 */
const closeTo = <T>(items: readonly T[], size: (item: T) => number, target: number): T[] => {
  const near = items.filter((item) => Math.abs(size(item) - target) <= 1);
  return near.length >= 3 ? near : [...items];
};

// ヒントは、はじめの字や字数で選択肢をひとつにしぼらない(答えのヒントだけが答えを教える)
function kanjiReading({ random, level }: SpecContext): ProblemSpec {
  const pool = KANJI_WORDS.filter(KANJI_POOLS[level]);
  const target = pickOne(random, pool);
  const others = closeTo(pool.filter((item) => item.reading !== target.reading), (item) => item.reading.length, target.reading.length);
  return {
    problemText: `『${target.word}』は なんと よみますか。`,
    answer: target.reading,
    wrong: others.map((item) => item.reading),
    hint1: "ことばの いみを おもいうかべて、よみかたを かんがえよう。",
    hint2: "その ことばを つかった ぶんを おもいだして、よんでみよう。",
    solution: `『${target.word}』は「${target.reading}」と よむよ。`,
  };
}

function kanjiWriting({ random, level }: SpecContext): ProblemSpec {
  const pool = KANJI_WORDS.filter(KANJI_POOLS[level]);
  const target = pickOne(random, pool);
  const others = closeTo(pool.filter((item) => item.word !== target.word), (item) => item.word.length, target.word.length);
  return {
    problemText: `「${target.reading}」を かんじで かくと どれですか。`,
    answer: target.word,
    wrong: others.map((item) => item.word),
    hint1: "ひらがなを よんで、どんな ことばか かんがえよう。",
    hint2: "ことばの いみを おもいうかべて、かんじの かたちを おもいだしてみよう。",
    solution: `「${target.reading}」は『${target.word}』と かくよ。`,
  };
}

const ANTONYM_KINDS: Readonly<Record<Level, readonly ("adjective" | "position" | "verb")[]>> = {
  1: ["adjective"],
  2: ["position"],
  3: ["verb"],
  4: ["adjective", "verb"],
  5: ["adjective", "position", "verb"],
};

/** はんたいの意味の ことば。 */
function antonyms({ random, level }: SpecContext): ProblemSpec {
  const pair = pickOne(random, ANTONYMS.filter((item) => ANTONYM_KINDS[level].includes(item.kind)));
  const [asked, answer] = random() < 0.5 ? [pair.a, pair.b] : [pair.b, pair.a];
  // 意味が近い組(同じ cluster)は まちがいに出さない。どちらも はんたいに なりうるため
  const sameKind = ANTONYMS.filter((item) => item.cluster !== pair.cluster && item.kind === pair.kind);
  const pool = sameKind.length >= 2 ? sameKind : ANTONYMS.filter((item) => item.cluster !== pair.cluster);
  return {
    problemText: `『${asked}』の はんたいの いみの ことばは どれですか。`,
    answer,
    wrong: pool.flatMap((item) => [item.a, item.b]),
    hint1: "いみが はんたいに なる ことばを かんがえよう。",
    hint2: "ことばを つかった ぶんを つくって かんがえてみよう。",
    solution: `『${asked}』の はんたいは『${answer}』だよ。`,
  };
}

/** なかまはずれの 2 つの分類が「にている」組(くだもの/やさい、がっき/ぶんぼうぐ)。 */
const CLOSE_CATEGORIES: Readonly<Record<string, string>> = {
  fruit: "vegetable",
  vegetable: "fruit",
  instrument: "stationery",
  stationery: "instrument",
};
/** レベル 1 のなかまはずれ: 家(3つのなかま)と、まったくちがう分類。 */
const FAR_HOMES = new Set(["animal", "vehicle", "season", "color"]);
const FAR_OUTSIDERS = new Set(["fruit", "vegetable", "instrument", "stationery"]);

function oddOneOut(random: () => number, level: 1 | 2 | 3): ProblemSpec {
  const homes = WORD_CATEGORIES.filter((item) =>
    level === 1 ? FAR_HOMES.has(item.id) : level === 3 ? item.id in CLOSE_CATEGORIES : item.words.length >= 3,
  );
  const home = pickOne(random, homes);
  const outsiders = WORD_CATEGORIES.filter((item) => {
    if (item.id === home.id) return false;
    if (level === 1) return FAR_OUTSIDERS.has(item.id);
    return level === 3 ? item.id === CLOSE_CATEGORIES[home.id] : item.id !== CLOSE_CATEGORIES[home.id];
  });
  const members = pickMany(random, home.words, 3);
  const outsider = pickOne(random, pickOne(random, outsiders).words);
  return {
    problemText: "つぎの ことばの うち、なかまはずれは どれですか。",
    answer: outsider,
    wrong: members,
    hint1: "ことばを ひとつずつ よんで、なかまを かんがえよう。",
    hint2: "3つは おなじ なかまだよ。ひとつだけ ちがうよ。",
    solution: `${members.join("、")}は「${home.label}」。「${outsider}」だけが ちがうよ。`,
  };
}

function categories({ random, level }: SpecContext): ProblemSpec {
  if (level <= 3) return oddOneOut(random, level as 1 | 2 | 3);
  const home = pickOne(random, WORD_CATEGORIES.filter((item) => item.words.length >= 3));
  const rest = WORD_CATEGORIES.filter((item) => item.id !== home.id);
  if (level === 4) {
    const words = pickMany(random, home.words, 3);
    return {
      problemText: `${words.map((word) => `『${word}』`).join("")}は なんの なかまですか。`,
      answer: home.label,
      wrong: rest.map((item) => item.label),
      hint1: "ことばを ひとつずつ よんで、あてはまる なまえを かんがえよう。",
      hint2: "3つとも あてはまる なまえを さがそう。",
      solution: `${words.join("、")}は「${home.label}」の なかまだよ。`,
    };
  }
  return {
    problemText: `『${home.label}』の なかまは どれですか。`,
    answer: pickOne(random, home.words),
    wrong: rest.flatMap((item) => pickMany(random, item.words, 1)),
    hint1: "ひとつずつ ことばを よんで、なかまを かんがえよう。",
    hint2: `『${home.label}』と いえる ものを さがそう。`,
    solution: `『${home.label}』の なかまは、${home.words.slice(0, 3).join("、")} などだよ。`,
  };
}

const SOUND_KINDS: Readonly<Record<Level, readonly Onomatopoeia["kind"][]>> = {
  1: ["animal"],
  2: ["weather"],
  3: ["manner"],
  4: ["feeling"],
  5: ["animal", "weather", "manner", "feeling"],
};

const SOUND_HINTS: Readonly<Record<Onomatopoeia["kind"], string>> = {
  animal: "どうぶつの なきごえを おもいうかべてみよう。",
  weather: "てんきの おとや ようすを おもいうかべよう。",
  manner: "ものの うごきや ようすを おもいうかべよう。",
  feeling: "そのときの きもちを おもいうかべよう。",
};

/** 様子を表す言葉。意味が近い語(cluster が同じ)は まちがいに出さない。 */
function onomatopoeia({ random, level }: SpecContext): ProblemSpec {
  const pool = ONOMATOPOEIA.filter((item) => SOUND_KINDS[level].includes(item.kind));
  const target = pickOne(random, pool);
  return {
    problemText: `「${target.scene}」を あらわす ことばは どれですか。`,
    answer: target.word,
    wrong: pool.filter((item) => item.word !== target.word && (!target.cluster || item.cluster !== target.cluster)).map((item) => item.word),
    hint1: "ようすや おとを おもいうかべてみよう。",
    hint2: SOUND_HINTS[target.kind],
    solution: `「${target.scene}」は「${target.word}」と いうよ。`,
  };
}

const SMALL_KANA = /[ッャュョ]/;
const LOANWORD_POOLS: Readonly<Record<2 | 3 | 4 | 5, (word: Loanword) => boolean>> = {
  2: (word) => !word.katakana.includes("ー") && !SMALL_KANA.test(word.katakana),
  3: (word) => word.katakana.includes("ー") && !SMALL_KANA.test(word.katakana),
  4: (word) => SMALL_KANA.test(word.katakana),
  5: (word) => word.katakana.length >= 4,
};

const DAKUTEN_ROWS = ["カガ", "キギ", "クグ", "ケゲ", "コゴ", "サザ", "シジ", "スズ", "セゼ", "ソゾ", "タダ", "チヂ", "テデ", "トド", "ハバパ", "ヒビピ", "フブプ", "ヘベペ", "ホボポ"];
const LOOKALIKE = ["ンソ", "シツ", "スヌ", "アマ", "ウワ", "クタ", "ノメ"];
const SMALL_TO_LARGE: Readonly<Record<string, string>> = { ッ: "ツ", ャ: "ヤ", ュ: "ユ", ョ: "ヨ" };
const VOWEL_OF: Readonly<Record<string, string>> = Object.fromEntries(
  [
    ["ア", "アカガサザタダナハバパマヤラワャ"], ["イ", "イキギシジチニヒビピミリ"], ["ウ", "ウクグスズツヌフブプムユルュ"],
    ["エ", "エケゲセゼテデネヘベペメレ"], ["オ", "オコゴソゾトドノホボポモヨロョ"],
  ].flatMap(([vowel, kana]) => [...kana].map((char) => [char, vowel])),
);

/** 1 か所だけまちがえた つづり(だくてんの有無・長音・小さい字・にた字・字の入れかえ)。 */
export function misspellings(word: string): string[] {
  const chars = [...word];
  const swapAt = (index: number, replacement: string) => chars.map((char, i) => (i === index ? replacement : char)).join("");
  const found = chars.flatMap((char, index) => {
    const row = DAKUTEN_ROWS.find((candidate) => candidate.includes(char));
    const siblings = row ? [...row].filter((other) => other !== char).map((other) => swapAt(index, other)) : [];
    const similar = LOOKALIKE.filter((pair) => pair.includes(char)).map((pair) => swapAt(index, pair.replace(char, "")));
    const small = SMALL_TO_LARGE[char] ? [swapAt(index, SMALL_TO_LARGE[char])] : [];
    const longVowel = char === "ー" && index > 0 && VOWEL_OF[chars[index - 1]] ? [swapAt(index, VOWEL_OF[chars[index - 1]])] : [];
    const swapped = index < chars.length - 1 ? [chars.map((c, i) => (i === index ? chars[index + 1] : i === index + 1 ? chars[index] : c)).join("")] : [];
    return [...siblings, ...similar, ...small, ...longVowel, ...swapped];
  });
  return [...new Set(found)].filter((candidate) => candidate !== word && !LOANWORDS.some((item) => item.katakana === candidate));
}

/** カタカナで書く ことばを えらぶ(ふつうの ことばは ひらがな)。 */
function recognizeLoanword(random: () => number): ProblemSpec {
  const loan = pickOne(random, LOANWORDS);
  return {
    problemText: "つぎの うち、カタカナで かく ことばは どれですか。",
    answer: loan.hiragana,
    wrong: shuffle(NATIVE_WORDS, random).slice(0, 5),
    hint1: "ふだん ひらがなで かく ことばと、カタカナで かく ことばを わけて かんがえよう。",
    hint2: "がいこくから きた ことばは カタカナで かくよ。",
    solution: `「${loan.hiragana}」は がいこくから きた ことばなので、カタカナで「${loan.katakana}」と かくよ。`,
  };
}

/** ひらがなの語を、正しいカタカナのつづりで書く。 */
function spellLoanword(random: () => number, level: 2 | 3 | 4 | 5): ProblemSpec {
  const word = pickOne(random, LOANWORDS.filter(LOANWORD_POOLS[level]));
  return {
    problemText: `「${word.hiragana}」を カタカナで かくと どれですか。`,
    answer: word.katakana,
    wrong: misspellings(word.katakana),
    hint1: "ことばの おとを ひとつずつ たしかめよう。",
    hint2: "ちいさい「ッ」や、ながく のばす「ー」に ちゅういしよう。",
    solution: `「${word.hiragana}」は カタカナで「${word.katakana}」と かくよ。`,
  };
}

const katakana = ({ random, level }: SpecContext): ProblemSpec =>
  level === 1 ? recognizeLoanword(random) : spellLoanword(random, level as 2 | 3 | 4 | 5);

const entry = (
  unit: string,
  subUnit: string,
  build: (context: SpecContext) => ProblemSpec,
  levels: GeneratorEntry["levels"],
): GeneratorEntry => specEntry({ subject: "japanese", unit, subUnit, levels }, build);

const KANJI_LEVELS = (kind: string): GeneratorEntry["levels"] => ({
  1: `${kind}: 1年の漢字(1字)`,
  2: `${kind}: 1年の漢字(熟語・送りがな)`,
  3: `${kind}: 2年の漢字(1字)`,
  4: `${kind}: 2年の漢字(熟語・送りがな)`,
  5: `${kind}: 1・2年の漢字 いろいろ`,
});

export const JAPANESE_GENERATORS: readonly GeneratorEntry[] = [
  entry("漢字", "漢字の読み", kanjiReading, KANJI_LEVELS("読み")),
  entry("漢字", "漢字の書き", kanjiWriting, KANJI_LEVELS("書き(えらぶ)")),
  entry("ことばのきまり", "反対の意味の言葉", antonyms, {
    1: "形容詞(大きい ↔ 小さい など)",
    2: "位置のことば(うえ ↔ した など)",
    3: "動くことば(いく ↔ くる など)",
    4: "形容詞と動くことば",
    5: "すべての はんたいのことば",
  }),
  entry("ことばのきまり", "なかまの言葉", categories, {
    1: "なかまはずれ(まったくちがう なかま)",
    2: "なかまはずれ",
    3: "なかまはずれ(にている なかま: くだもの/やさい・がっき/ぶんぼうぐ)",
    4: "3つの ことばの なかまの なまえ",
    5: "なかまの ことばを 1つ えらぶ",
  }),
  entry("ことばのきまり", "カタカナで書く言葉", katakana, {
    1: "カタカナで かく ことばを えらぶ",
    2: "カタカナで かく(のばす音・小さい字なし)",
    3: "カタカナで かく(のばす音あり)",
    4: "カタカナで かく(小さい「ッ」「ャ」「ュ」あり)",
    5: "カタカナで かく(長い ことば)",
  }),
  entry("ことばのきまり", "様子を表す言葉", onomatopoeia, {
    1: "どうぶつの なきごえ",
    2: "てんきの おと・ようす",
    3: "ものの ようす",
    4: "きもちの ようす",
    5: "すべての ようす・おと",
  }),
  ...JAPANESE_SENTENCE_GENERATORS,
];
