import { describe, expect, it } from "vitest";
import { NUMBER_GENERATORS } from "@/lib/generation/generators/math/numbers";
import type { GeneratedProblem } from "@/lib/generation/types";
import type { Level } from "@/lib/learning/level";
import { answerNumber, between, describeBasics, generateAt, numbersIn } from "./support";

const byName = (subUnit: string) => NUMBER_GENERATORS.find((entry) => entry.subUnit === subUnit)!;
const build = (subUnit: string, level: Level): GeneratedProblem[] => generateAt(byName(subUnit), level);

describe("1000より大きい数の生成器", () => {
  it("小単元がそろっている", () => {
    expect(NUMBER_GENERATORS.map((entry) => entry.subUnit)).toEqual(["1000までの数", "10000までの数", "数のしくみ", "数の大小"]);
    expect(new Set(NUMBER_GENERATORS.map((entry) => entry.unit))).toEqual(new Set(["1000より大きい数"]));
  });
});

describeBasics([byName("1000までの数")], { choiceLevels: [], minVariety: () => 20 });
describeBasics([byName("10000までの数")], { choiceLevels: [], minVariety: (level) => (level === 1 ? 6 : 20) });
describeBasics([byName("数のしくみ")], { choiceLevels: [5], minVariety: () => 15 });
describeBasics([byName("数の大小")], { choiceLevels: [1, 2, 3, 4, 5], minVariety: () => 30 });

describe("1000までの数: 位ごとの いくつぶんから数をつくる", () => {
  it("レベル 1: 10が ○こ", () => {
    for (const problem of build("1000までの数", 1)) {
      const [, n] = numbersIn(problem.problemText);
      expect(answerNumber(problem), problem.problemText).toBe(n * 10);
      expect(between(n, 11, 99)).toBe(true);
    }
  });

  it("レベル 2・3・4: 100・10・1 の いくつぶんを足した数", () => {
    for (const problem of build("1000までの数", 2)) {
      const [, h, , t] = numbersIn(problem.problemText);
      expect(answerNumber(problem), problem.problemText).toBe(h * 100 + t * 10);
    }
    for (const problem of build("1000までの数", 3)) {
      const [, h, , t, , o] = numbersIn(problem.problemText);
      expect(answerNumber(problem), problem.problemText).toBe(h * 100 + t * 10 + o);
    }
    for (const problem of build("1000までの数", 4)) {
      const [, h, , o] = numbersIn(problem.problemText);
      expect(answerNumber(problem), problem.problemText).toBe(h * 100 + o);
      expect(Math.floor(answerNumber(problem) / 10) % 10).toBe(0);
    }
  });

  it("レベル 5: ○は 10が なんこ ぶん", () => {
    for (const problem of build("1000までの数", 5)) {
      const [n] = numbersIn(problem.problemText);
      expect(n % 10).toBe(0);
      expect(problem.correctAnswer, problem.problemText).toBe(`${n / 10}こ`);
    }
  });
});

describe("10000までの数", () => {
  it("レベル 1〜3: 1000・100・10・1 の いくつぶんを足した数", () => {
    for (const problem of build("10000までの数", 1)) {
      const [, n] = numbersIn(problem.problemText);
      expect(answerNumber(problem), problem.problemText).toBe(n * 1000);
    }
    for (const problem of build("10000までの数", 2)) {
      const [, th, , h] = numbersIn(problem.problemText);
      expect(answerNumber(problem), problem.problemText).toBe(th * 1000 + h * 100);
    }
    for (const problem of build("10000までの数", 3)) {
      const [, th, , h, , t, , o] = numbersIn(problem.problemText);
      expect(answerNumber(problem), problem.problemText).toBe(th * 1000 + h * 100 + t * 10 + o);
    }
  });

  it("レベル 4: 100のくらいが 0 の数", () => {
    for (const problem of build("10000までの数", 4)) {
      const [, th, , t] = numbersIn(problem.problemText);
      expect(answerNumber(problem), problem.problemText).toBe(th * 1000 + t * 10);
      expect(Math.floor(answerNumber(problem) / 100) % 10).toBe(0);
    }
  });

  it("レベル 5: ○は 100が なんこ ぶん", () => {
    for (const problem of build("10000までの数", 5)) {
      const [n] = numbersIn(problem.problemText);
      expect(n % 100).toBe(0);
      expect(problem.correctAnswer, problem.problemText).toBe(`${n / 100}こ`);
    }
  });
});

describe("数のしくみ", () => {
  const PLACES: Record<string, number> = { いちのくらい: 0, じゅうのくらい: 1, ひゃくのくらい: 2, せんのくらい: 3 };
  const digitOf = (n: number, place: number) => Math.floor(n / 10 ** place) % 10;

  it.each([1, 2, 3, 4] as const)("レベル %i: 指定したくらいの すうじが答え", (level) => {
    for (const problem of build("数のしくみ", level)) {
      const [n] = numbersIn(problem.problemText);
      const name = Object.keys(PLACES).find((key) => problem.problemText.includes(key))!;
      expect(answerNumber(problem), problem.problemText).toBe(digitOf(n, PLACES[name]));
      if (level <= 2) expect(between(n, 111, 999)).toBe(true);
      else expect(between(n, 1000, 9999)).toBe(true);
    }
  });

  it("レベル 1 は ひゃくの、レベル 2 は じゅうの くらいをたずねる", () => {
    for (const problem of build("数のしくみ", 1)) expect(problem.problemText).toContain("ひゃくのくらい");
    for (const problem of build("数のしくみ", 2)) expect(problem.problemText).toContain("じゅうのくらい");
  });

  it("レベル 4: どこかのくらいに 0 がある数だけ", () => {
    for (const problem of build("数のしくみ", 4)) {
      const [n] = numbersIn(problem.problemText);
      expect([...String(n)].includes("0"), problem.problemText).toBe(true);
    }
  });

  it("レベル 5: 10が なんこと 1が なんこ", () => {
    for (const problem of build("数のしくみ", 5)) {
      const [n] = numbersIn(problem.problemText);
      expect(problem.correctAnswer, problem.problemText).toBe(`${Math.floor(n / 10)}こと ${n % 10}こ`);
      expect(n % 10).toBeGreaterThan(0);
    }
  });
});

describe("数の大小", () => {
  it.each([1, 2, 3, 4, 5] as const)("レベル %i: 選択肢の4つの数の並びから、聞かれた順位の数が答え", (level) => {
    for (const problem of build("数の大小", level)) {
      const numbers = problem.choices!.map(Number);
      expect(new Set(numbers).size).toBe(4);
      const sorted = [...numbers].sort((a, b) => b - a);
      const asked = problem.problemText.includes("2ばんめ") ? 1 : problem.problemText.includes("小さい") ? 3 : 0;
      expect(Number(problem.correctAnswer), problem.problemText).toBe(sorted[asked]);
      expect(numbers.every((n) => (level <= 2 ? between(n, 100, 999) : between(n, 1000, 9999)))).toBe(true);
    }
  });

  it("レベル 4: 4つの数は同じすうじを ならべかえたもの", () => {
    for (const problem of build("数の大小", 4)) {
      const signatures = new Set(problem.choices!.map((choice) => [...choice].sort().join("")));
      expect(signatures.size).toBe(1);
    }
  });
});
