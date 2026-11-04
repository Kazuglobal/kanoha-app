import "server-only";
import { LEVELS, type Level } from "@/lib/learning/level";
import { generateBatch, problemKey } from "./batch";
import type { PlanItem } from "./plan";
import { generateProblem, hasGenerator, parseRef } from "./registry";
import type { GeneratedProblem } from "./types";

/** 類題は 5 問(4/5 で「できた」)。 */
export const SIMILAR_SET_SIZE = 5;
/** 元のレベルで 5 問そろわないときの足し分(となりのレベルから、1 レベルにつき この数まで)。 */
const EXTRA_PER_NEIGHBOR_LEVEL = 2;

type GeneratedItem = Extract<PlanItem, { kind: "generated" }>;

const itemOf = (unit: string, subUnit: string, level: Level, seed: string): GeneratedItem => ({ kind: "generated", reason: "practice", unit, subUnit, level, seed });

/** となりのレベル(近い順)。 */
const neighborLevels = (level: Level): Level[] => LEVELS.filter((other) => other !== level).sort((a, b) => Math.abs(a - level) - Math.abs(b - level) || a - b);

/**
 * 生成した問題(手がかり ref が残っている問題)の類題 5 問。AI を使わず、同じ生成器で作る。
 * 元の問題の id から seed を決めるので、同じ問題の類題はいつも同じ。元の問題と同じ問題は入れない。
 * 元のレベルで 5 問そろわないとき(問題の数が少ない小単元)だけ、となりのレベルから足す。
 * 手がかりが読めない・生成器がない・5 問そろわないときは null。
 */
export function generateSimilarSet(source: { id: string; ref: string }): GeneratedProblem[] | null {
  const parsed = parseRef(source.ref);
  if (!parsed || !hasGenerator(parsed.unit, parsed.subUnit)) return null;
  const { unit, subUnit, level } = parsed;
  try {
    const original = problemKey(generateProblem(parsed));
    const plan = [
      ...Array.from({ length: SIMILAR_SET_SIZE }, (_, index) => itemOf(unit, subUnit, level, `${source.id}:sim:${index}`)),
      ...neighborLevels(level).flatMap((near) =>
        Array.from({ length: EXTRA_PER_NEIGHBOR_LEVEL }, (_, index) => itemOf(unit, subUnit, near, `${source.id}:sim:L${near}:${index}`)),
      ),
    ];
    const problems = generateBatch(plan).flatMap((entry) => (entry.kind === "generated" && problemKey(entry.problem) !== original ? [entry.problem] : []));
    return problems.length >= SIMILAR_SET_SIZE ? problems.slice(0, SIMILAR_SET_SIZE) : null;
  } catch (error) {
    if (error instanceof RangeError) return null;
    throw error;
  }
}
