import { describe, expect, it } from "vitest";
import { TIME_GENERATORS } from "@/lib/generation/generators/math/time";
import type { GeneratedProblem } from "@/lib/generation/types";
import { LEVELS, type Level } from "@/lib/learning/level";
import { describeBasics, generateAt, numbersIn } from "./support";

const byName = (subUnit: string) => TIME_GENERATORS.find((entry) => entry.subUnit === subUnit)!;

describe("時こくと時間の生成器", () => {
  it("小単元がそろっている", () => {
    expect(TIME_GENERATORS.map((entry) => entry.subUnit)).toEqual(["時こく", "時間", "午前と午後"]);
    expect(new Set(TIME_GENERATORS.map((entry) => entry.unit))).toEqual(new Set(["時こくと時間"]));
  });
});

// 時こくは全レベル 4 択。午前と午後のレベル 4 は 4 種類の事実だけなので、問題の数は少ない
describeBasics([byName("時こく")], { choiceLevels: [...LEVELS], minVariety: (level) => (level <= 2 ? 6 : 20) });
describeBasics([byName("時間")], { choiceLevels: [...LEVELS], minVariety: (level) => (level <= 2 ? 15 : 20) });
describeBasics([byName("午前と午後")], { choiceLevels: [...LEVELS], minVariety: (level) => (level === 1 ? 3 : 6) });

/** 実装とは別に、「3じ40ぷん」「5じ」「2じかん30ぷん」を (時, 分) に読む。 */
function readClock(text: string): [number, number] {
  const match = /^(\d+)じ(?:(\d+)(?:ふん|ぷん))?$/.exec(text);
  if (!match) throw new Error(`not a clock time: ${text}`);
  return [Number(match[1]), Number(match[2] ?? 0)];
}

function readSpan(text: string): number {
  const match = /^(?:(\d+)じかん)?(?:(\d+)(?:ふん|ぷん))?$/.exec(text);
  if (!match || text === "") throw new Error(`not a duration: ${text}`);
  return Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
}

const minutesOf = ([h, m]: [number, number]) => h * 60 + m;

/** 「ふん」「ぷん」の読みかえ: 2・5・7・9 で終わる分だけ「ふん」。 */
const correctCounter = (n: number) => ([2, 5, 7, 9].includes(n % 10) ? "ふん" : "ぷん");

describe("時こく", () => {
  const build = (level: Level): GeneratedProblem[] => generateAt(byName("時こく"), level);

  it("レベル 1: ○じの ○じかんあと", () => {
    for (const problem of build(1)) {
      const [h, k] = numbersIn(problem.problemText);
      expect(readClock(problem.correctAnswer), problem.problemText).toEqual([h + k, 0]);
    }
  });

  it("レベル 2: ○じ30ぷんの 30ぷんあと = 次の ちょうどの時こく", () => {
    for (const problem of build(2)) {
      const [h] = numbersIn(problem.problemText);
      expect(readClock(problem.correctAnswer), problem.problemText).toEqual([h + 1, 0]);
    }
  });

  it("レベル 3: 1じかんをこえない足し算", () => {
    for (const problem of build(3)) {
      const [h, m, d] = numbersIn(problem.problemText);
      expect(readClock(problem.correctAnswer), problem.problemText).toEqual([h, m + d]);
      expect(m + d).toBeLessThan(60);
    }
  });

  it("レベル 4: 60ふんをこえて、じが 1 すすむ", () => {
    for (const problem of build(4)) {
      const [h, m, d] = numbersIn(problem.problemText);
      expect(m + d).toBeGreaterThan(60);
      expect(readClock(problem.correctAnswer), problem.problemText).toEqual([h + 1, m + d - 60]);
      expect(minutesOf(readClock(problem.correctAnswer)) - minutesOf([h, m])).toBe(d);
    }
  });

  it("レベル 5: ○ふんまえ(じを 1 もどす)", () => {
    for (const problem of build(5)) {
      const [h, m, d] = numbersIn(problem.problemText);
      expect(d).toBeGreaterThan(m);
      expect(readClock(problem.correctAnswer), problem.problemText).toEqual([h - 1, 60 + m - d]);
      expect(minutesOf([h, m]) - minutesOf(readClock(problem.correctAnswer))).toBe(d);
    }
  });

  it("「ふん」と「ぷん」を正しく書き分ける(問題文・答え・選択肢・ヒント・解き方、3 つの小単元すべて)", () => {
    for (const subUnit of ["時こく", "時間", "午前と午後"]) {
      for (const level of LEVELS) {
        for (const problem of generateAt(byName(subUnit), level)) {
          const texts = [problem.problemText, problem.correctAnswer, ...(problem.choices ?? []), ...Object.values(problem.hints)];
          for (const text of texts) {
            for (const match of text.matchAll(/(\d+)(ふん|ぷん)/g)) {
              expect(match[2], `${subUnit} L${level}: ${text}`).toBe(correctCounter(Number(match[1])));
            }
          }
        }
      }
    }
  });

  it("選択肢はすべて時こくの書き方で、答えは 1 つだけ同じ時こく", () => {
    for (const level of LEVELS) {
      for (const problem of build(level)) {
        const answer = minutesOf(readClock(problem.correctAnswer));
        const same = problem.choices!.filter((choice) => {
          const [h, m] = readClock(choice);
          return h * 60 + m === answer;
        });
        expect(same, problem.problemText).toHaveLength(1);
      }
    }
  });
});

describe("時間", () => {
  const build = (level: Level): GeneratedProblem[] => generateAt(byName("時間"), level);

  it.each([1, 2] as const)("レベル %i: おわりの じ - はじめの じ", (level) => {
    for (const problem of build(level)) {
      const nums = numbersIn(problem.problemText);
      const [h1, h2] = level === 1 ? [nums[0], nums[1]] : [nums[0], nums[2]];
      expect(readSpan(problem.correctAnswer), problem.problemText).toBe((h2 - h1) * 60);
    }
  });

  it("レベル 3: じの ぶん + ふんの ぶん", () => {
    for (const problem of build(3)) {
      const [h1, h2, m] = numbersIn(problem.problemText);
      expect(readSpan(problem.correctAnswer), problem.problemText).toBe((h2 - h1) * 60 + m);
    }
  });

  it("レベル 4: ○ふん = ○じかん ○ふん", () => {
    for (const problem of build(4)) {
      const [n] = numbersIn(problem.problemText);
      expect(readSpan(problem.correctAnswer), problem.problemText).toBe(n);
      expect(n % 60).not.toBe(0);
    }
  });

  it("レベル 5: 出かけた時こく + かかった時間", () => {
    for (const problem of build(5)) {
      const [h, m, hours, minutes] = numbersIn(problem.problemText);
      expect(minutesOf(readClock(problem.correctAnswer)), problem.problemText).toBe(minutesOf([h, m]) + hours * 60 + minutes);
    }
  });

  it("選択肢のなかで 1 つだけが答えと同じ長さ", () => {
    for (const level of [3, 4] as const) {
      for (const problem of build(level)) {
        const answer = readSpan(problem.correctAnswer);
        expect(problem.choices!.filter((choice) => readSpan(choice) === answer), problem.problemText).toHaveLength(1);
      }
    }
  });
});

describe("午前と午後", () => {
  const build = (level: Level): GeneratedProblem[] => generateAt(byName("午前と午後"), level);

  it("レベル 1: 決まった長さ(1日=24じかん・ごぜん/ごご=12じかん・1じかん=60ぷん)", () => {
    const facts = new Map([
      ["1にちは なんじかんですか。", "24じかん"],
      ["ごぜんは なんじかん ありますか。", "12じかん"],
      ["ごごは なんじかん ありますか。", "12じかん"],
      ["1じかんは なんぷんですか。", "60ぷん"],
    ]);
    for (const problem of build(1)) expect(facts.get(problem.problemText), problem.problemText).toBe(problem.correctAnswer);
  });

  it("レベル 2: あさ・ひる・よるを ごぜん/ごごで言う", () => {
    for (const problem of build(2)) {
      const [h] = numbersIn(problem.problemText);
      const expected = problem.problemText.startsWith("あさ") ? "ごぜん" : "ごご";
      expect(problem.correctAnswer, problem.problemText).toBe(`${expected}${h}じ`);
    }
  });

  it("レベル 3: ごぜんの時こく + ○じかん は ごごの時こくになる", () => {
    for (const problem of build(3)) {
      const [h, k] = numbersIn(problem.problemText);
      expect(problem.correctAnswer, problem.problemText).toBe(`ごご${h + k - 12}じ`);
      expect(h + k).toBeGreaterThan(12);
    }
  });

  it("レベル 4: ごごの時こく - ○じかん は ごぜんの時こくになる", () => {
    for (const problem of build(4)) {
      const [h, k] = numbersIn(problem.problemText);
      expect(problem.correctAnswer, problem.problemText).toBe(`ごぜん${12 + h - k}じ`);
      expect(k).toBeGreaterThan(h);
    }
  });

  it("レベル 5: ごぜん○じから ごご○じまで = (12 - ○) + ○", () => {
    for (const problem of build(5)) {
      const [h1, h2] = numbersIn(problem.problemText);
      expect(problem.correctAnswer, problem.problemText).toBe(`${12 - h1 + h2}じかん`);
    }
  });
});
