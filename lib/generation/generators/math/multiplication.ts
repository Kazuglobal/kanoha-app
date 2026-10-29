import "server-only";
import type { Level } from "@/lib/learning/level";
import { pickOne, randomInt } from "@/lib/utils/random";
import { specEntry, type ProblemSpec, type SpecContext } from "../../helpers";
import type { GeneratorEntry } from "../../types";
import { PACKABLE, SERVINGS, spendPhrase, withCounter, type Thing } from "./story";

const UNIT = "かけ算";
const FACTORS = [2, 3, 4, 5, 6, 7, 8, 9] as const;

/** 九九のだんをえらぶ範囲(レベルごと)。 */
const DANS: Readonly<Record<Level, readonly number[]>> = {
  1: [2, 3, 4, 5],
  2: [6, 7],
  3: [8, 9],
  4: FACTORS,
  5: FACTORS,
};

const repeated = (n: number, times: number): string => Array(times).fill(n).join(" + ");

function kuku({ random, level }: SpecContext): ProblemSpec {
  const a = pickOne(random, DANS[level]);
  // □を求める形は、答えの数が問題文に出ないよう、かける数 ≠ かけられる数 にする
  const b = pickOne(random, level === 5 ? FACTORS.filter((n) => n !== a) : FACTORS);
  const product = a * b;
  if (level === 5) {
    return {
      problemText: `${a} × □ = ${product} の □に はいる 数は いくつですか。`,
      answer: String(b),
      hint1: `${a}のだんの くくで、${product}に なるのは どれかな?`,
      hint2: "かける かずを ひとつずつ ふやしながら、じゅんばんに さがしてみよう。",
      solution: `${a}×${b}=${product} だから、□は ${b}。`,
    };
  }
  return {
    problemText: `${a} × ${b} は いくつですか。`,
    answer: String(product),
    hint1: `${a}のだんの くくを おもいだしてみよう。`,
    hint2: `${a}を ${b}かい たすと いくつに なるかな?`,
    solution: `${repeated(a, b)} = ${product}。くくで おぼえよう。`,
  };
}

const meaningPair = (random: () => number, aMax: number, bMin: number, bMax: number): [number, number] => {
  const a = randomInt(random, 2, aMax);
  const b = pickOne(random, Array.from({ length: bMax - bMin + 1 }, (_, i) => bMin + i).filter((n) => n !== a));
  return [a, b];
};

/** かけ算の意味: お話 → しき / しき → たし算 / たし算 → しき(4択)。 */
function meaning({ random, level }: SpecContext): ProblemSpec {
  const hints = { hint1: "ひとつぶんの かずと、いくつぶん あるかを みつけよう。", hint2: "ひとつぶんの かず × いくつぶん が、かけ算の しきに なるよ。" };
  if (level <= 2) {
    const [a, b] = meaningPair(random, level === 1 ? 5 : 9, 2, level === 1 ? 5 : 9);
    const thing = pickOne(random, SERVINGS);
    return {
      problemText: `1さらに ${thing.noun}が ${a}${thing.counter}ずつ のっています。${b}さらぶんの ぜんぶの かずを もとめる しきは どれですか。`,
      answer: `${a} × ${b}`,
      wrong: [`${a} + ${b}`, `${a} × ${a}`, `${b} × ${b}`, `${a} × ${b + 1}`, `${a + 1} × ${b}`],
      ...hints,
      solution: `${a}ずつ ${b}さらぶんだから、しきは ${a} × ${b}。`,
    };
  }
  if (level <= 4) {
    const [a, b] = meaningPair(random, level === 3 ? 5 : 9, 3, level === 3 ? 5 : 6);
    return {
      problemText: `${a} × ${b} を たし算の しきに かくと どれですか。`,
      answer: repeated(a, b),
      wrong: [`${a} + ${b}`, repeated(a, b - 1), repeated(a, b + 1), repeated(a, b + 2)],
      ...hints,
      solution: `${a} × ${b} は、${a}を ${b}こ たす ことだから ${repeated(a, b)}。`,
    };
  }
  const [a, b] = meaningPair(random, 9, 3, 6);
  return {
    problemText: `${repeated(a, b)} を かけ算の しきに かくと どれですか。`,
    answer: `${a} × ${b}`,
    wrong: [`${a} × ${a}`, `${a} + ${b}`, `${a} × ${b + 1}`, `${a} × ${b - 1}`, `${b} × ${b}`],
    ...hints,
    solution: `${a}を ${b}こ たしているから、しきは ${a} × ${b}。`,
  };
}

interface Holder {
  readonly noun: string;
  /** 「○○が 3こずつ ○○た ふくろ」の ことば */
  readonly verb: string;
  readonly things: readonly Thing[];
}

/** 入れもの(さらには たべものだけ のせる)。 */
const HOLDERS: readonly Holder[] = [
  { noun: "ふくろ", verb: "はいった", things: PACKABLE },
  { noun: "はこ", verb: "はいった", things: PACKABLE },
  { noun: "かご", verb: "はいった", things: PACKABLE },
  { noun: "さら", verb: "のった", things: SERVINGS },
];

/** かけ算の文章題: 1 回のかけ算 → かけ算 + たし算 → かけ算 - ひき算。 */
function story({ random, level }: SpecContext): ProblemSpec {
  const holder = pickOne(random, HOLDERS);
  const thing = pickOne(random, holder.things);
  const small = level === 1;
  // 最後のレベルは、使う数を えらべる はばが広いように 3 以上にする
  const a = randomInt(random, level === 3 ? 6 : level === 5 ? 3 : 2, small ? 5 : 9);
  const b = randomInt(random, level === 3 || level === 5 ? 3 : 2, small ? 5 : 9);
  const base = `${thing.noun}が ${a}${thing.counter}ずつ ${holder.verb} ${holder.noun}が ${b}つ あります。`;
  const product = a * b;
  if (level === 4) {
    const extra = randomInt(random, 2, 9);
    return {
      problemText: `${base}ほかに ${extra}${thing.counter} あります。ぜんぶで ${thing.ask}ですか。`,
      answer: withCounter(product + extra, thing),
      hint1: "まず、おなじ かずずつ ある ぶんを かけ算で もとめよう。",
      hint2: "かけ算の あとに、ほかの ぶんを たし算で たそう。",
      solution: `${a}×${b}=${product}、${product}+${extra}=${product + extra}。`,
    };
  }
  if (level === 5) {
    // のこりの数が、問題文に出る数(a, b, つかう数)と同じにならない つかう数だけを候補にする
    const used = pickOne(
      random,
      Array.from({ length: product - 3 }, (_, index) => index + 2).filter((n) => ![a, b, n].includes(product - n)),
    );
    return {
      problemText: `${base}${spendPhrase(thing, used)}と、のこりは ${thing.ask}ですか。`,
      answer: withCounter(product - used, thing),
      hint1: "まず、ぜんぶで いくつ あるかを かけ算で もとめよう。",
      hint2: "かけ算の あとに、へった ぶんを ひき算で ひこう。",
      solution: `${a}×${b}=${product}、${product}-${used}=${product - used}。`,
    };
  }
  return {
    problemText: `${base}ぜんぶで ${thing.ask}ですか。`,
    answer: withCounter(product, thing),
    hint1: "おなじ かずずつ あるときは、かけ算を つかうよ。",
    hint2: "ひとつぶんの かずと、いくつぶん あるかを みつけよう。",
    solution: `しきは ${a}×${b}=${product}。`,
  };
}

const entry = (subUnit: string, build: (context: SpecContext) => ProblemSpec, levels: GeneratorEntry["levels"]): GeneratorEntry =>
  specEntry({ subject: "math", unit: UNIT, subUnit, levels }, build);

export const MULTIPLICATION_GENERATORS: readonly GeneratorEntry[] = [
  entry("かけ算の意味", meaning, {
    1: "お話 → かけ算のしき(小さい数)",
    2: "お話 → かけ算のしき",
    3: "かけ算 → たし算のしき(小さい数)",
    4: "かけ算 → たし算のしき",
    5: "たし算 → かけ算のしき",
  }),
  entry("九九", kuku, {
    1: "2・3・4・5のだん",
    2: "6・7のだん",
    3: "8・9のだん",
    4: "2〜9のだん いろいろ",
    5: "□に はいる数(かける数をさがす)",
  }),
  entry("かけ算の文章題", story, {
    1: "お話の問題(小さい数)",
    2: "お話の問題",
    3: "お話の問題(6〜9のだん)",
    4: "かけ算のあとにたし算",
    5: "かけ算のあとにひき算",
  }),
];
