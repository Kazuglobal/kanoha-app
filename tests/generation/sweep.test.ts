import { describe, expect, it } from "vitest";
import { refOf } from "@/lib/generation/helpers";
import { GENERATORS, findGenerator, parseRef } from "@/lib/generation/registry";
import { validateGenerated } from "@/lib/generation/validate";
import { LEVELS } from "@/lib/learning/level";

/**
 * 1 回きりの生成(generateOnce)を広い範囲の seed で総当たりする。
 * ふだんの生成(generate)は、検査に通らない問題を つくりなおして隠してしまうので、
 * 「作りそこない」が増えていないかは、やりなおしなしの生成で調べる。
 */
const SWEEP_SEEDS = 300;

describe("全生成器 × レベル 1〜5 × 300 通りの seed(やりなおしなし)", () => {
  it("作りそこない(検査に通らない問題・作れない入力)が 1 つも出ない", () => {
    // 同じ問題文の失敗は 1 件にまとめる(最初の 1 件だけ、答えとヒントも出して原因をたどれるようにする)
    const failures = new Map<string, { count: number; detail: string }>();
    const record = (key: string, detail: string) => failures.set(key, { count: (failures.get(key)?.count ?? 0) + 1, detail: failures.get(key)?.detail ?? detail });
    for (const entry of GENERATORS) {
      for (const level of LEVELS) {
        for (let index = 0; index < SWEEP_SEEDS; index += 1) {
          const input = { unit: entry.unit, subUnit: entry.subUnit, level, seed: `sweep${index}` };
          try {
            const problem = entry.generateOnce(input);
            const result = validateGenerated(problem);
            if (!result.ok) {
              const { hint1, hint2 } = problem.hints;
              record(`${entry.unit}/${entry.subUnit}/L${level}: ${problem.problemText}`, `${result.issues.join(", ")} [answer=${problem.correctAnswer} hint1=${hint1} hint2=${hint2} ref=${problem.ref}]`);
            }
          } catch (error) {
            record(`${entry.unit}/${entry.subUnit}/L${level}: エラー`, `${error instanceof Error ? error.message : String(error)} [ref=${refOf(input)}]`);
          }
        }
      }
    }
    const summary = [...failures].map(([key, { count, detail }]) => `${key} ×${count} → ${detail}`);
    if (summary.length > 0) throw new Error(`作りそこないが ${summary.length} 種類: ${summary.slice(0, 8).join(" | ")}`);
  }, 180_000);

  it("やりなおしなしの総当たりで見つかった ref も、検査を通る(見つけた作りそこないの回帰テスト)", () => {
    const refs = [
      "ひき算/百の位からのくり下がり/L1/probe240",
      "時こくと時間/時間/L5/probe240",
      // 声(こえ)が「こえに だして」のヒントに出て答えを教えてしまった
      "漢字/漢字の読み/L3/sweep0",
      "漢字/漢字の読み/L5/sweep207",
      // 2 つの文に出てくる「かいた」を 2 回えらび、まちがいの選択肢が足りなくなった
      "文の組み立て/主語と述語/L1/sweep272",
      "文の組み立て/主語と述語/L2/sweep297",
    ];
    for (const ref of refs) {
      const input = parseRef(ref);
      const entry = input && findGenerator(input.unit, input.subUnit);
      expect(entry, ref).toBeTruthy();
      const problem = entry!.generateOnce(input!);
      expect(validateGenerated(problem), `${ref}: ${problem.problemText}`).toEqual({ ok: true, issues: [] });
    }
  });
});
