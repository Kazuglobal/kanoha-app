import { describe, expect, it } from "vitest";
import { refOf, validatedGenerate } from "@/lib/generation/helpers";
import { findGenerator, parseRef } from "@/lib/generation/registry";
import type { GenerateInput, GeneratedProblem } from "@/lib/generation/types";
import { validateGenerated } from "@/lib/generation/validate";

const REAL = findGenerator("たし算", "くり上がり")!;
const input = (seed: string): GenerateInput => ({ unit: REAL.unit, subUnit: REAL.subUnit, level: 2, seed });

/** 「#」の付いた seed(= やりなおし)のときだけ、本物の生成器で問題をつくる。 */
const failsFirst = (input: GenerateInput): GeneratedProblem => {
  if (!input.seed.includes("#")) throw new RangeError("1 回目はつくれない");
  return REAL.generateOnce(input);
};

describe("refOf: 長い seed のたたみかた", () => {
  it("64 文字までの seed はそのまま入る", () => {
    const seed = "a".repeat(64);
    expect(refOf(input(seed))).toBe(`たし算/くり上がり/L2/${seed}`);
  });

  it("64 文字をこえる seed は短くたたまれ、ref は 200 文字におさまる", () => {
    const ref = refOf(input("b".repeat(500)));
    expect(ref).toMatch(/^たし算\/くり上がり\/L2\/~[0-9a-z]+$/);
    expect(ref.length).toBeLessThan(200);
  });
});

describe("validatedGenerate: 検査とやりなおし", () => {
  it("1 回目がつくれなくても、seed に「#1」を足してやりなおし、ref は元の入力のものにそろえる", () => {
    const generate = validatedGenerate(failsFirst);
    const problem = generate(input("retry-me"));
    expect(problem.ref).toBe(refOf(input("retry-me")));
    expect(problem.problemText).toBe(REAL.generateOnce(input("retry-me#1")).problemText);
  });

  it("検査に通らない問題(ヒントに答えが入っている)は、やりなおして通るものを返す", () => {
    const generate = validatedGenerate((current) => {
      const problem = REAL.generateOnce(current);
      return current.seed.includes("#") ? problem : { ...problem, hints: { ...problem.hints, hint1: `こたえは ${problem.correctAnswer} だよ` } };
    });
    const problem = generate(input("leaky"));
    expect(validateGenerated(problem)).toEqual({ ok: true, issues: [] });
  });

  it("やりなおした問題も、保存した ref から同じ問題をつくりなおせる", () => {
    const generate = validatedGenerate(failsFirst);
    const original = generate(input("regen"));
    const parsed = parseRef(original.ref);
    expect(parsed).not.toBeNull();
    expect(generate(parsed!)).toEqual(original);
  });

  it("長い seed でやりなおしたときも、ref から同じ問題をつくりなおせる", () => {
    const generate = validatedGenerate(failsFirst);
    const longSeed = `child-0123456789abcdef-0123456789abcdef:2026-10-29:math:3:4~dup2:${"x".repeat(40)}`;
    expect(longSeed.length).toBeGreaterThan(64);
    const original = generate(input(longSeed));
    const parsed = parseRef(original.ref);
    expect(parsed).not.toBeNull();
    expect(generate(parsed!)).toEqual(original);
  });

  it("RangeError 以外のエラー(作りまちがい)は、やりなおさずそのまま投げる", () => {
    const generate = validatedGenerate(() => {
      throw new TypeError("作りまちがい");
    });
    expect(() => generate(input("x"))).toThrow(TypeError);
  });

  it("どの回も作れなければ RangeError", () => {
    const generate = validatedGenerate(() => {
      throw new RangeError("いつもつくれない");
    });
    expect(() => generate(input("x"))).toThrow(RangeError);
  });
});
