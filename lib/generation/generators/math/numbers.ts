import "server-only";
import { pickMany, pickOne, randomInt, sampleDistinct } from "@/lib/utils/random";
import { specEntry, type ProblemSpec, type SpecContext } from "../../helpers";
import type { GeneratorEntry } from "../../types";
import { PLACE_NAMES, digitAt } from "./columns";

const UNIT = "1000より大きい数";
const COMPOSE_HINT1 = "100が いくつ、10が いくつ、1が いくつかを、くらいごとに ならべてみよう。";
const COMPOSE_HINT2 = "ひゃくのくらい、じゅうのくらい、いちのくらいに、すうじを かいてみよう。";
const nonZero = (random: () => number): number => randomInt(random, 1, 9);

/** 1000までの数: 100・10・1 の いくつぶんから数をつくる。 */
function upTo1000({ random, level }: SpecContext): ProblemSpec {
  const [h, t, o] = [nonZero(random), nonZero(random), nonZero(random)];
  if (level === 1) {
    const n = randomInt(random, 11, 99);
    return {
      problemText: `10が ${n}こで いくつですか。`,
      answer: String(n * 10),
      hint1: COMPOSE_HINT1,
      hint2: "10が 10こで 100になるよ。10が いくつ あるか かぞえてみよう。",
      solution: `10が ${n}こ あつまると、${n * 10} に なるよ。`,
    };
  }
  if (level === 5) {
    const n = randomInt(random, 11, 99) * 10;
    return {
      problemText: `${n}は 10が なんこ ぶんですか。`,
      answer: `${n / 10}こ`,
      hint1: "10が 10こで 100に なるよ。",
      hint2: "いちのくらいの 0を とって、のこりの かずを みてみよう。",
      solution: `${n}は 10が ${n / 10}こ ぶん。`,
    };
  }
  if (level === 2) {
    return {
      problemText: `100が ${h}こと 10が ${t}こで いくつですか。`,
      answer: String(h * 100 + t * 10),
      hint1: COMPOSE_HINT1,
      hint2: COMPOSE_HINT2,
      solution: `${h * 100} + ${t * 10} = ${h * 100 + t * 10}。`,
    };
  }
  if (level === 3) {
    return {
      problemText: `100が ${h}こ、10が ${t}こ、1が ${o}こで いくつですか。`,
      answer: String(h * 100 + t * 10 + o),
      hint1: COMPOSE_HINT1,
      hint2: COMPOSE_HINT2,
      solution: `${h * 100} + ${t * 10} + ${o} = ${h * 100 + t * 10 + o}。`,
    };
  }
  return {
    problemText: `100が ${h}こと 1が ${o}こで いくつですか。`,
    answer: String(h * 100 + o),
    hint1: COMPOSE_HINT1,
    hint2: "10が 1つも ないときは、じゅうのくらいは 0に なるよ。",
    solution: `${h * 100} + ${o} = ${h * 100 + o}。じゅうのくらいは 0。`,
  };
}

/** 10000までの数: 1000・100・10・1 の いくつぶん。 */
function upTo10000({ random, level }: SpecContext): ProblemSpec {
  const [th, h, t, o] = [nonZero(random), nonZero(random), nonZero(random), nonZero(random)];
  const hint1 = "1000が いくつ、100が いくつ、10が いくつ、1が いくつかを、くらいごとに ならべてみよう。";
  const hint2 = "せんのくらいから じゅんに、すうじを かいてみよう。";
  if (level === 1) {
    const n = randomInt(random, 2, 9);
    return { problemText: `1000が ${n}こで いくつですか。`, answer: String(n * 1000), hint1, hint2, solution: `1000が ${n}こ だから ${n * 1000}。` };
  }
  if (level === 2) {
    return { problemText: `1000が ${th}こと 100が ${h}こで いくつですか。`, answer: String(th * 1000 + h * 100), hint1, hint2, solution: `${th * 1000} + ${h * 100} = ${th * 1000 + h * 100}。` };
  }
  if (level === 3) {
    const n = th * 1000 + h * 100 + t * 10 + o;
    return { problemText: `1000が ${th}こ、100が ${h}こ、10が ${t}こ、1が ${o}こで いくつですか。`, answer: String(n), hint1, hint2, solution: `${th * 1000} + ${h * 100} + ${t * 10} + ${o} = ${n}。` };
  }
  if (level === 4) {
    return {
      problemText: `1000が ${th}こと 10が ${t}こで いくつですか。`,
      answer: String(th * 1000 + t * 10),
      hint1,
      hint2: "100が 1つも ないときは、ひゃくのくらいは 0に なるよ。",
      solution: `${th * 1000} + ${t * 10} = ${th * 1000 + t * 10}。ひゃくのくらいは 0。`,
    };
  }
  const n = randomInt(random, 11, 99) * 100;
  return { problemText: `${n}は 100が なんこ ぶんですか。`, answer: `${n / 100}こ`, hint1: "100が 10こで 1000に なるよ。", hint2: "したの 0を 2つ とって、のこりの かずを みてみよう。", solution: `${n}は 100が ${n / 100}こ ぶん。` };
}

/** 数のしくみ(レベル 1〜4): 数のはんいと、たずねる くらい(0 = 一の位)。 */
const PLACE_SETUP: Readonly<Record<1 | 2 | 3 | 4, { range: readonly [number, number]; places: readonly number[] }>> = {
  1: { range: [111, 999], places: [2] },
  2: { range: [111, 999], places: [1] },
  3: { range: [1000, 9999], places: [3, 2] },
  4: { range: [1000, 9999], places: [0, 1, 2, 3] },
};

/** 数のしくみ: くらいどりと、10のいくつぶん。 */
function placeValue({ random, level }: SpecContext): ProblemSpec {
  const hint1 = "くらいを みぎから じゅんに かぞえよう。";
  if (level === 5) {
    const n = randomInt(random, 11, 99) * 10 + randomInt(random, 1, 9);
    const [tens, ones] = [Math.floor(n / 10), n % 10];
    return {
      problemText: `${n}は 10が なんこと 1が なんこですか。`,
      answer: `${tens}こと ${ones}こ`,
      wrong: [`${tens - 1}こと ${ones}こ`, `${tens + 1}こと ${ones}こ`, `${Math.floor(n / 100)}こと ${n % 100}こ`, `${tens}こと ${ones === 9 ? 8 : ones + 1}こ`],
      hint1: "10が なんこ あるかを さきに かんがえよう。",
      hint2: "いちのくらいの すうじは、1が なんこ ぶんかを あらわすよ。",
      solution: `${n}は 10が ${tens}こと 1が ${ones}こ。`,
    };
  }
  const { range, places } = PLACE_SETUP[level];
  const n = level === 4 ? zeroInside(random) : randomInt(random, range[0], range[1]);
  const place = pickOne(random, places);
  return {
    problemText: `${n}の ${PLACE_NAMES[place]}の すうじは いくつですか。`,
    answer: String(digitAt(n, place)),
    hint1,
    hint2: "そのくらいの すうじを みつけて、こたえよう。",
    solution: `${n}の ${PLACE_NAMES[place]}は ${digitAt(n, place)} だよ。`,
  };
}

/** 4けたの数で、どこかのくらいが 0 のもの。 */
function zeroInside(random: () => number): number {
  const place = pickOne(random, [0, 1, 2]);
  const n = randomInt(random, 1000, 9999);
  return n - digitAt(n, place) * 10 ** place;
}

/** 数の大小: 4つの数から 1つ えらぶ。 */
function comparison({ random, level }: SpecContext): ProblemSpec {
  const fourDigits = level >= 3;
  const numbers = level === 4 ? permutations(random) : distinctNumbers(random, fourDigits ? [1000, 9999] : [100, 999]);
  const sorted = [...numbers].sort((a, b) => b - a);
  const pickIndex = level === 5 ? 1 : level % 2 === 0 ? 3 : 0;
  const answer = sorted[pickIndex];
  const question =
    level === 5 ? "2ばんめに 大きい 数は どれですか。" : pickIndex === 0 ? "いちばん 大きい 数は どれですか。" : "いちばん 小さい 数は どれですか。";
  return {
    problemText: `つぎの うち、${question}`,
    answer: String(answer),
    wrong: numbers.filter((n) => n !== answer).map(String),
    hint1: "いちばん 上の くらいの すうじから くらべよう。",
    hint2: "おなじ すうじの ときは、つぎの くらいを くらべよう。",
    solution: `大きい じゅんに ならべると ${sorted.join("、")}。こたえは ${answer}。`,
  };
}

function distinctNumbers(random: () => number, [low, high]: readonly [number, number]): number[] {
  return sampleDistinct(random, low, high, 4);
}

/** 4つのすうじを ならべかえた 4つの数(上の くらいが おなじで まぎらわしい)。 */
function permutations(random: () => number): number[] {
  const digits = pickMany(random, [1, 2, 3, 4, 5, 6, 7, 8, 9], 4);
  const orders = pickMany(
    random,
    [
      [0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 1, 3], [0, 3, 1, 2], [0, 2, 3, 1], [0, 3, 2, 1],
      [1, 0, 2, 3], [1, 0, 3, 2], [1, 2, 0, 3], [2, 0, 1, 3], [3, 0, 1, 2], [2, 1, 0, 3],
    ],
    4,
  );
  return orders.map((order) => Number(order.map((index) => digits[index]).join("")));
}

const entry = (subUnit: string, build: (context: SpecContext) => ProblemSpec, levels: GeneratorEntry["levels"]): GeneratorEntry =>
  specEntry({ subject: "math", unit: UNIT, subUnit, levels }, build);

export const NUMBER_GENERATORS: readonly GeneratorEntry[] = [
  entry("1000までの数", upTo1000, {
    1: "10が ○こ(○は2けた)",
    2: "100が ○こと 10が ○こ",
    3: "100・10・1 の いくつぶん",
    4: "10のくらいが 0 の数(100が ○こと 1が ○こ)",
    5: "○は 10が なんこ ぶん",
  }),
  entry("10000までの数", upTo10000, {
    1: "1000が ○こ",
    2: "1000が ○こと 100が ○こ",
    3: "1000・100・10・1 の いくつぶん",
    4: "100のくらいが 0 の数(1000が ○こと 10が ○こ)",
    5: "○は 100が なんこ ぶん",
  }),
  entry("数のしくみ", placeValue, {
    1: "3けたの数の ひゃくのくらい",
    2: "3けたの数の じゅうのくらい",
    3: "4けたの数の せん・ひゃくのくらい",
    4: "0 をふくむ4けたの数の ○のくらい",
    5: "10が なんこと 1が なんこ",
  }),
  entry("数の大小", comparison, {
    1: "3けたの数で いちばん大きい数",
    2: "3けたの数で いちばん小さい数(4つのうち)",
    3: "4けたの数で いちばん大きい数",
    4: "ならべかえた4けたの数で いちばん小さい数",
    5: "4けたの数で 2ばんめに大きい数",
  }),
];
