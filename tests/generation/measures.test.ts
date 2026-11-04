import { describe, expect, it } from "vitest";
import { LENGTH_GENERATORS, VOLUME_GENERATORS } from "@/lib/generation/generators/math/measures";
import type { Level } from "@/lib/learning/level";
import { describeBasics, generateAt } from "./support";

const ALL = [...LENGTH_GENERATORS, ...VOLUME_GENERATORS];
const byName = (subUnit: string) => ALL.find((entry) => entry.subUnit === subUnit)!;

/** 単位の関係(1 big = factor small)。実装とは別に、ここで持つ。 */
const FACTORS: Readonly<Record<string, number>> = { "cm/mm": 10, "m/cm": 100, "L/dL": 10, "L/mL": 1000 };

/** 「3cm5mm」「2L3dL」を 小さい単位に直した数にする。 */
function toSmall(text: string): { value: number; big: string; small: string } {
  const match = /^(\d+)(cm|m|L)(\d+)(mm|cm|dL|mL)$/.exec(text);
  if (!match) throw new Error(`not a compound measure: ${text}`);
  const [, bigPart, big, smallPart, small] = match;
  const factor = FACTORS[`${big}/${small}`];
  if (!factor) throw new Error(`unknown pair ${big}/${small}`);
  return { value: Number(bigPart) * factor + Number(smallPart), big, small };
}

describe("長さ・かさの生成器", () => {
  it("小単元がそろっている", () => {
    expect(LENGTH_GENERATORS.map((entry) => entry.subUnit)).toEqual(["cmとmm", "mとcm", "長さのたし算とひき算"]);
    expect(VOLUME_GENERATORS.map((entry) => entry.subUnit)).toEqual(["LとdL", "LとmL", "かさのたし算とひき算"]);
    expect(new Set(LENGTH_GENERATORS.map((entry) => entry.unit))).toEqual(new Set(["長さ"]));
    expect(new Set(VOLUME_GENERATORS.map((entry) => entry.unit))).toEqual(new Set(["水のかさ"]));
  });
});

const CHOICE_LEVELS: Record<string, readonly Level[]> = {
  conversion: [3, 4],
  arithmetic: [2, 3, 4, 5],
};
for (const name of ["cmとmm", "mとcm", "LとdL", "LとmL"]) {
  describeBasics([byName(name)], { choiceLevels: CHOICE_LEVELS.conversion, minVariety: (level) => (level === 1 ? 6 : 15) });
}
for (const name of ["長さのたし算とひき算", "かさのたし算とひき算"]) {
  describeBasics([byName(name)], { choiceLevels: CHOICE_LEVELS.arithmetic, minVariety: () => 15 });
}

const CONVERSIONS = [
  ["cmとmm", "cm", "mm"],
  ["mとcm", "m", "cm"],
  ["LとdL", "L", "dL"],
  ["LとmL", "L", "mL"],
] as const;

describe.each(CONVERSIONS)("単位の読みかえ: %s", (subUnit, big, small) => {
  const factor = FACTORS[`${big}/${small}`];

  it(`レベル 1: n${big} は n × ${factor}${small}`, () => {
    for (const problem of generateAt(byName(subUnit), 1)) {
      const match = new RegExp(`^(\\d+)${big} は なん${small} ですか`).exec(problem.problemText);
      expect(match, problem.problemText).not.toBeNull();
      const n = Number(match![1]);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(problem.correctAnswer).toBe(`${n * factor}${small}`);
      expect(problem.choices).toBeUndefined();
    }
  });

  it.each([2, 5] as const)(`レベル %i: ${big}と${small} → ${small} の足し合わせが合う`, (level) => {
    for (const problem of generateAt(byName(subUnit), level)) {
      const match = new RegExp(`^(\\d+${big}\\d+${small}) は ぜんぶで なん${small} ですか`).exec(problem.problemText);
      expect(match, problem.problemText).not.toBeNull();
      expect(`${toSmall(match![1]).value}${small}`).toBe(problem.correctAnswer);
      expect(problem.choices).toBeUndefined();
    }
  });

  it.each([3, 4] as const)(`レベル %i: ${small} → ${big}と${small} の答えが合い、4 つの選択肢のなかで 1 つだけ`, (level) => {
    for (const problem of generateAt(byName(subUnit), level)) {
      const match = new RegExp(`^(\\d+)${small} は なん${big}なん${small} ですか`).exec(problem.problemText);
      expect(match, problem.problemText).not.toBeNull();
      const n = Number(match![1]);
      const expected = `${Math.floor(n / factor)}${big}${n % factor}${small}`;
      expect(n % factor, problem.problemText).toBeGreaterThan(0);
      expect(problem.correctAnswer).toBe(expected);
      expect(problem.choices).toContain(expected);
      expect(problem.choices!.filter((choice) => toSmall(choice).value === n)).toHaveLength(1);
    }
  });
});

describe("長さ・かさのたし算とひき算", () => {
  const PAIRS = [
    { subUnit: "長さのたし算とひき算", bigs: ["cm", "m"] },
    { subUnit: "かさのたし算とひき算", bigs: ["L"] },
  ];

  it.each(PAIRS)("$subUnit レベル 1: おなじ単位の足し算", ({ subUnit, bigs }) => {
    for (const problem of generateAt(byName(subUnit), 1)) {
      const match = /^(\d+)(cm|m|L) \+ (\d+)(cm|m|L) は いくつですか/.exec(problem.problemText);
      expect(match, problem.problemText).not.toBeNull();
      expect(bigs).toContain(match![2]);
      expect(match![4]).toBe(match![2]);
      expect(problem.correctAnswer).toBe(`${Number(match![1]) + Number(match![3])}${match![2]}`);
    }
  });

  it.each(PAIRS)("$subUnit レベル 2・3: 足し算の答えが合い、レベル 3 だけくり上がる", ({ subUnit }) => {
    for (const level of [2, 3] as const) {
      for (const problem of generateAt(byName(subUnit), level)) {
        const match = /^(\S+) \+ (\S+) は いくつですか/.exec(problem.problemText);
        expect(match, problem.problemText).not.toBeNull();
        const first = toSmall(match![1]);
        const second = toSmall(match![2]);
        expect(`${first.value + second.value}`, problem.problemText).toBe(`${toSmall(problem.correctAnswer).value}`);
        const factor = FACTORS[`${first.big}/${first.small}`];
        const smallSum = (first.value % factor) + (second.value % factor);
        expect(smallSum >= factor, problem.problemText).toBe(level === 3);
        expect(problem.choices!.filter((choice) => toSmall(choice).value === first.value + second.value)).toHaveLength(1);
      }
    }
  });

  it.each(PAIRS)("$subUnit レベル 4・5: 引き算の答えが合い、レベル 5 だけくり下がる", ({ subUnit }) => {
    for (const level of [4, 5] as const) {
      for (const problem of generateAt(byName(subUnit), level)) {
        const match = /^(\S+) - (\S+) は いくつですか/.exec(problem.problemText);
        expect(match, problem.problemText).not.toBeNull();
        const first = toSmall(match![1]);
        const second = toSmall(match![2]);
        expect(first.value - second.value, problem.problemText).toBeGreaterThan(0);
        expect(toSmall(problem.correctAnswer).value).toBe(first.value - second.value);
        const factor = FACTORS[`${first.big}/${first.small}`];
        expect(first.value % factor < second.value % factor, problem.problemText).toBe(level === 5);
        expect(problem.choices!.filter((choice) => toSmall(choice).value === first.value - second.value)).toHaveLength(1);
      }
    }
  });
});
