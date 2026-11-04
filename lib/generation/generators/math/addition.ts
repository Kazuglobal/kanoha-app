import "server-only";
import type { Level } from "@/lib/learning/level";
import { pickOne, randomInt } from "@/lib/utils/random";
import { buildProblem, hintSet, makeEntry, randomFor, type Random } from "../../helpers";
import type { GenerateInput, GeneratedProblem, GeneratorEntry } from "../../types";
import { addSteps, carriesOf, pickPair, r, type Marks, type PairSpace } from "./columns";
import { addStory, startAddStory, THINGS, withCounter, type Thing } from "./story";

const UNIT = "たし算";
const TRICK_PROMPT = "くふうして 計算しましょう";

type CarryRule = (marks: Marks) => boolean;
const NO_CARRY: CarryRule = (m) => !m.ones && !m.tens && !m.hundreds;
const ONES_ONLY: CarryRule = (m) => m.ones && !m.tens;
const ONES: CarryRule = (m) => m.ones;
const TENS_ONLY: CarryRule = (m) => m.tens && !m.ones;
const ONES_AND_TENS: CarryRule = (m) => m.ones && m.tens;
const ANY: CarryRule = () => true;

type Form = "plain" | "missing" | "three" | "story" | "startStory";

/** たす 2 つの数をえらぶ決まり。 */
interface Rule extends PairSpace {
  readonly carry: CarryRule;
  readonly sum?: readonly [number, number];
  /** 答えの数と、問題文に出る数が同じにならないようにする(□を求める形) */
  readonly distinct?: boolean;
}

const RULES: Readonly<Record<string, Readonly<Partial<Record<Level, Rule>>>>> = {
  "2けたのたし算": {
    1: { a: r(11, 89), b: r(1, 9), carry: NO_CARRY, sum: [0, 99] },
    2: { a: r(11, 88), b: r(11, 88), carry: NO_CARRY, sum: [0, 99] },
    3: { a: r(11, 88), b: r(11, 88), carry: ONES_ONLY, sum: [0, 99] },
    4: { a: r(30, 88), b: r(30, 88), carry: ONES, sum: [60, 99] },
    5: { a: r(11, 88), b: r(11, 88), carry: ONES, sum: [0, 99], distinct: true },
  },
  "くり上がり": {
    1: { a: r(11, 89), b: r(2, 9), carry: ONES, sum: [0, 99] },
    2: { a: r(11, 88), b: r(11, 88), carry: ONES_ONLY, sum: [0, 99] },
    3: { a: r(11, 99), b: r(11, 99), carry: ONES_AND_TENS, sum: [100, 199] },
    4: { a: r(50, 99), b: r(50, 99), carry: ONES_AND_TENS },
    5: { a: r(100, 899), b: r(11, 99), carry: ONES },
  },
  "3けたになるたし算": {
    1: { a: r(50, 90), b: r(50, 90), step: 10, carry: ANY, sum: [100, 180] },
    2: { a: r(51, 99), b: r(51, 99), carry: TENS_ONLY, sum: [100, 199] },
    3: { a: r(51, 99), b: r(51, 99), carry: ONES_AND_TENS },
    4: { a: r(100, 899), b: r(11, 99), carry: ANY, sum: [0, 999] },
    5: { a: r(101, 899), b: r(101, 899), carry: ANY, sum: [0, 999] },
  },
  "計算のくふう": {
    1: { a: r(2, 9), b: r(2, 9), carry: ANY, sum: [11, 18] },
    2: { a: r(9, 9), b: r(3, 9), carry: ANY },
    4: { a: r(20, 88), b: r(20, 88), carry: ONES, sum: [0, 99] },
  },
  "たし算の文章題": {
    1: { a: r(2, 9), b: r(2, 9), carry: ANY, sum: [0, 18] },
    2: { a: r(11, 89), b: r(2, 9), carry: ANY },
    3: { a: r(11, 88), b: r(11, 88), carry: ANY, sum: [0, 99] },
    4: { a: r(30, 99), b: r(30, 99), carry: ANY, sum: [100, 199] },
    5: { a: r(11, 89), b: r(11, 89), carry: ANY, sum: [0, 99], distinct: true },
  },
};

const formOf = (subUnit: string, level: Level): Form => {
  if (subUnit === "たし算の文章題") return level === 5 ? "startStory" : "story";
  if (subUnit === "2けたのたし算" && level === 5) return "missing";
  if (subUnit === "計算のくふう" && (level === 3 || level === 5)) return "three";
  return "plain";
};

const accepts = (rule: Rule) => (a: number, b: number): boolean => {
  const total = a + b;
  return (
    rule.carry(carriesOf(a, b)) &&
    (!rule.sum || (total >= rule.sum[0] && total <= rule.sum[1])) &&
    (!rule.distinct || a !== b)
  );
};

function ruleFor(subUnit: string, level: Level): Rule {
  const rule = RULES[subUnit]?.[level];
  if (!rule) throw new RangeError(`no rule for ${subUnit} L${level}`);
  return rule;
}

function plainProblem(input: GenerateInput, random: Random): GeneratedProblem {
  const rule = ruleFor(input.subUnit, input.level);
  const [a, b] = pickPair(random, rule, accepts(rule));
  const carry = carriesOf(a, b).ones;
  const trick = input.subUnit === "計算のくふう";
  // 「9 + n」は 9 を前にも後ろにも置く
  const [first, second] = trick && input.level === 2 && random() < 0.5 ? [b, a] : [a, b];
  const total = a + b;
  return buildProblem("math", input, {
    problemText: trick ? `${first} + ${second} を ${TRICK_PROMPT}。` : `${first} + ${second} は いくつですか。`,
    correctAnswer: String(total),
    hints: trick
      ? trickHints(random, input.level, a, b)
      : hintSet(
          random,
          "くらいを そろえて、いちのくらいから じゅんに たしてみよう。",
          carry
            ? "いちのくらいを たして 10 いじょうに なったら、じゅうのくらいへ ひとつ くりあげよう。"
            : "いちのくらいと じゅうのくらいを べつべつに たしてみよう。",
          addSteps(a, b),
          String(total),
        ),
  });
}

/** 「くふう」の小単元: レベルごとの考え方に合わせたヒント。 */
function trickHints(random: Random, level: Level, a: number, b: number): GeneratedProblem["hints"] {
  const total = a + b;
  if (level === 1) {
    const need = 10 - Math.min(a, b);
    const other = Math.max(a, b);
    return hintSet(
      random,
      "10の まとまりを つくると かんたんに なるよ。",
      `${Math.min(a, b)} に いくつ たすと 10に なるかな?`,
      `${Math.min(a, b)} に ${need} を たして 10。のこりの ${other - need} を たして ${total}。`,
      String(total),
    );
  }
  if (level === 2) {
    const other = a === 9 ? b : a;
    return hintSet(
      random,
      "9は あと 1で 10に なるよ。",
      "もう1つの数から 1を わけて、9に たしてみよう。",
      `9 に 1 を たして 10。のこりの ${other - 1} を たして ${total}。`,
      String(total),
    );
  }
  const tensA = a - (a % 10);
  const tensB = b - (b % 10);
  return hintSet(
    random,
    "じゅうのくらいと いちのくらいに わけて たそう。",
    "わけた じゅうのくらい どうし、いちのくらい どうしを たして、さいごに あわせよう。",
    `${a} = ${tensA}+${a % 10}、${b} = ${tensB}+${b % 10}。${tensA}+${tensB}=${tensA + tensB}、${a % 10}+${b % 10}=${(a % 10) + (b % 10)}。あわせて ${total}。`,
    String(total),
  );
}

/** 3 つの数のたし算。たして 10 になる 2 つをさきに たす。 */
function threeProblem(input: GenerateInput, random: Random): GeneratedProblem {
  const easy = input.level === 3;
  // 2けたのときは、一の位が 0 でない数にする(0 だと、たして10になる相手がいない)
  const a = easy ? randomInt(random, 1, 9) : randomInt(random, 1, 4) * 10 + randomInt(random, 1, 9);
  const c = easy ? 10 - a : randomInt(random, 1, 4) * 10 + (10 - (a % 10));
  const b = easy ? randomInt(random, 2, 9) : randomInt(random, 11, 49);
  const pairSum = a + c;
  const total = a + b + c;
  return buildProblem("math", input, {
    problemText: `${a} + ${b} + ${c} を ${TRICK_PROMPT}。`,
    correctAnswer: String(total),
    hints: hintSet(
      random,
      "たして ちょうどの かずに なる 2つを さがしてみよう。",
      "じゅんばんを かえて、ちょうどの かずに なる 2つを さきに たそう。",
      `${a}+${c}=${pairSum} を さきに たして、${pairSum}+${b}=${total}。`,
      String(total),
    ),
  });
}

/** 「□ に はいる数」の形(たす数をさがす)。 */
function missingProblem(input: GenerateInput, random: Random): GeneratedProblem {
  const rule = ruleFor(input.subUnit, input.level);
  const [answer, known] = pickPair(random, rule, accepts(rule));
  const total = answer + known;
  const text = random() < 0.5 ? `□ + ${known} = ${total}` : `${known} + □ = ${total}`;
  return buildProblem("math", input, {
    problemText: `${text} の □に はいる 数は いくつですか。`,
    correctAnswer: String(answer),
    hints: hintSet(
      random,
      "ぜんぶの かずから、わかっている かずを ひくと □が わかるよ。",
      "ひき算を つかって かんがえてみよう。",
      `${total}-${known}=${answer}。たしかめると ${answer}+${known}=${total}。`,
      String(answer),
    ),
  });
}

function storyProblem(input: GenerateInput, random: Random): GeneratedProblem {
  const rule = ruleFor(input.subUnit, input.level);
  const [a, b] = pickPair(random, rule, accepts(rule));
  const thing: Thing = pickOne(random, THINGS);
  const total = a + b;
  const start = input.level === 5;
  return buildProblem("math", input, {
    problemText: start ? startAddStory(thing, b, total) : addStory(random, thing, a, b),
    correctAnswer: withCounter(start ? a : total, thing),
    hints: start
      ? hintSet(
          random,
          "もんだいを よく よんで、はじめの かずを さがそう。",
          "いまの かずから、ふえた かずを ひくと はじめの かずが わかるよ。",
          `しきは ${total}-${b}=${a}。たしかめると ${a}+${b}=${total}。`,
          withCounter(a, thing),
        )
      : hintSet(
          random,
          "もんだいを よく よんで、しきを かんがえてみよう。",
          "あわせる ときや ふえる ときは、たし算を つかうよ。",
          `しきは ${a}+${b}=${total}。`,
          withCounter(total, thing),
        ),
  });
}

function generate(input: GenerateInput): GeneratedProblem {
  const random = randomFor(input);
  switch (formOf(input.subUnit, input.level)) {
    case "missing":
      return missingProblem(input, random);
    case "three":
      return threeProblem(input, random);
    case "story":
    case "startStory":
      return storyProblem(input, random);
    default:
      return plainProblem(input, random);
  }
}

const entry = (subUnit: string, levels: GeneratorEntry["levels"]): GeneratorEntry =>
  makeEntry({ subject: "math", unit: UNIT, subUnit, levels }, generate);

export const ADDITION_GENERATORS: readonly GeneratorEntry[] = [
  entry("2けたのたし算", {
    1: "2けた + 1けた(くり上がりなし)",
    2: "2けた + 2けた(くり上がりなし)",
    3: "2けた + 2けた(一の位でくり上がり)",
    4: "大きめの 2けた + 2けた(くり上がり)",
    5: "□に はいる数をさがす(たす数)",
  }),
  entry("くり上がり", {
    1: "2けた + 1けた(一の位でくり上がり)",
    2: "2けた + 2けた(一の位でくり上がり)",
    3: "2けた + 2けた(一の位と十の位でくり上がり。答えは3けた)",
    4: "大きな 2けた + 2けた(くり上がり2回)",
    5: "3けた + 2けた(一の位でくり上がり)",
  }),
  entry("3けたになるたし算", {
    1: "10の倍数どうし(答えが100をこえる)",
    2: "2けた + 2けた(十の位だけくり上がり)",
    3: "2けた + 2けた(くり上がり2回)",
    4: "3けた + 2けた",
    5: "3けた + 3けた",
  }),
  entry("計算のくふう", {
    1: "10のまとまりを作る(1けた + 1けた)",
    2: "9 + □(9を10にして考える)",
    3: "3つの数(たして10になる2つを先に)",
    4: "十の位と一の位に分けてたす(2けた + 2けた)",
    5: "3つの2けたの数(一の位がたして10になる2つを先に)",
  }),
  entry("たし算の文章題", {
    1: "お話の問題(1けた + 1けた)",
    2: "お話の問題(2けた + 1けた)",
    3: "お話の問題(2けた + 2けた)",
    4: "お話の問題(答えが3けた)",
    5: "お話の問題(はじめの数をさがす)",
  }),
];
