import "server-only";
import type { Level } from "@/lib/learning/level";
import { pickOne } from "@/lib/utils/random";
import { buildProblem, hintSet, makeEntry, randomFor, type Random } from "../../helpers";
import type { GenerateInput, GeneratedProblem, GeneratorEntry } from "../../types";
import { borrowsOf, pickPair, r, subSteps, type Marks, type PairSpace } from "./columns";
import { startSubStory, subStory, THINGS, withCounter, type Thing } from "./story";

const UNIT = "ひき算";

type BorrowRule = (marks: Marks) => boolean;
const NO_BORROW: BorrowRule = (m) => !m.ones && !m.tens && !m.hundreds;
const ONES_ONLY: BorrowRule = (m) => m.ones && !m.tens;
const ONES: BorrowRule = (m) => m.ones;
const TENS_ONLY: BorrowRule = (m) => m.tens && !m.ones;
const TENS: BorrowRule = (m) => m.tens;
const ONES_AND_TENS: BorrowRule = (m) => m.ones && m.tens;
const ONES_ONLY_3: BorrowRule = (m) => m.ones && !m.tens && !m.hundreds;
const ANY: BorrowRule = () => true;

type Form = "plain" | "missing" | "story" | "startStory";

/** a から b をひく組をえらぶ決まり(いつも a > b)。 */
interface Rule extends PairSpace {
  readonly borrow: BorrowRule;
  /** a の条件(「十の位が 0 の 3けた」など) */
  readonly onlyA?: (a: number) => boolean;
}

const RULES: Readonly<Record<string, Readonly<Partial<Record<Level, Rule>>>>> = {
  "2けたのひき算": {
    1: { a: r(20, 99), b: r(1, 9), borrow: NO_BORROW },
    2: { a: r(21, 99), b: r(11, 98), borrow: NO_BORROW },
    3: { a: r(11, 99), b: r(11, 98), borrow: ONES_ONLY },
    4: { a: r(50, 99), b: r(30, 98), borrow: ONES_ONLY },
    5: { a: r(11, 99), b: r(11, 98), borrow: ONES },
  },
  "くり下がり": {
    1: { a: r(11, 18), b: r(2, 9), borrow: ONES },
    2: { a: r(21, 99), b: r(2, 9), borrow: ONES },
    3: { a: r(11, 99), b: r(11, 98), borrow: ONES_ONLY },
    4: { a: r(60, 99), b: r(30, 98), borrow: ONES_ONLY },
    5: { a: r(100, 300), b: r(11, 99), borrow: ONES_ONLY_3 },
  },
  "百の位からのくり下がり": {
    1: { a: r(100, 100), b: r(1, 99), borrow: ANY },
    2: { a: r(100, 199), b: r(11, 99), borrow: TENS_ONLY },
    3: { a: r(100, 199), b: r(11, 99), borrow: ONES_AND_TENS },
    4: { a: r(200, 500), b: r(11, 99), borrow: TENS, onlyA: (a) => a % 100 < 10 },
    5: { a: r(200, 999), b: r(20, 199), borrow: TENS },
  },
  "ひき算の文章題": {
    1: { a: r(6, 18), b: r(2, 9), borrow: ANY },
    2: { a: r(21, 99), b: r(2, 9), borrow: ANY },
    3: { a: r(11, 99), b: r(11, 98), borrow: ANY },
    4: { a: r(100, 199), b: r(20, 99), borrow: ANY },
  },
};

const formOf = (subUnit: string, level: Level): Form => {
  if (subUnit === "ひき算の文章題") return level === 5 ? "startStory" : "story";
  if (subUnit === "2けたのひき算" && level === 5) return "missing";
  return "plain";
};

function ruleFor(subUnit: string, level: Level): Rule {
  const rule = RULES[subUnit]?.[level];
  if (!rule) throw new RangeError(`no rule for ${subUnit} L${level}`);
  return rule;
}

/**
 * a > b で、答え(a - b)が b と同じ数にならないこと(「18 - 9 = 9」だと問題文に答えが出てしまう)。
 */
const accepts = (rule: Rule) => (a: number, b: number): boolean =>
  a > b && a - b !== b && rule.borrow(borrowsOf(a, b)) && (rule.onlyA?.(a) ?? true);

function borrowHint(a: number, b: number): string {
  const marks = borrowsOf(a, b);
  if (marks.tens) return "じゅうのくらいが ひけない ときは、ひゃくのくらいから ひとつ かりてこよう。";
  if (marks.ones) return "いちのくらいが ひけない ときは、じゅうのくらいから ひとつ かりてこよう。";
  return "いちのくらいと じゅうのくらいを べつべつに ひいてみよう。";
}

function plainProblem(input: GenerateInput, random: Random): GeneratedProblem {
  const rule = ruleFor(input.subUnit, input.level);
  const [a, b] = pickPair(random, rule, accepts(rule));
  return buildProblem("math", input, {
    problemText: `${a} - ${b} は いくつですか。`,
    correctAnswer: String(a - b),
    hints: hintSet(
      random,
      "くらいを そろえて、いちのくらいから じゅんに ひいてみよう。",
      borrowHint(a, b),
      subSteps(a, b),
      String(a - b),
    ),
  });
}

/** 「□ に はいる数」の形。ひく数をさがすか、もとの数をさがす。 */
function missingProblem(input: GenerateInput, random: Random): GeneratedProblem {
  const rule = ruleFor(input.subUnit, input.level);
  const [a, b] = pickPair(random, rule, accepts(rule));
  const rest = a - b;
  const findStart = random() < 0.5;
  return buildProblem("math", input, {
    problemText: findStart
      ? `□ - ${b} = ${rest} の □に はいる 数は いくつですか。`
      : `${a} - □ = ${rest} の □に はいる 数は いくつですか。`,
    correctAnswer: String(findStart ? a : b),
    hints: hintSet(
      random,
      "□に はいる かずを さがすには、たし算や ひき算を つかうよ。",
      findStart
        ? "のこりの かずに、ひいた かずを たすと もとの かずに なるよ。"
        : "はじめの かずから のこりの かずを ひくと、ひいた かずが わかるよ。",
      findStart ? `${rest}+${b}=${a}。たしかめると ${a}-${b}=${rest}。` : `${a}-${rest}=${b}。たしかめると ${a}-${b}=${rest}。`,
      String(findStart ? a : b),
    ),
  });
}

function storyProblem(input: GenerateInput, random: Random): GeneratedProblem {
  const thing: Thing = pickOne(random, THINGS);
  if (input.level === 5) return startStoryProblem(input, random, thing);
  const rule = ruleFor(input.subUnit, input.level);
  const [a, b] = pickPair(random, rule, accepts(rule));
  return buildProblem("math", input, {
    problemText: subStory(random, thing, a, b),
    correctAnswer: withCounter(a - b, thing),
    hints: hintSet(
      random,
      "もんだいを よく よんで、しきを かんがえてみよう。",
      "のこりを もとめる ときは、ひき算を つかうよ。",
      `しきは ${a}-${b}=${a - b}。`,
      withCounter(a - b, thing),
    ),
  });
}

/** あげた数とのこりから、はじめの数をさがすお話。 */
function startStoryProblem(input: GenerateInput, random: Random, thing: Thing): GeneratedProblem {
  const [given, rest] = pickPair(random, { a: r(11, 60), b: r(11, 60) }, (g, left) => g + left < 100);
  const start = given + rest;
  return buildProblem("math", input, {
    problemText: startSubStory(thing, given, rest),
    correctAnswer: withCounter(start, thing),
    hints: hintSet(
      random,
      "もんだいを よく よんで、はじめの かずを さがそう。",
      "いまの かずに、あげた かずを たすと はじめの かずが わかるよ。",
      `しきは ${rest}+${given}=${start}。たしかめると ${start}-${given}=${rest}。`,
      withCounter(start, thing),
    ),
  });
}

function generate(input: GenerateInput): GeneratedProblem {
  const random = randomFor(input);
  switch (formOf(input.subUnit, input.level)) {
    case "missing":
      return missingProblem(input, random);
    case "story":
    case "startStory":
      return storyProblem(input, random);
    default:
      return plainProblem(input, random);
  }
}

const entry = (subUnit: string, levels: GeneratorEntry["levels"]): GeneratorEntry =>
  makeEntry({ subject: "math", unit: UNIT, subUnit, levels }, generate);

export const SUBTRACTION_GENERATORS: readonly GeneratorEntry[] = [
  entry("2けたのひき算", {
    1: "2けた - 1けた(くり下がりなし)",
    2: "2けた - 2けた(くり下がりなし)",
    3: "2けた - 2けた(一の位でくり下がり)",
    4: "大きめの 2けた - 2けた(くり下がり)",
    5: "□に はいる数をさがす(ひく数・もとの数)",
  }),
  entry("くり下がり", {
    1: "11〜18 - 1けた(くり下がり)",
    2: "2けた - 1けた(くり下がり)",
    3: "2けた - 2けた(くり下がり)",
    4: "大きな 2けた - 2けた(くり下がり)",
    5: "3けた - 2けた(一の位でくり下がり)",
  }),
  entry("百の位からのくり下がり", {
    1: "100 - 2けた以下の数",
    2: "百の位からかりる(十の位だけ)",
    3: "百の位と一の位の両方でくり下がり",
    4: "十の位が 0 の 3けた - 2けた",
    5: "3けた - 2〜3けた(百の位からかりる)",
  }),
  entry("ひき算の文章題", {
    1: "お話の問題(18までの数)",
    2: "お話の問題(2けた - 1けた)",
    3: "お話の問題(2けた - 2けた)",
    4: "お話の問題(3けた - 2けた)",
    5: "お話の問題(はじめの数をさがす)",
  }),
];
