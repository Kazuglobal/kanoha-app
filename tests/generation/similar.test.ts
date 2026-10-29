import { describe, expect, it } from "vitest";
import { problemKey } from "@/lib/generation/batch";
import { GENERATORS, generateProblem } from "@/lib/generation/registry";
import { generateSimilarSet } from "@/lib/generation/similar";
import { validateGenerated } from "@/lib/generation/validate";
import { LEVELS } from "@/lib/learning/level";

const sourceFor = (unit: string, subUnit: string, level: number, seed = "src") => {
  const problem = generateProblem({ unit, subUnit, level: level as 1 | 2 | 3 | 4 | 5, seed });
  return { id: `problem-${seed}`, ref: problem.ref };
};

describe("generateSimilarSet: 生成した問題の類題 5 問(AI を使わない)", () => {
  it("同じ小単元で、きちんと 5 問。ぜんぶ ちがう問題で、検査を通る", () => {
    const set = generateSimilarSet(sourceFor("たし算", "くり上がり", 2));
    expect(set).toHaveLength(5);
    expect(new Set(set!.map(problemKey)).size).toBe(5);
    for (const problem of set!) {
      expect(problem).toMatchObject({ unit: "たし算", subUnit: "くり上がり" });
      expect(validateGenerated(problem)).toEqual({ ok: true, issues: [] });
    }
  });

  it("同じ入力なら同じ類題。元の問題が変われば 別の類題", () => {
    const source = sourceFor("かけ算", "九九", 3);
    expect(generateSimilarSet(source)).toEqual(generateSimilarSet(source));
    expect(generateSimilarSet({ ...source, id: "another" })).not.toEqual(generateSimilarSet(source));
  });

  it("元の問題そのものは 類題に入らない", () => {
    const source = sourceFor("ひき算", "くり下がり", 2, "me");
    const original = generateProblem({ unit: "ひき算", subUnit: "くり下がり", level: 2, seed: "me" });
    const keys = generateSimilarSet(source)!.map(problemKey);
    expect(keys).not.toContain(problemKey(original));
  });

  it("元の問題のレベルを中心に出す(足りないときだけ となりのレベルから足す)", () => {
    const set = generateSimilarSet(sourceFor("たし算", "2けたのたし算", 3))!;
    expect(set.filter((problem) => problem.level === 3).length).toBeGreaterThanOrEqual(4);
  });

  it("手がかり(ref)が読めない・生成器がない問題は null", () => {
    expect(generateSimilarSet({ id: "x", ref: "ないしょう/ない/L2/a" })).toBeNull();
    expect(generateSimilarSet({ id: "x", ref: "でたらめ" })).toBeNull();
    expect(generateSimilarSet({ id: "x", ref: "お話の読解/登場人物の気持ち/L2/a" })).toBeNull();
  });

  it("全生成器 × 全レベルで、5 問そろう(問題の数が少ない小単元でも)", () => {
    const failures: string[] = [];
    for (const entry of GENERATORS) {
      for (const level of LEVELS) {
        const source = sourceFor(entry.unit, entry.subUnit, level, `all${level}`);
        const set = generateSimilarSet(source);
        if (!set || set.length !== 5 || new Set(set.map(problemKey)).size !== 5) failures.push(`${entry.unit}/${entry.subUnit}/L${level}: ${set?.length ?? "null"}`);
      }
    }
    if (failures.length > 0) throw new Error(`5 問そろわない: ${failures.join(" | ")}`);
  });
});
