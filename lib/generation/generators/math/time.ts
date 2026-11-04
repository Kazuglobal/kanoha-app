import "server-only";
import { pickOne, randomInt } from "@/lib/utils/random";
import { specEntry, type ProblemSpec, type SpecContext } from "../../helpers";
import type { GeneratorEntry } from "../../types";

const UNIT = "時こくと時間";

/** 「ふん」と「ぷん」: 2・5・7・9 で終わるときだけ「ふん」(10・20・30… は「ぷん」)。 */
const minuteWord = (m: number): string => `${m}${[2, 5, 7, 9].includes(m % 10) ? "ふん" : "ぷん"}`;
const clock = (h: number, m = 0): string => (m === 0 ? `${h}じ` : `${h}じ${minuteWord(m)}`);
const span = (h: number, m: number): string => (h > 0 && m > 0 ? `${h}じかん${minuteWord(m)}` : h > 0 ? `${h}じかん` : minuteWord(m));
const fives = (from: number, to: number): number[] =>
  Array.from({ length: Math.floor((to - from) / 5) + 1 }, (_, index) => from + index * 5);

type Random = () => number;
type Build = (random: Random) => ProblemSpec;
type Builders = Readonly<Record<SpecContext["level"], Build>>;

/** 時計の時刻を すこしずらした まちがい候補。 */
function nearbyClocks(h: number, m: number): string[] {
  return [
    [h + 1, m], [h - 1, m], [h, m + 5], [h, m - 5], [h, m + 10], [h, m - 10],
  ]
    .filter(([hour, minute]) => hour >= 1 && hour <= 12 && minute >= 0 && minute < 60)
    .map(([hour, minute]) => clock(hour, minute));
}

function nearbySpans(h: number, m: number): string[] {
  return [
    [h + 1, m], [h - 1, m], [h, m + 10], [h, m - 10], [h + 1, m + 10],
  ]
    .filter(([hour, minute]) => hour >= 0 && minute >= 0 && minute < 60 && hour + minute > 0)
    .map(([hour, minute]) => span(hour, minute));
}

const HOUR_HINT = "とけいの みじかい はりが すすむ ようすを おもいうかべよう。";
const HAND_HINT = "とけいの みじかい はりが、すうじを いくつ すすんだか かぞえよう。";

// ---- 時こく: 何時何分の あと・まえ ----

const hourAfter: Build = (random) => {
  const h = randomInt(random, 1, 8);
  const k = randomInt(random, 1, 3);
  return {
    problemText: `${h}じの ${k}じかんあとは なんじですか。`,
    answer: clock(h + k),
    wrong: nearbyClocks(h + k, 0),
    hint1: HOUR_HINT,
    hint2: "じかんが ひとつ すすむごとに、みじかい はりは すうじを ひとつ すすむよ。",
    solution: `${h}じ から ${k}じかん すすむと ${h + k}じ。`,
  };
};

const halfHourAfter: Build = (random) => {
  const h = randomInt(random, 1, 10);
  return {
    problemText: `${h}じ30ぷんの 30ぷんあとは なんじですか。`,
    answer: clock(h + 1),
    wrong: [...nearbyClocks(h + 1, 0), clock(h), clock(h + 1, 30)],
    hint1: "30ぷんは 1じかんの はんぶん だよ。",
    hint2: "30ぷんと 30ぷんで、ちょうど 1じかん すすむよ。",
    solution: `${h}じ30ぷん から 30ぷん すすむと、${h + 1}じ ちょうど。`,
  };
};

const minutesAfter: Build = (random) => {
  const h = randomInt(random, 1, 11);
  const m = pickOne(random, fives(5, 40));
  const d = pickOne(random, fives(5, 55 - m));
  return {
    problemText: `${clock(h, m)}の ${minuteWord(d)}あとは なんじ なんぷんですか。`,
    answer: clock(h, m + d),
    wrong: nearbyClocks(h, m + d),
    hint1: "ふんの かずを たしてみよう。",
    hint2: "たした かずが 60に ならないことを たしかめよう。",
    solution: `${m}+${d}=${m + d} だから ${clock(h, m + d)}。`,
  };
};

const minutesAfterCarry: Build = (random) => {
  const h = randomInt(random, 1, 10);
  const m = pickOne(random, fives(35, 55));
  const d = pickOne(random, fives(25, 55).filter((n) => m + n > 60));
  const rest = m + d - 60;
  return {
    problemText: `${clock(h, m)}の ${minuteWord(d)}あとは なんじ なんぷんですか。`,
    answer: clock(h + 1, rest),
    // じを すすめわすれた まちがい。(ふんを 60 以上のまま書く形は、答えと同じ時こくになってしまうので使わない)
    wrong: [...nearbyClocks(h + 1, rest), clock(h, rest)],
    hint1: "ふんの かずを たすと、60を こえるよ。",
    hint2: "60ぷんで 1じかんだから、こえた ぶんを じに くりあげよう。",
    solution: `${m}+${d}=${m + d}。60を ひいて ${minuteWord(rest)}、じは ひとつ ふえて ${h + 1}じ。こたえは ${clock(h + 1, rest)}。`,
  };
};

const minutesBefore: Build = (random) => {
  const h = randomInt(random, 2, 12);
  const m = pickOne(random, fives(5, 50));
  const d = pickOne(random, fives(m + 5, 55));
  const rest = 60 + m - d;
  return {
    problemText: `${clock(h, m)}の ${minuteWord(d)}まえは なんじ なんぷんですか。`,
    answer: clock(h - 1, rest),
    wrong: [...nearbyClocks(h - 1, rest), clock(h, d - m)],
    hint1: "ふんの かずが ひけない ときは、ひとつ まえの じから かんがえよう。",
    hint2: "ひとつ まえの じに もどると、60ぷん ふえるよ。60ぷんを たしてから ひいてみよう。",
    solution: `${minuteWord(m)}から ${minuteWord(d)}は ひけないので、${h - 1}じの 60+${m}=${60 + m} から ${d} を ひく。${minuteWord(rest)}。こたえは ${clock(h - 1, rest)}。`,
  };
};

const CLOCK_BUILDERS: Builders = { 1: hourAfter, 2: halfHourAfter, 3: minutesAfter, 4: minutesAfterCarry, 5: minutesBefore };

// ---- 時間: はじめとおわりのあいだ ----

const wholeHours = (half: boolean): Build => (random) => {
  const d = randomInt(random, 1, 5);
  // 答えの数(d)が、問題文の はじめの時こくと同じにならないようにする
  const h1 = pickOne(random, Array.from({ length: 12 - d }, (_, index) => index + 1).filter((n) => n !== d));
  const h2 = h1 + d;
  const at = (h: number) => (half ? `${h}じ30ぷん` : `${h}じ`);
  return {
    problemText: `${at(h1)}から ${at(h2)}までは なんじかんですか。`,
    answer: `${d}じかん`,
    wrong: [d + 1, d + 2, d - 1, d + 3].filter((n) => n > 0).map((n) => `${n}じかん`),
    hint1: HAND_HINT,
    hint2: half ? "ふんは どちらも 30だから、じだけを くらべてみよう。" : "おわりの じから はじめの じを ひいてみよう。",
    solution: `${h2}-${h1}=${d} だから ${d}じかん。`,
  };
};

const hoursAndMinutes: Build = (random) => {
  const d = randomInt(random, 1, 4);
  const h1 = randomInt(random, 1, 12 - d - 1);
  const m = pickOne(random, [10, 20, 30, 40, 50]);
  return {
    problemText: `${h1}じから ${h1 + d}じ${minuteWord(m)}までは なんじかん なんぷんですか。`,
    answer: span(d, m),
    wrong: nearbySpans(d, m),
    hint1: "じの ぶんと、ふんの ぶんを わけて かんがえよう。",
    hint2: "じは おわりの じから はじめの じを ひいて、ふんは そのまま つなげよう。",
    solution: `${h1}じ から ${h1 + d}じ まで ${d}じかん、そのあと ${minuteWord(m)}。あわせて ${span(d, m)}。`,
  };
};

const minutesToSpan: Build = (random) => {
  const n = pickOne(random, fives(70, 175).filter((value) => value % 60 !== 0));
  const hours = Math.floor(n / 60);
  const rest = n % 60;
  return {
    problemText: `${minuteWord(n)}は なんじかん なんぷんですか。`,
    answer: span(hours, rest),
    wrong: nearbySpans(hours, rest),
    hint1: "60ぷんは 1じかん だよ。",
    hint2: "60ぷんが いくつ はいるか かんがえて、のこりを みてみよう。",
    solution: `${minuteWord(n)}の なかに、60ぷんが ${hours}こ(${minuteWord(hours * 60)})ある。のこりは ${minuteWord(rest)}。こたえは ${span(hours, rest)}。`,
  };
};

const departAndWalk: Build = (random) => {
  const h = randomInt(random, 1, 8);
  const m = pickOne(random, [10, 20, 30, 40, 50]);
  const hours = randomInt(random, 1, 3);
  // ちょうどの時こく(ふんが 0)になる組は、数が問題文とかさなりやすいので使わない
  const minutes = pickOne(random, [10, 20, 30, 40, 50].filter((n) => (m + n) % 60 !== 0));
  const total = m + minutes;
  const endHour = h + hours + (total >= 60 ? 1 : 0);
  const endMinute = total % 60;
  return {
    problemText: `${clock(h, m)}に いえを でて、${span(hours, minutes)}かけて あるきます。つくのは なんじ なんぷんですか。`,
    answer: clock(endHour, endMinute),
    wrong: nearbyClocks(endHour, endMinute),
    hint1: "じと ふんを べつべつに たしてみよう。",
    hint2: "ふんが 60を こえたら、じに ひとつ くりあげよう。",
    solution: `じ: ${h}+${hours}${total >= 60 ? "+1" : ""}=${endHour}、ふんの ぶん: ${m}+${minutes}=${total}${total >= 60 ? `(60を ひいて ${endMinute})` : ""}。こたえは ${clock(endHour, endMinute)}。`,
  };
};

const DURATION_BUILDERS: Builders = { 1: wholeHours(false), 2: wholeHours(true), 3: hoursAndMinutes, 4: minutesToSpan, 5: departAndWalk };

// ---- 午前と午後 ----

interface DayFact {
  readonly question: string;
  readonly answer: string;
  readonly wrong: readonly string[];
  readonly hint: string;
  readonly solution: string;
}

const DAY_FACTS: readonly DayFact[] = [
  { question: "1にちは なんじかんですか。", answer: "24じかん", wrong: ["12じかん", "10じかん", "20じかん", "60じかん"], hint: "ごぜんと ごごを あわせた じかんだよ。", solution: "ごぜんは 12じかん、ごごも 12じかん。あわせて 24じかん。" },
  { question: "ごぜんは なんじかん ありますか。", answer: "12じかん", wrong: ["6じかん", "24じかん", "10じかん", "20じかん"], hint: "1にちを 2つに わけた ぶんだよ。", solution: "1にちは 24じかん。はんぶんの 12じかんが ごぜん。" },
  { question: "ごごは なんじかん ありますか。", answer: "12じかん", wrong: ["6じかん", "24じかん", "10じかん", "20じかん"], hint: "1にちを 2つに わけた ぶんだよ。", solution: "1にちは 24じかん。はんぶんの 12じかんが ごご。" },
  { question: "1じかんは なんぷんですか。", answer: "60ぷん", wrong: ["30ぷん", "100ぷん", "10ぷん", "24ぷん"], hint: "ながい はりが ぐるっと まわる じかんだよ。", solution: "ながい はりが 1しゅうすると 60ぷん、それが 1じかん。" },
];

const dayFacts: Build = (random) => {
  const fact = pickOne(random, DAY_FACTS);
  return { problemText: fact.question, answer: fact.answer, wrong: fact.wrong, hint1: fact.hint, hint2: "とけいを おもいうかべて かんがえてみよう。", solution: fact.solution };
};

const PARTS_OF_DAY = [
  { when: "あさ", hours: [6, 7, 8, 9, 10], mark: "ごぜん", other: "ごご" },
  { when: "ひる", hours: [1, 2, 3, 4], mark: "ごご", other: "ごぜん" },
  { when: "よる", hours: [6, 7, 8, 9, 10], mark: "ごご", other: "ごぜん" },
] as const;

const nameTheTime: Build = (random) => {
  const part = pickOne(random, PARTS_OF_DAY);
  const h = pickOne(random, part.hours);
  return {
    problemText: `${part.when}の ${h}じを、ごぜんか ごごを つかって あらわすと どれですか。`,
    answer: `${part.mark}${h}じ`,
    wrong: [`${part.other}${h}じ`, `${part.mark}${h + 1}じ`, `${part.other}${h + 1}じ`],
    hint1: "ひるの 12じより まえが ごぜん、あとが ごご だよ。",
    hint2: `${part.when}は、ひるの 12じより まえかな、あとかな?`,
    solution: `${part.when}の ${h}じは、${part.mark}${h}じ。`,
  };
};

const afterNoon: Build = (random) => {
  const h = randomInt(random, 8, 11);
  const k = randomInt(random, 13 - h, 15 - h);
  const hour = h + k - 12;
  return {
    problemText: `ごぜん${h}じの ${k}じかんあとは ごご なんじですか。`,
    answer: `ごご${hour}じ`,
    wrong: [`ごぜん${hour}じ`, `ごご${hour + 1}じ`, `ごご${h + k}じ`],
    hint1: "ひるの 12じを こえると、ごご に なるよ。",
    hint2: "12じを こえたら、12を ひいた かずが ごごの じだよ。",
    solution: `${h}+${k}=${h + k}。12じを こえたので 12を ひいて ${hour}。ごご${hour}じ。`,
  };
};

const beforeNoon: Build = (random) => {
  const h = randomInt(random, 1, 3);
  const k = randomInt(random, h + 1, h + 3);
  const hour = 12 + h - k;
  return {
    problemText: `ごご${h}じの ${k}じかんまえは ごぜん なんじですか。`,
    answer: `ごぜん${hour}じ`,
    wrong: [`ごご${hour}じ`, `ごぜん${hour + 1}じ`, `ごぜん${hour - 1}じ`],
    hint1: "ひるの 12じを こえて もどると、ごぜん に なるよ。",
    hint2: "ごごの じから ひるの 12じまで もどって、のこりの じかんを さらに もどそう。",
    solution: `ごご${h}じ から ${h}じかん もどると ひるの 12じ。のこり ${k - h}じかん もどると ごぜん${hour}じ。`,
  };
};

const morningToAfternoon: Build = (random) => {
  const h1 = randomInt(random, 6, 11);
  // 答えの時間が、問題文の ごぜんの時こくと同じ数にならない ごごの時こくだけを候補にする
  const h2 = pickOne(random, [1, 2, 3, 4, 5].filter((n) => 12 - h1 + n !== h1));
  const total = 12 - h1 + h2;
  return {
    problemText: `ごぜん${h1}じから ごご${h2}じまでは なんじかんですか。`,
    answer: `${total}じかん`,
    // ごごの ぶんを たしわすれた形・足しすぎ・ひきすぎ などの まちがい(0 以下は除く)
    wrong: [12 - h1, total + 1, total - 1, total + 2, total - 2, h1 + h2].filter((n) => n > 0).map((n) => `${n}じかん`),
    hint1: "ひるの 12じを きっかけに、ふたつに わけて かんがえよう。",
    hint2: "ごぜんの ぶんと ごごの ぶんを べつべつに もとめて たそう。",
    solution: `ごぜん${h1}じ から 12じまで ${12 - h1}じかん。12じから ごご${h2}じまで ${h2}じかん。あわせて ${total}じかん。`,
  };
};

const AMPM_BUILDERS: Builders = { 1: dayFacts, 2: nameTheTime, 3: afterNoon, 4: beforeNoon, 5: morningToAfternoon };

const entry = (subUnit: string, builders: Builders, levels: GeneratorEntry["levels"]): GeneratorEntry =>
  specEntry({ subject: "math", unit: UNIT, subUnit, levels }, ({ level, random }) => builders[level](random));

export const TIME_GENERATORS: readonly GeneratorEntry[] = [
  entry("時こく", CLOCK_BUILDERS, {
    1: "○じの ○じかんあと(ちょうどの時こく)",
    2: "○じ30ぷんの 30ぷんあと",
    3: "○じ○ふんの ○ふんあと(1じかんをこえない)",
    4: "○じ○ふんの ○ふんあと(1じかんをこえる)",
    5: "○じ○ふんの ○ふんまえ(1じかんまえにもどる)",
  }),
  entry("時間", DURATION_BUILDERS, {
    1: "○じから ○じまで(ちょうどの時こく)",
    2: "○じ30ぷんから ○じ30ぷんまで",
    3: "○じから ○じ○ふんまで",
    4: "○ふんを 「○じかん ○ふん」で言う",
    5: "出かけた時こく + かかった時間",
  }),
  entry("午前と午後", AMPM_BUILDERS, {
    1: "1日・ごぜん・ごご・1じかんの長さ",
    2: "あさ・ひる・よるの 時こくを ごぜん/ごごで言う",
    3: "ごぜんの時こくの ○じかんあと(ごごになる)",
    4: "ごごの時こくの ○じかんまえ(ごぜんになる)",
    5: "ごぜん○じから ごご○じまで",
  }),
];
