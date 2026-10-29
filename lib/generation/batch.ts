import "server-only";
import type { PlanItem } from "./plan";
import { generateProblem } from "./registry";
import type { GenerateInput, GeneratedProblem } from "./types";

type GeneratedPlanItem = Extract<PlanItem, { kind: "generated" }>;
type BankPlanItem = Extract<PlanItem, { kind: "bank" }>;

export type BatchEntry =
  | { readonly kind: "generated"; readonly item: GeneratedPlanItem; readonly problem: GeneratedProblem }
  | { readonly kind: "bank"; readonly item: BankPlanItem }
  /** つくれなかった枠(生成器がない・かぶりをさけきれない)。呼ぶ側が、バンクの問題で代わりにする。 */
  | { readonly kind: "unavailable"; readonly item: GeneratedPlanItem };

type Generate = (input: GenerateInput) => GeneratedProblem;

/** 同じ問題かどうかの目印(問題文・聞く英語・答え。選択肢の並びや ref のちがいは見ない)。 */
export const problemKey = (problem: GeneratedProblem): string =>
  JSON.stringify([problem.problemText, problem.listenText ?? "", problem.correctAnswer]);

/** 同じセットで同じ問題になったとき、seed を変えてつくりなおす回数の上限。 */
const MAX_DUPLICATE_RETRIES = 8;

/** かぶらない問題がつくれるまで、seed に「~dup1」「~dup2」…を足す。作れないときは null(RangeError)。 */
function generateDistinct(item: GeneratedPlanItem, taken: ReadonlySet<string>, generate: Generate): GeneratedProblem | null {
  for (let attempt = 0; attempt <= MAX_DUPLICATE_RETRIES; attempt += 1) {
    const seed = attempt === 0 ? item.seed : `${item.seed}~dup${attempt}`;
    try {
      const problem = generate({ unit: item.unit, subUnit: item.subUnit, level: item.level, seed });
      if (!taken.has(problemKey(problem))) return problem;
    } catch (error) {
      if (error instanceof RangeError) return null;
      throw error;
    }
  }
  return null;
}

/**
 * 出題計画の「生成する枠」を問題にする。同じセットに同じ問題を 2 つ入れない(かぶったら seed を変えてつくりなおす)。
 * バンクの枠はそのまま返す。同じ入力なら同じ結果。generate は試験用に差しかえられる。
 */
export function generateBatch(items: readonly PlanItem[], generate: Generate = generateProblem): BatchEntry[] {
  const taken = new Set<string>();
  const entries: BatchEntry[] = [];
  for (const item of items) {
    if (item.kind === "bank") {
      entries.push({ kind: "bank", item });
      continue;
    }
    const problem = generateDistinct(item, taken, generate);
    if (problem) taken.add(problemKey(problem));
    entries.push(problem ? { kind: "generated", item, problem } : { kind: "unavailable", item });
  }
  return entries;
}
