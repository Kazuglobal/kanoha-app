import { describe, expect, it } from "vitest";
import type { GeneratedProblem, GeneratorEntry } from "@/lib/generation/types";
import { validateGenerated } from "@/lib/generation/validate";
import { LEVELS, type Level } from "@/lib/learning/level";

/** 生成器のテストで使う seed(60 通り)。 */
export const SEEDS = Array.from({ length: 60 }, (_, index) => `t${index}`);

export const numbersIn = (text: string): number[] => (text.normalize("NFKC").match(/\d+/g) ?? []).map(Number);
export const answerNumber = (problem: GeneratedProblem): number => Number(problem.correctAnswer.match(/\d+/)![0]);
export const between = (n: number, min: number, max: number): boolean => n >= min && n <= max;

export const generateAt = (entry: GeneratorEntry, level: Level, seeds: readonly string[] = SEEDS): GeneratedProblem[] =>
  seeds.map((seed) => entry.generate({ unit: entry.unit, subUnit: entry.subUnit, level, seed }));

export interface BasicsOptions {
  /** 60 通りの seed で最低いくつの別の問題が出るか(問題の数がもともと少ないレベルは下げる) */
  readonly minVariety?: (level: Level) => number;
  /** 4 択にするレベル(それ以外は選択肢なし) */
  readonly choiceLevels?: readonly Level[];
}

/** どの生成器にも共通する性質: 説明がそろう・検査を通る・決定的・seed で変わる・選択肢の有無。 */
export function describeBasics(entries: readonly GeneratorEntry[], options: BasicsOptions = {}): void {
  describe.each(entries.map((entry) => [`${entry.unit} / ${entry.subUnit}`, entry] as const))("基本の性質: %s", (_name, entry) => {
    it("5 つのレベルの説明がそろっている", () => {
      expect(Object.keys(entry.levels).sort()).toEqual(["1", "2", "3", "4", "5"]);
      for (const level of LEVELS) expect(entry.levels[level].length).toBeGreaterThan(4);
    });

    it.each(LEVELS)("レベル %i: 60 通りがすべて検査を通り、レベルと ref が合う", (level) => {
      const problems = generateAt(entry, level);
      // やりなおしに頼らず、1 回目の生成がそのまま検査を通る(作りそこないがない)
      for (const seed of SEEDS) {
        const once = entry.generateOnce({ unit: entry.unit, subUnit: entry.subUnit, level, seed });
        expect(validateGenerated(once), once.problemText).toEqual({ ok: true, issues: [] });
      }
      for (const problem of problems) {
        expect(validateGenerated(problem), problem.problemText).toEqual({ ok: true, issues: [] });
        expect(problem.level).toBe(level);
        expect(problem.unit).toBe(entry.unit);
        expect(problem.subUnit).toBe(entry.subUnit);
        expect(problem.ref).toBe(`${entry.unit}/${entry.subUnit}/L${level}/${problem.ref.split("/").pop()}`);
        if (options.choiceLevels) expect(problem.choices !== undefined).toBe(options.choiceLevels.includes(level));
      }
      const minVariety = options.minVariety?.(level) ?? 20;
      // 問題文が同じでも、選択肢の顔ぶれがちがえば別の問題(数の大小など)。並びかえただけでは別の問題に数えない
      const fingerprint = (problem: GeneratedProblem) => JSON.stringify([problem.problemText, problem.listenText ?? "", [...(problem.choices ?? [])].sort()]);
      expect(new Set(problems.map(fingerprint)).size).toBeGreaterThanOrEqual(minVariety);
    });

    it("同じ入力なら同じ問題、seed が変われば別の問題", () => {
      const input = { unit: entry.unit, subUnit: entry.subUnit, level: 3 as Level, seed: "same" };
      expect(entry.generate(input)).toEqual(entry.generate(input));
      expect(entry.generate({ ...input, seed: "other" })).not.toEqual(entry.generate(input));
    });
  });
}
