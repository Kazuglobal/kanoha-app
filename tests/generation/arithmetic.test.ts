import { describe, expect, it } from "vitest";
import { ADDITION_GENERATORS } from "@/lib/generation/generators/math/addition";
import { SUBTRACTION_GENERATORS } from "@/lib/generation/generators/math/subtraction";
import type { GeneratedProblem, GeneratorEntry } from "@/lib/generation/types";
import { validateGenerated } from "@/lib/generation/validate";
import { LEVELS, type Level } from "@/lib/learning/level";

const SEEDS = Array.from({ length: 60 }, (_, index) => `t${index}`);

/** 実装とは別に、筆算を桁の配列で数えなおす(oracle)。 */
const digits = (n: number): number[] => [...String(n)].reverse().map(Number);
const at = (n: number, place: number): number => digits(n)[place] ?? 0;

interface Flags {
  ones: boolean;
  tens: boolean;
  hundreds: boolean;
}

function carryFlags(a: number, b: number): Flags {
  const out = { ones: false, tens: false, hundreds: false };
  let carry = 0;
  (["ones", "tens", "hundreds"] as const).forEach((key, place) => {
    const total = at(a, place) + at(b, place) + carry;
    out[key] = total >= 10;
    carry = total >= 10 ? 1 : 0;
  });
  return out;
}

function borrowFlags(a: number, b: number): Flags {
  const out = { ones: false, tens: false, hundreds: false };
  let lent = 0;
  (["ones", "tens", "hundreds"] as const).forEach((key, place) => {
    const here = at(a, place) - lent;
    out[key] = here < at(b, place);
    lent = out[key] ? 1 : 0;
  });
  return out;
}

const numbersIn = (text: string): number[] => (text.normalize("NFKC").match(/\d+/g) ?? []).map(Number);
const answerNumber = (problem: GeneratedProblem): number => Number(problem.correctAnswer.match(/\d+/)![0]);
const between = (n: number, min: number, max: number): boolean => n >= min && n <= max;

type Form = "plain" | "three" | "missing" | "story" | "startStory";
interface Operands {
  a: number;
  b: number;
  c?: number;
  total: number;
}

/** 問題文と答えから、たす(ひく)数を取り出し、答えが正しいかも確かめる。正しくなければ null。 */
function addOperands(form: Form, problem: GeneratedProblem): Operands | null {
  const nums = numbersIn(problem.problemText);
  const answer = answerNumber(problem);
  if (form === "three") {
    return nums.length === 3 && nums[0] + nums[1] + nums[2] === answer ? { a: nums[0], b: nums[1], c: nums[2], total: answer } : null;
  }
  if (form === "missing" || form === "startStory") {
    const [known, total] = nums;
    return nums.length === 2 && known + answer === total ? { a: answer, b: known, total } : null;
  }
  return nums.length === 2 && nums[0] + nums[1] === answer ? { a: nums[0], b: nums[1], total: answer } : null;
}

function subOperands(form: Form, problem: GeneratedProblem): Operands | null {
  const text = problem.problemText.normalize("NFKC");
  const nums = numbersIn(text);
  const answer = answerNumber(problem);
  if (form === "missing") {
    if (nums.length !== 2) return null;
    const [known, rest] = nums;
    const unknownFirst = text.indexOf("□") < text.indexOf("-");
    const [a, b] = unknownFirst ? [answer, known] : [known, answer];
    return a - b === rest ? { a, b, total: rest } : null;
  }
  if (form === "startStory") {
    const [given, rest] = nums;
    return nums.length === 2 && answer - given === rest ? { a: answer, b: given, total: rest } : null;
  }
  return nums.length === 2 && nums[0] - nums[1] === answer ? { a: nums[0], b: nums[1], total: answer } : null;
}

interface Row {
  form: Form;
  ok: (operands: Operands) => boolean;
}

const none = (f: Flags) => !f.ones && !f.tens && !f.hundreds;
const sum = (o: Operands) => o.a + o.b;

const ADD_ROWS: Record<string, Record<Level, Row>> = {
  "2けたのたし算": {
    1: { form: "plain", ok: (o) => between(o.a, 11, 89) && between(o.b, 1, 9) && none(carryFlags(o.a, o.b)) && sum(o) < 100 },
    2: { form: "plain", ok: (o) => between(o.a, 11, 88) && between(o.b, 11, 88) && none(carryFlags(o.a, o.b)) && sum(o) < 100 },
    3: { form: "plain", ok: (o) => between(o.a, 11, 88) && between(o.b, 11, 88) && carryFlags(o.a, o.b).ones && !carryFlags(o.a, o.b).tens && sum(o) < 100 },
    4: { form: "plain", ok: (o) => between(o.a, 30, 88) && between(o.b, 30, 88) && carryFlags(o.a, o.b).ones && between(sum(o), 60, 99) },
    5: { form: "missing", ok: (o) => between(o.a, 11, 88) && between(o.b, 11, 88) && carryFlags(o.a, o.b).ones && o.total < 100 },
  },
  "くり上がり": {
    1: { form: "plain", ok: (o) => between(o.a, 11, 89) && between(o.b, 2, 9) && carryFlags(o.a, o.b).ones && sum(o) < 100 },
    2: { form: "plain", ok: (o) => between(o.a, 11, 88) && between(o.b, 11, 88) && carryFlags(o.a, o.b).ones && !carryFlags(o.a, o.b).tens && sum(o) < 100 },
    3: { form: "plain", ok: (o) => between(o.a, 11, 99) && between(o.b, 11, 99) && carryFlags(o.a, o.b).ones && carryFlags(o.a, o.b).tens && between(sum(o), 100, 199) },
    4: { form: "plain", ok: (o) => between(o.a, 50, 99) && between(o.b, 50, 99) && carryFlags(o.a, o.b).ones && carryFlags(o.a, o.b).tens },
    5: { form: "plain", ok: (o) => between(o.a, 100, 899) && between(o.b, 11, 99) && carryFlags(o.a, o.b).ones },
  },
  "3けたになるたし算": {
    1: { form: "plain", ok: (o) => o.a % 10 === 0 && o.b % 10 === 0 && between(o.a, 50, 90) && between(o.b, 50, 90) && sum(o) >= 100 },
    2: { form: "plain", ok: (o) => between(o.a, 51, 99) && between(o.b, 51, 99) && carryFlags(o.a, o.b).tens && !carryFlags(o.a, o.b).ones && between(sum(o), 100, 199) },
    3: { form: "plain", ok: (o) => between(o.a, 51, 99) && between(o.b, 51, 99) && carryFlags(o.a, o.b).ones && carryFlags(o.a, o.b).tens },
    4: { form: "plain", ok: (o) => between(o.a, 100, 899) && between(o.b, 11, 99) && sum(o) < 1000 },
    5: { form: "plain", ok: (o) => between(o.a, 101, 899) && between(o.b, 101, 899) && sum(o) < 1000 },
  },
  "計算のくふう": {
    1: { form: "plain", ok: (o) => between(o.a, 2, 9) && between(o.b, 2, 9) && between(sum(o), 11, 18) },
    2: { form: "plain", ok: (o) => (o.a === 9 || o.b === 9) && between(o.a, 3, 9) && between(o.b, 3, 9) },
    3: { form: "three", ok: (o) => o.a + o.c! === 10 && between(o.b, 2, 9) && between(o.a, 1, 9) },
    4: { form: "plain", ok: (o) => between(o.a, 20, 88) && between(o.b, 20, 88) && carryFlags(o.a, o.b).ones && sum(o) < 100 },
    5: { form: "three", ok: (o) => (o.a % 10) + (o.c! % 10) === 10 && [o.a, o.b, o.c!].every((n) => between(n, 11, 49)) },
  },
  "たし算の文章題": {
    1: { form: "story", ok: (o) => between(o.a, 2, 9) && between(o.b, 2, 9) && sum(o) <= 18 },
    2: { form: "story", ok: (o) => between(o.a, 11, 89) && between(o.b, 2, 9) },
    3: { form: "story", ok: (o) => between(o.a, 11, 88) && between(o.b, 11, 88) && sum(o) < 100 },
    4: { form: "story", ok: (o) => between(o.a, 30, 99) && between(o.b, 30, 99) && between(sum(o), 100, 199) },
    5: { form: "startStory", ok: (o) => between(o.a, 11, 89) && between(o.b, 11, 89) && o.total < 100 },
  },
};

const SUB_ROWS: Record<string, Record<Level, Row>> = {
  "2けたのひき算": {
    1: { form: "plain", ok: (o) => between(o.a, 20, 99) && between(o.b, 1, 9) && none(borrowFlags(o.a, o.b)) },
    2: { form: "plain", ok: (o) => between(o.a, 21, 99) && between(o.b, 11, o.a - 1) && none(borrowFlags(o.a, o.b)) },
    3: { form: "plain", ok: (o) => between(o.a, 11, 99) && between(o.b, 11, 99) && o.a > o.b && borrowFlags(o.a, o.b).ones && !borrowFlags(o.a, o.b).tens },
    4: { form: "plain", ok: (o) => between(o.a, 50, 99) && between(o.b, 30, o.a - 1) && borrowFlags(o.a, o.b).ones && !borrowFlags(o.a, o.b).tens },
    5: { form: "missing", ok: (o) => between(o.a, 11, 99) && between(o.b, 11, 99) && o.a > o.b && borrowFlags(o.a, o.b).ones },
  },
  "くり下がり": {
    1: { form: "plain", ok: (o) => between(o.a, 11, 18) && between(o.b, 2, 9) && borrowFlags(o.a, o.b).ones },
    2: { form: "plain", ok: (o) => between(o.a, 21, 99) && between(o.b, 2, 9) && borrowFlags(o.a, o.b).ones },
    3: { form: "plain", ok: (o) => between(o.a, 11, 99) && between(o.b, 11, 99) && o.a > o.b && borrowFlags(o.a, o.b).ones && !borrowFlags(o.a, o.b).tens },
    4: { form: "plain", ok: (o) => between(o.a, 60, 99) && between(o.b, 30, o.a - 1) && borrowFlags(o.a, o.b).ones && !borrowFlags(o.a, o.b).tens },
    5: { form: "plain", ok: (o) => between(o.a, 100, 300) && between(o.b, 11, 99) && borrowFlags(o.a, o.b).ones && !borrowFlags(o.a, o.b).tens && !borrowFlags(o.a, o.b).hundreds },
  },
  "百の位からのくり下がり": {
    1: { form: "plain", ok: (o) => o.a === 100 && between(o.b, 1, 99) },
    2: { form: "plain", ok: (o) => between(o.a, 100, 199) && between(o.b, 11, 99) && borrowFlags(o.a, o.b).tens && !borrowFlags(o.a, o.b).ones },
    3: { form: "plain", ok: (o) => between(o.a, 100, 199) && between(o.b, 11, 99) && borrowFlags(o.a, o.b).tens && borrowFlags(o.a, o.b).ones },
    4: { form: "plain", ok: (o) => between(o.a, 200, 500) && o.a % 100 < 10 && between(o.b, 11, 99) && borrowFlags(o.a, o.b).tens },
    5: { form: "plain", ok: (o) => between(o.a, 200, 999) && between(o.b, 20, 199) && borrowFlags(o.a, o.b).tens },
  },
  "ひき算の文章題": {
    1: { form: "story", ok: (o) => between(o.a, 6, 18) && between(o.b, 2, 9) && o.a > o.b },
    2: { form: "story", ok: (o) => between(o.a, 21, 99) && between(o.b, 2, 9) },
    3: { form: "story", ok: (o) => between(o.a, 11, 99) && between(o.b, 11, 99) && o.a > o.b },
    4: { form: "story", ok: (o) => between(o.a, 100, 199) && between(o.b, 20, 99) },
    5: { form: "startStory", ok: (o) => between(o.b, 11, 60) && between(o.total, 11, 60) && o.a < 100 },
  },
};

function run(entries: readonly GeneratorEntry[], rows: Record<string, Record<Level, Row>>, operandsOf: (form: Form, p: GeneratedProblem) => Operands | null) {
  describe.each(entries.map((entry) => [entry.subUnit, entry] as const))("%s", (subUnit, entry) => {
    it("単元・教科・5 つのレベルの説明がそろっている", () => {
      expect(entry.subject).toBe("math");
      expect(Object.keys(entry.levels).sort()).toEqual(["1", "2", "3", "4", "5"]);
      for (const level of LEVELS) expect(entry.levels[level].length).toBeGreaterThan(4);
      expect(rows[subUnit]).toBeDefined();
    });

    it.each(LEVELS)("レベル %i: 答えが正しく、決めたレベルの条件に合い、検査を通る(60 通り)", (level) => {
      const row = rows[subUnit][level];
      const seen = new Set<string>();
      for (const seed of SEEDS) {
        const problem = entry.generate({ unit: entry.unit, subUnit, level, seed });
        expect(validateGenerated(problem), problem.problemText).toEqual({ ok: true, issues: [] });
        const operands = operandsOf(row.form, problem);
        expect(operands, `答えが合わない: ${problem.problemText} → ${problem.correctAnswer}`).not.toBeNull();
        expect(row.ok(operands!), `レベル ${level} の条件に合わない: ${problem.problemText} → ${problem.correctAnswer}`).toBe(true);
        expect(problem.level).toBe(level);
        expect(problem.choices).toBeUndefined();
        seen.add(problem.problemText);
      }
      // 「9 + n」(n は 3〜9、前後入れかえて最大 14 通り)のように、問題の数がもともと少ないレベルは基準を下げる
      const smallSpace = subUnit === "計算のくふう" && level === 2;
      expect(seen.size).toBeGreaterThanOrEqual(smallSpace ? 10 : 20);
    });

    it("同じ入力なら同じ問題、seed が変われば別の問題", () => {
      const input = { unit: entry.unit, subUnit, level: 3 as Level, seed: "same" };
      expect(entry.generate(input)).toEqual(entry.generate(input));
      expect(entry.generate({ ...input, seed: "other" })).not.toEqual(entry.generate(input));
    });
  });
}

describe("たし算の生成器", () => {
  it("小単元がそろっている", () => {
    expect(ADDITION_GENERATORS.map((entry) => entry.subUnit)).toEqual(Object.keys(ADD_ROWS));
    expect(new Set(ADDITION_GENERATORS.map((entry) => entry.unit))).toEqual(new Set(["たし算"]));
  });
  run(ADDITION_GENERATORS, ADD_ROWS, addOperands);
});

describe("ひき算の生成器", () => {
  it("小単元がそろっている", () => {
    expect(SUBTRACTION_GENERATORS.map((entry) => entry.subUnit)).toEqual(Object.keys(SUB_ROWS));
    expect(new Set(SUBTRACTION_GENERATORS.map((entry) => entry.unit))).toEqual(new Set(["ひき算"]));
  });
  run(SUBTRACTION_GENERATORS, SUB_ROWS, subOperands);
});
