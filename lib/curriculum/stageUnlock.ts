import type { CurriculumStage } from "./curriculumBank";

/**
 * ステージマップの解放・進みぐあいの計算(純関数)。
 * ステージの定義(`getCurriculumStages`)と、いちどでも正解した問題バンクの id だけから決まる。
 * 答えを持たないので、サーバーで画面を組み立てるときにも、テストにもそのまま使える。
 */

/** 必要数に届いてから、この数だけ解くまでを「開いたばかり」として目立たせる。 */
const NEWLY_UNLOCKED_WINDOW = 2;

export interface StageState {
  readonly stage: CurriculumStage;
  /** そのステージで解いた問題の数 */
  readonly solvedCount: number;
  readonly cleared: boolean;
  readonly unlocked: boolean;
  readonly newlyUnlocked: boolean;
  /** 開くまでに、あと何問解けばよいか(開いていれば 0) */
  readonly remainingToUnlock: number;
  /** 「つづきから」で始める問題。まだ解いていない最初の問題で、全部解いていたら最初の問題 */
  readonly nextProblemId: string;
}

export interface StageSummary {
  readonly stages: readonly StageState[];
  /** 教科の累計クリア数(ステージに入っている問題だけを数える) */
  readonly totalSolved: number;
  readonly totalProblems: number;
  /** 0〜100 の整数 */
  readonly progressPercent: number;
  readonly allCleared: boolean;
}

export function computeStageStates(
  stages: readonly CurriculumStage[],
  solvedIds: readonly string[],
): StageSummary {
  const solved = new Set(solvedIds);
  const solvedCounts = stages.map((stage) => stage.problemIds.filter((id) => solved.has(id)).length);
  const totalSolved = solvedCounts.reduce((sum, count) => sum + count, 0);
  const totalProblems = stages.reduce((sum, stage) => sum + stage.problemCount, 0);

  const states = stages.map((stage, index): StageState => {
    const unlocked = totalSolved >= stage.unlockRequirement;
    return {
      stage,
      solvedCount: solvedCounts[index],
      cleared: solvedCounts[index] === stage.problemCount,
      unlocked,
      newlyUnlocked:
        unlocked &&
        stage.unlockRequirement > 0 &&
        totalSolved <= stage.unlockRequirement + NEWLY_UNLOCKED_WINDOW,
      remainingToUnlock: Math.max(0, stage.unlockRequirement - totalSolved),
      nextProblemId: stage.problemIds.find((id) => !solved.has(id)) ?? stage.firstProblemId,
    };
  });

  return {
    stages: states,
    totalSolved,
    totalProblems,
    progressPercent:
      totalProblems === 0 ? 0 : Math.min(100, Math.round((totalSolved / totalProblems) * 100)),
    allCleared: totalProblems > 0 && totalSolved >= totalProblems,
  };
}
