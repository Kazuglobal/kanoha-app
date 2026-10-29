import { describe, expect, it } from "vitest";
import { MULTIPLICATION_GENERATORS } from "@/lib/generation/generators/math/multiplication";
import { LEVELS, type Level } from "@/lib/learning/level";
import { answerNumber, between, describeBasics, generateAt, numbersIn } from "./support";

const byName = (subUnit: string) => MULTIPLICATION_GENERATORS.find((entry) => entry.subUnit === subUnit)!;
const repeated = (n: number, times: number) => Array(times).fill(n).join(" + ");

describe("かけ算の生成器", () => {
  it("小単元がそろっている", () => {
    expect(MULTIPLICATION_GENERATORS.map((entry) => entry.subUnit)).toEqual(["かけ算の意味", "九九", "かけ算の文章題"]);
    expect(new Set(MULTIPLICATION_GENERATORS.map((entry) => entry.unit))).toEqual(new Set(["かけ算"]));
  });
});

// 九九のレベル 2・3 は、だんが 2 つで 16 通りしかない
describeBasics([byName("九九")], { choiceLevels: [], minVariety: (level) => (level === 2 || level === 3 ? 12 : 20) });
// 意味のレベル 3 は、(a, b) の組が 9 通りしかない
describeBasics([byName("かけ算の意味")], { choiceLevels: [...LEVELS], minVariety: (level) => (level === 3 ? 7 : 20) });
describeBasics([byName("かけ算の文章題")], { choiceLevels: [] });

describe("九九: 答えとだんの範囲", () => {
  const dans: Record<1 | 2 | 3, readonly [number, number]> = { 1: [2, 5], 2: [6, 7], 3: [8, 9] };

  it.each([1, 2, 3] as const)("レベル %i: a × b の答えが合い、だんが決めた範囲にある", (level) => {
    for (const problem of generateAt(byName("九九"), level)) {
      const [a, b] = numbersIn(problem.problemText);
      expect(a * b, problem.problemText).toBe(answerNumber(problem));
      expect(between(a, ...dans[level]), problem.problemText).toBe(true);
      expect(between(b, 2, 9)).toBe(true);
    }
  });

  it("レベル 4: 2〜9 のだんがまざる", () => {
    const problems = generateAt(byName("九九"), 4);
    const seen = new Set(problems.map((problem) => numbersIn(problem.problemText)[0]));
    expect(seen.size).toBeGreaterThanOrEqual(5);
    for (const problem of problems) {
      const [a, b] = numbersIn(problem.problemText);
      expect(a * b).toBe(answerNumber(problem));
    }
  });

  it("レベル 5: □に はいる数(かける数)が合い、答えが問題文に出ない", () => {
    for (const problem of generateAt(byName("九九"), 5)) {
      const [a, product] = numbersIn(problem.problemText);
      const b = answerNumber(problem);
      expect(a * b, problem.problemText).toBe(product);
      expect(b).not.toBe(a);
      expect(between(b, 2, 9)).toBe(true);
    }
  });
});

describe("かけ算の意味: しきの選択肢", () => {
  it.each([1, 2] as const)("レベル %i: お話の ひとつぶん × いくつぶん が答えで、順序を入れかえた式は選択肢にない", (level) => {
    for (const problem of generateAt(byName("かけ算の意味"), level)) {
      const [, a, b] = numbersIn(problem.problemText);
      expect(problem.correctAnswer).toBe(`${a} × ${b}`);
      expect(problem.choices).not.toContain(`${b} × ${a}`);
      expect(a).not.toBe(b);
    }
  });

  it.each([3, 4] as const)("レベル %i: かけ算 → たし算の式が答え(かける数ぶんだけ並ぶ)", (level) => {
    for (const problem of generateAt(byName("かけ算の意味"), level)) {
      const [a, b] = numbersIn(problem.problemText);
      expect(problem.correctAnswer).toBe(repeated(a, b));
      expect(problem.choices).not.toContain(repeated(b, a));
    }
  });

  it("レベル 5: たし算 → かけ算のしき(並んだ数 × 並んだ個数)", () => {
    for (const problem of generateAt(byName("かけ算の意味"), 5)) {
      const nums = numbersIn(problem.problemText);
      expect(new Set(nums).size).toBe(1);
      expect(problem.correctAnswer).toBe(`${nums[0]} × ${nums.length}`);
      expect(problem.choices).not.toContain(`${nums.length} × ${nums[0]}`);
    }
  });
});

describe("かけ算の文章題: 答えと数の範囲", () => {
  const build = (level: Level) => generateAt(byName("かけ算の文章題"), level);

  it.each([1, 2, 3] as const)("レベル %i: ひとつぶんの数 × いくつぶん", (level) => {
    for (const problem of build(level)) {
      const [a, b] = numbersIn(problem.problemText);
      expect(a * b, problem.problemText).toBe(answerNumber(problem));
      if (level === 1) expect(a <= 5 && b <= 5).toBe(true);
      if (level === 3) expect(a >= 6 && b >= 3).toBe(true);
    }
  });

  it("レベル 4: かけ算のあとに たし算", () => {
    for (const problem of build(4)) {
      const [a, b, extra] = numbersIn(problem.problemText);
      expect(a * b + extra, problem.problemText).toBe(answerNumber(problem));
    }
  });

  it("レベル 5: かけ算のあとに ひき算(のこりは正の数で、問題文に出る数と同じにならない)", () => {
    for (const problem of build(5)) {
      const nums = numbersIn(problem.problemText);
      const [a, b, used] = nums;
      const rest = answerNumber(problem);
      expect(a * b - used, problem.problemText).toBe(rest);
      expect(rest).toBeGreaterThan(0);
      expect(nums).not.toContain(rest);
    }
  });

  it("入れ物に入らないもの(ことり・くるま)は出ない", () => {
    for (const level of LEVELS) {
      for (const problem of build(level)) expect(problem.problemText).not.toMatch(/ことり|くるま/);
    }
  });
});
