import { describe, expect, it } from "vitest";
import { FRACTION_GENERATORS } from "@/lib/generation/generators/math/fractions";
import { LEVELS } from "@/lib/learning/level";
import { describeBasics, generateAt } from "./support";

const byName = (subUnit: string) => FRACTION_GENERATORS.find((entry) => entry.subUnit === subUnit)!;
const WHOLE = "まるごと ひとつ";
const frac = (n: number) => `${n}ぶんの1`;

describe("分数の生成器", () => {
  it("小単元がそろっている", () => {
    expect(FRACTION_GENERATORS.map((entry) => entry.subUnit)).toEqual(["分けた大きさ", "2分の1", "4分の1", "8分の1"]);
    expect(new Set(FRACTION_GENERATORS.map((entry) => entry.unit))).toEqual(new Set(["分数"]));
  });
});

// ものの種類(5 通り)で問題文が変わる。1 つぶんの分母が決まっているレベルは、それ以上は増えない
for (const subUnit of ["分けた大きさ", "2分の1", "4分の1", "8分の1"]) {
  describeBasics([byName(subUnit)], { choiceLevels: [...LEVELS], minVariety: () => 5 });
}

/** 問題文だけから、正しい答えを求めなおす(実装とは別の計算)。分母は 2・4・8 のみ。 */
function expected(text: string): string {
  const combine = /(\d+)ぶんの1の おおきさを (\d+)つ あわせると/.exec(text);
  if (combine) {
    const [denominator, count] = [Number(combine[1]), Number(combine[2])];
    return count === denominator ? WHOLE : frac(denominator / count);
  }
  const halved = /(\d+)つに おなじ おおきさに わけて、その 1つぶんを、さらに/.exec(text);
  if (halved) return frac(Number(halved[1]) * 2);
  if (text.includes("つぶん ぜんぶ あつめると")) return WHOLE;
  const parts = [...text.matchAll(/(\d+)つに わけた 1つぶん/g)].map((match) => Number(match[1])).sort((a, b) => a - b);
  if (parts.length > 0) {
    if (text.includes("いちばん おおきい")) return frac(parts[0]);
    if (text.includes("いちばん ちいさい")) return frac(parts[parts.length - 1]);
    return frac(parts[Math.floor(parts.length / 2)]);
  }
  const split = /(\d+)つに おなじ おおきさに わけ/.exec(text);
  if (split) return frac(Number(split[1]));
  throw new Error(`unknown question: ${text}`);
}

describe("分数: 答えを問題文から求めなおす", () => {
  for (const entry of FRACTION_GENERATORS) {
    it.each(LEVELS)(`${entry.subUnit} レベル %i: 答えが合い、選択肢のなかで 1 つだけ`, (level) => {
      for (const problem of generateAt(entry, level)) {
        expect(problem.correctAnswer, problem.problemText).toBe(expected(problem.problemText));
        expect(problem.choices).toContain(problem.correctAnswer);
        expect(new Set(problem.choices).size).toBe(4);
      }
    });
  }

  it("2年生で習わない分母(3・6)は、答えにならない(まちがいの選択肢には出てよい)", () => {
    for (const entry of FRACTION_GENERATORS) {
      for (const level of LEVELS) {
        for (const problem of generateAt(entry, level)) expect(problem.correctAnswer).toMatch(/^(2ぶんの1|4ぶんの1|8ぶんの1|まるごと ひとつ)$/);
      }
    }
  });

  it("選択肢は ルビの要らない ひらがな(ぶんの)で書く", () => {
    for (const entry of FRACTION_GENERATORS) {
      for (const problem of generateAt(entry, 3)) {
        for (const choice of problem.choices!) expect(choice).not.toMatch(/\p{Script=Han}/u);
      }
    }
  });

  it("「もとの おおきさ」のような、何を指すかあいまいな言い方を使わない", () => {
    for (const entry of FRACTION_GENERATORS) {
      for (const level of LEVELS) {
        for (const problem of generateAt(entry, level)) {
          expect([problem.problemText, ...problem.choices!].join(" ")).not.toContain("もとの おおきさ");
        }
      }
    }
  });

  it("さらに わける問題は、ぜんたい(まるごと ひとつ)に対する 分数をたずねる", () => {
    for (const problem of generateAt(byName("4分の1"), 4)) {
      expect(problem.problemText).toContain("まるごと ひとつの なんぶんの いくつ");
      expect(problem.correctAnswer).toBe(frac(4));
    }
    for (const problem of generateAt(byName("8分の1"), 3)) expect(problem.correctAnswer).toBe(frac(8));
  });

  it("くらべる問題の選択肢は、名前を出した 1つぶんと「おなじ」だけ(2つくらべるときは 2ぶんの1 を足す)", () => {
    for (const problem of generateAt(byName("2分の1"), 5)) {
      expect(new Set(problem.choices)).toEqual(new Set([frac(2), frac(4), frac(8), "おなじ おおきさ"]));
    }
    for (const problem of generateAt(byName("8分の1"), 4)) {
      expect(new Set(problem.choices)).toEqual(new Set([frac(4), frac(8), frac(2), "おなじ おおきさ"]));
    }
  });

  it("レベル 1 は 1つぶんの分母が決まっている", () => {
    for (const problem of generateAt(byName("2分の1"), 1)) expect(problem.correctAnswer).toBe(frac(2));
    for (const problem of generateAt(byName("4分の1"), 1)) expect(problem.correctAnswer).toBe(frac(4));
    for (const problem of generateAt(byName("8分の1"), 1)) expect(problem.correctAnswer).toBe(frac(8));
  });

  it("同じ小単元でも、レベルごとに 問題の形がちがう(同じ問題が重ならない)", () => {
    // 「分けた大きさ」のレベル 1・2 は、同じ形でわける数の範囲だけがちがう
    for (const entry of FRACTION_GENERATORS.filter((candidate) => candidate.subUnit !== "分けた大きさ")) {
      const shapes = LEVELS.map((level) => generateAt(entry, level, ["a"])[0].problemText.replace(/ピザ|ケーキ|ホットケーキ|テープ|パン/g, "□"));
      expect(new Set(shapes).size, entry.subUnit).toBe(LEVELS.length);
    }
  });
});
