import { describe, expect, it } from "vitest";
import type { CurriculumStage } from "@/lib/curriculum/curriculumBank";
import { computeStageStates } from "@/lib/curriculum/stageUnlock";

const stage = (id: string, unlockRequirement: number, problemIds: readonly string[]): CurriculumStage => ({
  id,
  subject: "math",
  unit: "たし算",
  title: id,
  emoji: "➕",
  description: "",
  problemCount: problemIds.length,
  firstProblemId: problemIds[0],
  problemIds,
  unlockRequirement,
  level: 1,
});

const STAGES = [
  stage("a", 0, ["a1", "a2", "a3"]),
  stage("b", 2, ["b1", "b2"]),
  stage("c", 4, ["c1"]),
];

describe("computeStageStates", () => {
  it("まだ解いていないときは、必要数が 0 のステージだけが開いている", () => {
    const { stages, totalSolved, totalProblems } = computeStageStates(STAGES, []);
    expect(stages.map((s) => s.unlocked)).toEqual([true, false, false]);
    expect(stages.map((s) => s.remainingToUnlock)).toEqual([0, 2, 4]);
    expect(totalSolved).toBe(0);
    expect(totalProblems).toBe(6);
  });

  it("解いた問題の数は、教科のステージに入っている問題だけを数える(重複や知らない id は無視)", () => {
    const { totalSolved } = computeStageStates(STAGES, ["a1", "a1", "x9", "b1"]);
    expect(totalSolved).toBe(2);
  });

  it("教科の累計が必要数に届いたステージが開き、残りの数は 0 より小さくならない", () => {
    const { stages } = computeStageStates(STAGES, ["a1", "a2", "b1"]);
    expect(stages.map((s) => s.unlocked)).toEqual([true, true, false]);
    expect(stages.map((s) => s.remainingToUnlock)).toEqual([0, 0, 1]);
  });

  it("開いたばかり(必要数 + 2 まで)のステージだけ newlyUnlocked", () => {
    const early = computeStageStates(STAGES, ["a1", "a2"]).stages;
    expect(early.map((s) => s.newlyUnlocked)).toEqual([false, true, false]);
    const later = computeStageStates(STAGES, ["a1", "a2", "a3", "b1", "b2"]).stages;
    expect(later.map((s) => s.newlyUnlocked)).toEqual([false, false, true]);
  });

  it("つづきは、まだ解いていない最初の問題。全部解いていたら最初の問題", () => {
    const { stages } = computeStageStates(STAGES, ["a1", "a3", "b1", "b2"]);
    expect(stages.map((s) => s.nextProblemId)).toEqual(["a2", "b1", "c1"]);
  });

  it("全問を解いたステージは cleared。解いた数はそのステージの問題だけ", () => {
    const { stages } = computeStageStates(STAGES, ["a1", "a2", "a3", "b1"]);
    expect(stages.map((s) => s.solvedCount)).toEqual([3, 1, 0]);
    expect(stages.map((s) => s.cleared)).toEqual([true, false, false]);
  });

  it("進みぐあいは 0〜100 の整数、全部解いたら allCleared", () => {
    expect(computeStageStates(STAGES, ["a1"]).progressPercent).toBe(17);
    const done = computeStageStates(STAGES, ["a1", "a2", "a3", "b1", "b2", "c1"]);
    expect(done.progressPercent).toBe(100);
    expect(done.allCleared).toBe(true);
  });

  it("ステージが 1 つもないときは allCleared にならず、進みぐあいは 0", () => {
    const empty = computeStageStates([], ["a1"]);
    expect(empty.allCleared).toBe(false);
    expect(empty.progressPercent).toBe(0);
    expect(empty.stages).toEqual([]);
  });
});
