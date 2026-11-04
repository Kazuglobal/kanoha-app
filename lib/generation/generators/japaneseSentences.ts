import "server-only";
import { pickMany, pickOne } from "@/lib/utils/random";
import { specEntry, type ProblemSpec, type SpecContext } from "../helpers";
import type { GeneratorEntry } from "../types";

const UNIT = "文の組み立て";

interface OneWord {
  readonly subject: string;
  readonly predicate: string;
}
interface TwoWords extends OneWord {
  readonly object: string;
}

const SHORT: readonly OneWord[] = [
  { subject: "ねこが", predicate: "ないた" },
  { subject: "いぬが", predicate: "はしった" },
  { subject: "ことりが", predicate: "とんだ" },
  { subject: "うさぎが", predicate: "はねた" },
  { subject: "さかなが", predicate: "およいだ" },
  { subject: "はなが", predicate: "さいた" },
  { subject: "あめが", predicate: "ふった" },
  { subject: "かぜが", predicate: "ふいた" },
  { subject: "ほしが", predicate: "ひかった" },
];

const LONG: readonly TwoWords[] = [
  { subject: "おとうさんが", object: "しんぶんを", predicate: "よんだ" },
  { subject: "おかあさんが", object: "ごはんを", predicate: "つくった" },
  { subject: "おねえさんが", object: "えを", predicate: "かいた" },
  { subject: "せんせいが", object: "うたを", predicate: "うたった" },
  { subject: "ぼくが", object: "パンを", predicate: "たべた" },
  { subject: "わたしが", object: "てがみを", predicate: "かいた" },
  { subject: "ともだちが", object: "ボールを", predicate: "なげた" },
  { subject: "おじいさんが", object: "おちゃを", predicate: "のんだ" },
];

const bunsetsu = (sentence: OneWord | TwoWords): string[] =>
  "object" in sentence ? [sentence.subject, sentence.object, sentence.predicate] : [sentence.subject, sentence.predicate];

// 「かいた」のように 2 つの文に出てくる ことばは 1 つにまとめる(同じ ことばを 2 回えらぶと、まちがいの選択肢が 3 つにならない)
const allBunsetsu = (): string[] => [...new Set([...SHORT.flatMap(bunsetsu), ...LONG.flatMap(bunsetsu)])];

/** まちがい 3 つ: 同じ文の ほかの部分(これで「文にあるか」だけでは決められない) + 足りない分は ほかの文から。 */
function sameSentenceChoices(random: () => number, words: readonly string[], target: string): string[] {
  const inSentence = words.filter((word) => word !== target);
  const elsewhere = allBunsetsu().filter((word) => !words.includes(word));
  return [...inSentence, ...pickMany(random, elsewhere, 3 - inSentence.length)];
}

/** 「だれが」「どうした」を見つける。 */
function subjectPredicate({ random, level }: SpecContext): ProblemSpec {
  const long = level >= 3;
  const sentence = long ? pickOne(random, LONG) : pickOne(random, SHORT);
  const words = bunsetsu(sentence);
  const role = level === 5 ? "object" : level % 2 === 1 ? "predicate" : "subject";
  const target = role === "object" ? (sentence as TwoWords).object : sentence[role];
  const labels = { subject: "「だれが（なにが）」", predicate: "「どうした」", object: "「なにを」" } as const;
  const hints = {
    subject: "ぶんの はじめの ことばを みてみよう。",
    predicate: "ぶんの おわりの ことばを みてみよう。",
    object: "「を」が ついている ことばを さがそう。",
  } as const;
  return {
    problemText: `「${words.join(" ")}。」の ${labels[role]}にあたる ことばは どれですか。`,
    answer: target,
    wrong: sameSentenceChoices(random, words, target),
    hint1: "ぶんを 「だれが」「なにを」「どうした」に わけて みよう。",
    hint2: hints[role],
    solution: `${labels[role]}にあたるのは「${target}」だよ。`,
  };
}

interface Connective {
  readonly first: string;
  readonly second: string;
  readonly answer: "だから" | "でも" | "そして";
}

const CONNECTIVES: readonly Connective[] = [
  { first: "あめが ふりました。", second: "かさを さしました。", answer: "だから" },
  { first: "かぜを ひきました。", second: "がっこうを やすみました。", answer: "だから" },
  { first: "おなかが すきました。", second: "ごはんを たくさん たべました。", answer: "だから" },
  { first: "ねぼうを しました。", second: "いそいで いえを でました。", answer: "だから" },
  { first: "あめが ふっています。", second: "そとで あそびたいです。", answer: "でも" },
  { first: "ねむかったです。", second: "がんばって おきていました。", answer: "でも" },
  { first: "ぼくは いぬが すきです。", second: "いもうとは ねこが すきです。", answer: "でも" },
  { first: "いっしょうけんめい はしりました。", second: "いちばんには なれませんでした。", answer: "でも" },
  { first: "あさ おきました。", second: "かおを あらいました。", answer: "そして" },
  { first: "ごはんを たべました。", second: "はを みがきました。", answer: "そして" },
  { first: "こうえんで あそびました。", second: "うちに かえりました。", answer: "そして" },
  { first: "てを あらいました。", second: "おやつを たべました。", answer: "そして" },
];

const CONNECTIVE_WRONG: Readonly<Record<Connective["answer"], readonly string[]>> = {
  だから: ["でも", "ところが", "それとも"],
  でも: ["だから", "それとも", "つまり"],
  そして: ["でも", "ところが", "それとも"],
};

const CONNECTIVE_HINT: Readonly<Record<Connective["answer"], string>> = {
  だから: "まえの ぶんが わけで、あとの ぶんが そのけっかに なっているよ。",
  でも: "まえの ぶんと あとの ぶんで、はんたいの ことを いっているよ。",
  そして: "ふたつの ことが つづけて おこっているよ。",
};

/** つなぎ言葉: だから・でも・そして。 */
function connectives({ random, level }: SpecContext): ProblemSpec {
  const wanted = level === 1 ? "だから" : level === 2 ? "でも" : level === 3 ? "そして" : undefined;
  const item = pickOne(random, wanted ? CONNECTIVES.filter((entry) => entry.answer === wanted) : CONNECTIVES);
  return {
    problemText: `つぎの ぶんの（　）に はいる ことばは どれですか。「${item.first}（　）${item.second}」`,
    answer: item.answer,
    wrong: CONNECTIVE_WRONG[item.answer],
    hint1: "ふたつの ぶんの つながりを かんがえよう。",
    hint2: CONNECTIVE_HINT[item.answer],
    solution: `ふたつの ぶんを つなぐ ことばは「${item.answer}」だよ。`,
  };
}

interface ParticleItem {
  readonly before: string;
  readonly after: string;
  readonly answer: "は" | "を" | "へ";
  readonly wrong: readonly string[];
}

const PARTICLES: readonly ParticleItem[] = [
  { before: "ぼくは ごはん", after: "たべる。", answer: "を", wrong: ["へ", "の", "に"] },
  { before: "わたしは えほん", after: "よむ。", answer: "を", wrong: ["へ", "の", "に"] },
  { before: "おとうとは みず", after: "のむ。", answer: "を", wrong: ["へ", "の", "に"] },
  { before: "おかあさんは うた", after: "うたう。", answer: "を", wrong: ["へ", "の", "に"] },
  { before: "ぼくは こうえん", after: "いく。", answer: "へ", wrong: ["の", "が", "と"] },
  { before: "わたしは がっこう", after: "いく。", answer: "へ", wrong: ["の", "が", "と"] },
  { before: "おじいさんは うみ", after: "いく。", answer: "へ", wrong: ["の", "が", "と"] },
  { before: "いもうとは おみせ", after: "いく。", answer: "へ", wrong: ["の", "が", "と"] },
  { before: "ぼく", after: "うみを みている。", answer: "は", wrong: ["を", "へ", "に"] },
  { before: "ことり", after: "そらを とんでいる。", answer: "は", wrong: ["を", "へ", "に"] },
  { before: "ねこ", after: "さかなを たべた。", answer: "は", wrong: ["を", "へ", "に"] },
  { before: "ぼく", after: "おべんとうを たべる。", answer: "は", wrong: ["を", "へ", "に"] },
];

const PARTICLE_HINT: Readonly<Record<ParticleItem["answer"], string>> = {
  を: "なにを するのかを あらわす ことばを えらぼう。",
  へ: "どこへ むかうのかを あらわす ことばを えらぼう。",
  は: "「だれが」にあたる ことばの あとに つく ことばを えらぼう。",
};

/** 助詞: は・を・へ。 */
function particles({ random, level }: SpecContext): ProblemSpec {
  const wanted = level === 1 ? "を" : level === 2 ? "へ" : level === 3 ? "は" : undefined;
  const item = pickOne(random, wanted ? PARTICLES.filter((entry) => entry.answer === wanted) : PARTICLES);
  return {
    problemText: `（　）に はいる ことばは どれですか。「${item.before}（　） ${item.after}」`,
    answer: item.answer,
    wrong: item.wrong,
    hint1: "ことばと ことばを つなぐ はたらきを かんがえよう。",
    hint2: PARTICLE_HINT[item.answer],
    solution: `「${item.before}${item.answer} ${item.after}」が ただしい ぶんだよ。`,
  };
}

const SPEAKERS = ["ははが", "ちちが", "せんせいが", "ともだちが"] as const;
const GREETS = ["おはよう", "ありがとう", "いってきます", "ただいま"] as const;
const ENDINGS = ["ぼくは がっこうへ いきました", "わたしは えを かきました", "ねこが ねています", "あめが ふっています"] as const;

type Mark = "。" | "「" | "」";

/** 句読点・かぎ(「」)。 */
function punctuation({ random, level }: SpecContext): ProblemSpec {
  const kinds: Mark[] = level === 1 ? ["。"] : level === 2 ? ["」"] : level === 3 ? ["「"] : ["。", "「", "」"];
  const mark = pickOne(random, kinds);
  const speaker = pickOne(random, SPEAKERS);
  const greet = pickOne(random, GREETS);
  const text =
    mark === "。"
      ? `${pickOne(random, ENDINGS)}（　）`
      : mark === "「"
        ? `${speaker}（　）${greet}。」と いいました。`
        : `${speaker}「${greet}。（　）と いいました。`;
  const hints: Record<Mark, [string, string, string]> = {
    "。": ["ぶんの おわりに つけるのは どれかな?", "ぶんが おわる ところの しるしを えらぼう。", "ぶんの おわりには「。」を つけるよ。"],
    "「": ["だれかの ことばを かくときの しるしを かんがえよう。", "ことばが はじまる ところの しるしを えらぼう。", "ことばの はじまりには「「」を つけるよ。"],
    "」": ["だれかの ことばを かくときの しるしを かんがえよう。", "ことばが おわる ところの しるしを えらぼう。", "ことばの おわりには「」」を つけるよ。"],
  };
  return {
    // 「」は 教える しるしなので、問題の文は【】で囲む
    problemText: `（　）に はいる しるしは どれですか。【${text}】`,
    answer: mark,
    wrong: (["。", "、", "「", "」"] as const).filter((candidate) => candidate !== mark),
    hint1: hints[mark][0],
    hint2: hints[mark][1],
    solution: hints[mark][2],
  };
}

const entry = (subUnit: string, build: (context: SpecContext) => ProblemSpec, levels: GeneratorEntry["levels"]): GeneratorEntry =>
  specEntry({ subject: "japanese", unit: UNIT, subUnit, levels }, build);

export const JAPANESE_SENTENCE_GENERATORS: readonly GeneratorEntry[] = [
  entry("主語と述語", subjectPredicate, {
    1: "みじかい ぶんで「どうした」を見つける",
    2: "みじかい ぶんで「だれが」を見つける",
    3: "「なにを」のある ぶんで「どうした」を見つける",
    4: "「なにを」のある ぶんで「だれが」を見つける",
    5: "「なにを」のある ぶんで「なにを」を見つける",
  }),
  entry("つなぎ言葉", connectives, {
    1: "「だから」(わけと けっか)",
    2: "「でも」(はんたいの こと)",
    3: "「そして」(つづけて おこる こと)",
    4: "3つの つなぎ言葉から えらぶ",
    5: "3つの つなぎ言葉から えらぶ",
  }),
  entry("助詞（は・を・へ）", particles, {
    1: "「を」を えらぶ(なにを するか)",
    2: "「へ」を えらぶ(どこへ むかうか)",
    3: "「は」を えらぶ(だれが)",
    4: "「は・を・へ」から えらぶ",
    5: "「は・を・へ」から えらぶ(いろいろ)",
  }),
  entry("文の終わり（句読点）", punctuation, {
    1: "ぶんの おわりの「。」",
    2: "会話の おわりの「」」",
    3: "会話の はじまりの「「」",
    4: "「。」「「」「」」から えらぶ",
    5: "「。」「「」「」」から えらぶ",
  }),
];

