import "server-only";
import { pickOne, randomInt } from "@/lib/utils/random";
import { specEntry, type ProblemSpec, type SpecContext } from "../../helpers";
import type { GeneratorEntry } from "../../types";

/** 大きい単位と小さい単位(1 big = factor small)。step は 小さい単位の部分を えらぶ間かく。 */
interface UnitPair {
  readonly big: string;
  readonly small: string;
  readonly factor: number;
  readonly coarse: number;
  readonly fine: number;
}

const CM_MM: UnitPair = { big: "cm", small: "mm", factor: 10, coarse: 1, fine: 1 };
const M_CM: UnitPair = { big: "m", small: "cm", factor: 100, coarse: 10, fine: 5 };
const L_DL: UnitPair = { big: "L", small: "dL", factor: 10, coarse: 1, fine: 1 };
const L_ML: UnitPair = { big: "L", small: "mL", factor: 1000, coarse: 100, fine: 50 };

/** 条件に合う数の組を乱数でさがす回数の上限(見つからなければ作り手のまちがいなので RangeError)。 */
const MAX_TRIES = 500;

const compound = (pair: UnitPair, bigPart: number, smallPart: number): string =>
  `${bigPart}${pair.big}${smallPart}${pair.small}`;

const smallParts = (pair: UnitPair, step: number): number[] =>
  Array.from({ length: Math.floor((pair.factor - 1) / step) }, (_, index) => (index + 1) * step);

const pickSmallPart = (random: () => number, pair: UnitPair, step: number): number => pickOne(random, smallParts(pair, step));

/** 合成の答え(例: 4cm2mm)の まちがい候補。大きい単位・小さい単位を 1 つずらしたもの。 */
function nearbyCompounds(pair: UnitPair, bigPart: number, smallPart: number, step: number): string[] {
  const options = [
    [bigPart + 1, smallPart],
    [bigPart - 1, smallPart],
    [bigPart, smallPart + step],
    [bigPart, smallPart - step],
    [bigPart + 2, smallPart],
    [bigPart, smallPart + 2 * step],
  ] as const;
  const list = options
    .filter(([big, small]) => big >= 1 && small >= 1 && small < pair.factor)
    .map(([big, small]) => compound(pair, big, small));
  return smallPart <= 19 && bigPart < pair.factor ? [...list, compound(pair, smallPart, bigPart)] : list;
}

/** 単位の読みかえ(cmとmm / mとcm / LとdL / LとmL)。 */
function conversion(pair: UnitPair): (context: SpecContext) => ProblemSpec {
  return ({ random, level }) => {
    const fine = level >= 4;
    const step = fine ? pair.fine : pair.coarse;
    const bigPart = level === 1 ? randomInt(random, 2, 9) : fine && pair.factor !== 1000 ? randomInt(random, 10, 19) : randomInt(random, 1, 9);
    const smallPart = pickSmallPart(random, pair, step);
    const total = bigPart * pair.factor + smallPart;
    const oneBig = `1${pair.big} は ${pair.factor}${pair.small} だよ。`;
    if (level === 1) {
      return {
        problemText: `${bigPart}${pair.big} は なん${pair.small} ですか。`,
        answer: `${bigPart * pair.factor}${pair.small}`,
        hint1: oneBig,
        hint2: `${bigPart}${pair.big} は ${pair.factor}${pair.small} が ${bigPart}こ ぶんだよ。`,
        solution: `${bigPart}${pair.big} = ${bigPart}×${pair.factor} = ${bigPart * pair.factor}${pair.small}。`,
      };
    }
    if (level === 2 || level === 5) {
      return {
        problemText: `${compound(pair, bigPart, smallPart)} は ぜんぶで なん${pair.small} ですか。`,
        answer: `${total}${pair.small}`,
        hint1: oneBig,
        hint2: `${pair.big}の ぶんと ${pair.small}の ぶんに わけて かんがえよう。`,
        solution: `${compound(pair, bigPart, smallPart)} = ${bigPart * pair.factor}${pair.small} + ${smallPart}${pair.small} = ${total}${pair.small}。`,
      };
    }
    return {
      problemText: `${total}${pair.small} は なん${pair.big}なん${pair.small} ですか。`,
      answer: compound(pair, bigPart, smallPart),
      wrong: nearbyCompounds(pair, bigPart, smallPart, step),
      hint1: oneBig,
      hint2: `${pair.small}の かずの なかに、${pair.big}が いくつ とれるか かんがえよう。`,
      solution: `${total}${pair.small} = ${bigPart * pair.factor}${pair.small} + ${smallPart}${pair.small} = ${compound(pair, bigPart, smallPart)}。`,
    };
  };
}

/** 長さ・かさのたし算とひき算。 */
function arithmetic(pairs: readonly UnitPair[], sameUnitLabel: string): (context: SpecContext) => ProblemSpec {
  return ({ random, level }) => {
    const pair = pickOne(random, pairs);
    const step = pair.coarse;
    if (level === 1) {
      const x = randomInt(random, 2, 9);
      const y = randomInt(random, 2, 9);
      return {
        problemText: `${x}${pair.big} + ${y}${pair.big} は いくつですか。`,
        answer: `${x + y}${pair.big}`,
        hint1: `おなじ たんいの ${sameUnitLabel}どうしは、かずを そのまま たせるよ。`,
        hint2: `たんいを そろえて、かずだけ たしてみよう。`,
        solution: `${x}+${y}=${x + y} だから ${x + y}${pair.big}。`,
      };
    }
    return level <= 3 ? addCompound(random, pair, step, level === 3) : subCompound(random, pair, step, level === 5);
  };
}

function addCompound(random: () => number, pair: UnitPair, step: number, carry: boolean): ProblemSpec {
  for (let attempt = 0; attempt < MAX_TRIES; attempt += 1) {
    const [b1, b2] = [randomInt(random, 1, 8), randomInt(random, 1, 8)];
    const [s1, s2] = [pickSmallPart(random, pair, step), pickSmallPart(random, pair, step)];
    const overflow = s1 + s2 >= pair.factor;
    if (overflow !== carry || (s1 + s2) % pair.factor === 0) continue;
    const [bigPart, smallPart] = overflow ? [b1 + b2 + 1, s1 + s2 - pair.factor] : [b1 + b2, s1 + s2];
    const answer = compound(pair, bigPart, smallPart);
    return {
      problemText: `${compound(pair, b1, s1)} + ${compound(pair, b2, s2)} は いくつですか。`,
      answer,
      wrong: [
        ...nearbyCompounds(pair, bigPart, smallPart, step),
        // くり上げを わすれた まちがい(1 大きい単位が たりない)。小さい単位が factor 以上になる書きかたは、答えと同じ大きさになるので使わない
        ...(overflow ? [compound(pair, b1 + b2, s1 + s2 - pair.factor)] : []),
      ],
      hint1: `${pair.big}どうし、${pair.small}どうしを べつべつに たしてみよう。`,
      hint2: overflow
        ? `${pair.small}が ${pair.factor}を こえたら、${pair.big}に くりあげよう。1${pair.big}は ${pair.factor}${pair.small} だよ。`
        : `${pair.small}の ぶんと ${pair.big}の ぶんを、それぞれ たすだけで いいよ。`,
      solution: `${pair.small}: ${s1}+${s2}=${s1 + s2}${overflow ? `(${pair.factor}を こえたので 1${pair.big} くりあげ)` : ""}、${pair.big}: ${b1}+${b2}${overflow ? "+1" : ""}=${bigPart}。こたえは ${answer}。`,
    };
  }
  throw new RangeError("could not build a compound addition");
}

function subCompound(random: () => number, pair: UnitPair, step: number, borrow: boolean): ProblemSpec {
  for (let attempt = 0; attempt < MAX_TRIES; attempt += 1) {
    const [b1, b2] = [randomInt(random, 2, 9), randomInt(random, 1, 8)];
    const [s1, s2] = [pickSmallPart(random, pair, step), pickSmallPart(random, pair, step)];
    const needBorrow = s1 < s2;
    const [bigPart, smallPart] = needBorrow ? [b1 - b2 - 1, s1 + pair.factor - s2] : [b1 - b2, s1 - s2];
    if (needBorrow !== borrow || bigPart < 1 || smallPart < 1) continue;
    // 答えが ひく数と同じだと、問題文に答えが出てしまう
    if (bigPart === b2 && smallPart === s2) continue;
    const answer = compound(pair, bigPart, smallPart);
    return {
      problemText: `${compound(pair, b1, s1)} - ${compound(pair, b2, s2)} は いくつですか。`,
      answer,
      wrong: [
        ...nearbyCompounds(pair, bigPart, smallPart, step),
        ...(needBorrow ? [compound(pair, b1 - b2, s2 - s1 > 0 ? s2 - s1 : 1)] : []),
      ],
      hint1: `${pair.big}どうし、${pair.small}どうしを べつべつに ひいてみよう。`,
      hint2: needBorrow
        ? `${pair.small}が ひけない ときは、${pair.big}から 1 かりてこよう。1${pair.big}は ${pair.factor}${pair.small} だよ。`
        : `${pair.small}の ぶんと ${pair.big}の ぶんを、それぞれ ひくだけで いいよ。`,
      solution: `${pair.small}: ${needBorrow ? `${s1}+${pair.factor}-${s2}` : `${s1}-${s2}`}=${smallPart}、${pair.big}: ${b1}${needBorrow ? "-1" : ""}-${b2}=${bigPart}。こたえは ${answer}。`,
    };
  }
  throw new RangeError("could not build a compound subtraction");
}

const LEVEL_NOTES = (unit: string, kinds: readonly [string, string, string, string, string]): GeneratorEntry["levels"] => ({
  1: `${unit}: ${kinds[0]}`,
  2: `${unit}: ${kinds[1]}`,
  3: `${unit}: ${kinds[2]}`,
  4: `${unit}: ${kinds[3]}`,
  5: `${unit}: ${kinds[4]}`,
});

const entry = (unit: string, subUnit: string, build: (context: SpecContext) => ProblemSpec, levels: GeneratorEntry["levels"]): GeneratorEntry =>
  specEntry({ subject: "math", unit, subUnit, levels }, build);

const conversionLevels = (unit: string, big: string, small: string): GeneratorEntry["levels"] =>
  LEVEL_NOTES(unit, [`${big} → ${small}`, `${big}と${small} → ${small}`, `${small} → ${big}と${small}`, `${small} → ${big}と${small}(大きい数・細かい数)`, `${big}と${small} → ${small}(大きい数・細かい数)`]);

const arithmeticLevels = (unit: string): GeneratorEntry["levels"] =>
  LEVEL_NOTES(unit, ["おなじ たんいの たし算", "たし算(くり上がりなし)", "たし算(くり上がり)", "ひき算(くり下がりなし)", "ひき算(くり下がり)"]);

export const LENGTH_GENERATORS: readonly GeneratorEntry[] = [
  entry("長さ", "cmとmm", conversion(CM_MM), conversionLevels("cmとmm", "cm", "mm")),
  entry("長さ", "mとcm", conversion(M_CM), conversionLevels("mとcm", "m", "cm")),
  entry("長さ", "長さのたし算とひき算", arithmetic([CM_MM, M_CM], "長さ"), arithmeticLevels("長さ")),
];

export const VOLUME_GENERATORS: readonly GeneratorEntry[] = [
  entry("水のかさ", "LとdL", conversion(L_DL), conversionLevels("LとdL", "L", "dL")),
  entry("水のかさ", "LとmL", conversion(L_ML), conversionLevels("LとmL", "L", "mL")),
  entry("水のかさ", "かさのたし算とひき算", arithmetic([L_DL, L_ML], "かさ"), arithmeticLevels("かさ")),
];

