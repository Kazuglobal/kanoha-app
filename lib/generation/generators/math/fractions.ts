import "server-only";
import { pickOne } from "@/lib/utils/random";
import { specEntry, type ProblemSpec, type SpecContext } from "../../helpers";
import type { GeneratorEntry } from "../../types";

const UNIT = "分数";
const WHOLE = "まるごと ひとつ";
const SAME = "おなじ おおきさ";
const SHAPES = ["ピザ", "ケーキ", "ホットケーキ", "テープ", "パン"] as const;

/** 選択肢・答えは ひらがなの「ぶんの」で書く(選択肢には ルビを付けないため)。入力のしかたは「4分の1」でも合う。 */
const frac = (n: number): string => `${n}ぶんの1`;
const all = (shape: string) => `${shape}まるごと ひとつ`;

type Random = () => number;
type Build = (random: Random) => ProblemSpec;
type Builders = Readonly<Record<SpecContext["level"], Build>>;

/** 1つぶんの おおきさとして まぎらわしい 答えのまちがい候補(2年生では出てこない 3 もまぜる)。 */
const otherFractions = (answer: string): string[] => [frac(2), frac(3), frac(4), frac(8), WHOLE].filter((text) => text !== answer);

/** ○つに おなじ おおきさに わけた 1つぶんは ぜんたいの なんぶんの いくつ。 */
const split = (parts: readonly number[], asFraction: boolean): Build => (random) => {
  const n = pickOne(random, parts);
  const shape = pickOne(random, SHAPES);
  return {
    problemText: asFraction
      ? `${shape}を ${n}つに おなじ おおきさに わけた 1つぶんを、ぶんすうで あらわすと どれですか。`
      : `${shape}を ${n}つに おなじ おおきさに わけました。1つぶんは、${all(shape)}の なんぶんの いくつですか。`,
    answer: frac(n),
    wrong: otherFractions(frac(n)),
    hint1: "おなじ おおきさに わけた 1つぶんを かんがえよう。",
    hint2: `ぜんぶで ${n}つに わけたから、${n}つの うちの 1つ だよ。`,
    solution: `${n}つに わけた 1つぶんは、${frac(n)} だよ。`,
  };
};

/** 1/d を count こ あわせる(count × 1/d が 1/m か まるごと になるものだけ)。 */
const combine = (d: number, count: number): Build => (random) => {
  const shape = pickOne(random, SHAPES);
  const answer = count === d ? WHOLE : frac(d / count);
  const ask = count === d ? "どんな おおきさに なりますか。" : `${all(shape)}の なんぶんの いくつに なりますか。`;
  return {
    problemText: `${shape}の ${frac(d)}の おおきさを ${count}つ あわせると、${ask}`,
    answer,
    wrong: otherFractions(answer),
    hint1: `${d}つに わけた うちの ${count}つぶんを かんがえよう。`,
    hint2: count === d ? "ぜんぶ あつめると、もとの かたちに もどるよ。" : `ぜんぶを ${d / count}つに わけた 1つぶんと おなじ おおきさだよ。`,
    solution: count === d ? `${frac(d)}を ${d}つ あわせると、${all(shape)}に なるよ。` : `${d}つに わけた うちの ${count}つぶんは、${answer} だよ。`,
  };
};

/** ○つに わけた 1つぶんを、さらに 2つに わける。いちばん ちいさい 1つぶんは ぜんたいの なんぶんの いくつ。 */
const halve = (parts: readonly number[]): Build => (random) => {
  const d = pickOne(random, parts);
  const shape = pickOne(random, SHAPES);
  return {
    problemText: `${shape}を ${d}つに おなじ おおきさに わけて、その 1つぶんを、さらに おなじ おおきさに 2つに わけました。いちばん ちいさい 1つぶんは、${all(shape)}の なんぶんの いくつですか。`,
    answer: frac(d * 2),
    wrong: otherFractions(frac(d * 2)),
    hint1: "まず わけた 1つぶんを、もう ひとつ はんぶんに するよ。",
    hint2: "ぜんぶを いくつに わけた ことに なるかな?",
    solution: `${d}つに わけた 1つぶんを はんぶんに すると、ぜんぶを ${d * 2}つに わけた 1つぶん。${frac(d * 2)} だよ。`,
  };
};

type Rank = "largest" | "middle" | "smallest";
const RANK_TEXT: Readonly<Record<Rank, string>> = { largest: "いちばん おおきいのは どれですか。", middle: "おおきい じゅんに ならべたとき、まんなかに くるのは どれですか。", smallest: "いちばん ちいさいのは どれですか。" };
const RANK_HINT: Readonly<Record<Rank, string>> = {
  largest: "おなじものを わけるとき、わける かずが すくないほど 1つぶんは おおきいよ。",
  middle: "わける かずが まんなかの ものを さがそう。",
  smallest: "おなじものを わけるとき、わける かずが おおいほど 1つぶんは ちいさいよ。",
};

/** ○つに わけた 1つぶんどうしを くらべる。 */
const compare = (parts: readonly number[], rank: Rank): Build => (random) => {
  const shape = pickOne(random, SHAPES);
  const sorted = [...parts].sort((a, b) => a - b);
  const target = rank === "largest" ? sorted[0] : rank === "smallest" ? sorted[sorted.length - 1] : sorted[Math.floor(sorted.length / 2)];
  const list = sorted.map((n) => `${n}つに わけた 1つぶん`).join("と、");
  return {
    problemText: `おなじ おおきさの ${shape}を、${list}で くらべます。${RANK_TEXT[rank]}`,
    answer: frac(target),
    wrong: [...sorted.filter((n) => n !== target).map(frac), SAME, ...(sorted.length < 3 ? [frac(2)] : [])].filter((text) => text !== frac(target)),
    hint1: "おなじ おおきさの ものを わけて くらべるよ。",
    hint2: RANK_HINT[rank],
    solution: `${sorted.join("つ・")}つに わけた 1つぶんを くらべると、こたえは ${frac(target)} だよ。`,
  };
};

/** ○つに わけた ものを ぜんぶ あつめると もとにもどる。 */
const gatherAll = (parts: readonly number[]): Build => (random) => {
  const n = pickOne(random, parts);
  const shape = pickOne(random, SHAPES);
  return {
    problemText: `${shape}を ${n}つに おなじ おおきさに わけました。${n}つぶん ぜんぶ あつめると、どんな おおきさに なりますか。`,
    answer: WHOLE,
    wrong: [frac(2), frac(4), frac(8), SAME].filter((text) => text !== WHOLE),
    hint1: "わけた ぶんを ぜんぶ もとに もどすと どうなるかな?",
    hint2: "ぜんぶ あつめると、わける まえと おなじだよ。",
    solution: `${n}つぶん ぜんぶ あつめると、${all(shape)}に もどるよ。`,
  };
};

/** 1/d の 2こぶん が ぜんたいの なんぶんの いくつ。 */
const twoPieces = (parts: readonly number[]): Build => (random) => combine(pickOne(random, parts), 2)(random);

const entry = (subUnit: string, builders: Builders, levels: GeneratorEntry["levels"]): GeneratorEntry =>
  specEntry({ subject: "math", unit: UNIT, subUnit, levels }, ({ level, random }) => builders[level](random));

const MIXED = [2, 4, 8] as const;

export const FRACTION_GENERATORS: readonly GeneratorEntry[] = [
  entry("分けた大きさ", { 1: split([2, 4], false), 2: split(MIXED, false), 3: split(MIXED, true), 4: twoPieces([4, 8]), 5: gatherAll(MIXED) }, {
    1: "2つ・4つに わけた 1つぶん",
    2: "2つ・4つ・8つに わけた 1つぶん",
    3: "2つ・4つ・8つに わけた 1つぶんを ぶんすうで言う",
    4: "4つ・8つに わけた 1つぶんを 2つ あわせる",
    5: "わけた ものを ぜんぶ あつめる",
  }),
  entry("2分の1", { 1: split([2], false), 2: combine(2, 2), 3: combine(4, 2), 4: combine(8, 4), 5: compare(MIXED, "largest") }, {
    1: "2つに わけた 1つぶん",
    2: "2ぶんの1を 2つ あわせる",
    3: "4ぶんの1を 2つ あわせる",
    4: "8ぶんの1を 4つ あわせる",
    5: "2つ・4つ・8つに わけた 1つぶんの いちばん大きいもの",
  }),
  entry("4分の1", { 1: split([4], false), 2: combine(4, 4), 3: combine(8, 2), 4: halve([2]), 5: compare(MIXED, "middle") }, {
    1: "4つに わけた 1つぶん",
    2: "4ぶんの1を 4つ あわせる",
    3: "8ぶんの1を 2つ あわせる",
    4: "2つに わけた 1つぶんを さらに はんぶんに する",
    5: "2つ・4つ・8つに わけた 1つぶんの まんなか",
  }),
  entry("8分の1", { 1: split([8], false), 2: combine(8, 8), 3: halve([4]), 4: compare([4, 8], "smallest"), 5: compare(MIXED, "smallest") }, {
    1: "8つに わけた 1つぶん",
    2: "8ぶんの1を 8つ あわせる",
    3: "4つに わけた 1つぶんを さらに はんぶんに する",
    4: "4つ・8つに わけた 1つぶんの 小さいほう",
    5: "2つ・4つ・8つに わけた 1つぶんの いちばん小さいもの",
  }),
];
