"use client";

import { getCharacterLevel, type GrowthLevelInfo } from "./characterGrowthStore";

export interface RewardState {
  currentCycleCount: number; // 0 - 10 (10問で1サイクル)
  totalCorrectCount: number;
  totalRewardYen: number; // 累計獲得金額(円)
  lastRewardEarnedAt?: string;
}

const STORAGE_KEY = "kanoha_child_rewards_v1";

const DEFAULT_STATE: RewardState = {
  currentCycleCount: 0,
  totalCorrectCount: 0,
  totalRewardYen: 0,
};

export function getRewardState(): RewardState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<RewardState>;
    return {
      currentCycleCount: Number(parsed.currentCycleCount ?? 0) % 10,
      totalCorrectCount: Number(parsed.totalCorrectCount ?? 0),
      totalRewardYen: Number(parsed.totalRewardYen ?? 0),
      lastRewardEarnedAt: parsed.lastRewardEarnedAt,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveRewardState(state: RewardState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("kanoha-reward-update", { detail: state }));
  } catch {
    // ignore
  }
}

export interface RecordCorrectResult {
  previousState: RewardState;
  newState: RewardState;
  earnedFiveYen: boolean; // 今回の正解で10問達成（5円獲得）したか
  newCycleCount: number;
  leveledUp: boolean; // 今回の正解でレベルアップしたか
  newLevel: GrowthLevelInfo;
}

/**
 * 1問正解を記録する。
 * 10問正解ごとに5円獲得！
 * 正解数に応じてキャラクターレベルもアップ！
 */
export function recordCorrectAnswer(): RecordCorrectResult {
  const current = getRewardState();
  const nextCycle = current.currentCycleCount + 1;
  const earnedFiveYen = nextCycle >= 10;

  const previousLevel = getCharacterLevel(current.totalCorrectCount);
  const newTotalCorrect = current.totalCorrectCount + 1;
  const newLevel = getCharacterLevel(newTotalCorrect);
  const leveledUp = newLevel.level > previousLevel.level;

  const newState: RewardState = {
    currentCycleCount: earnedFiveYen ? 0 : nextCycle,
    totalCorrectCount: newTotalCorrect,
    totalRewardYen: earnedFiveYen ? current.totalRewardYen + 5 : current.totalRewardYen,
    lastRewardEarnedAt: earnedFiveYen ? new Date().toISOString() : current.lastRewardEarnedAt,
  };

  saveRewardState(newState);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("kanoha-problem-solved", { detail: { correct: true } }));
    if (earnedFiveYen) {
      window.dispatchEvent(new CustomEvent("kanoha-five-yen-earned", { detail: newState }));
    }
    if (leveledUp) {
      window.dispatchEvent(
        new CustomEvent("kanoha-level-up", {
          detail: { previousLevel, newLevel, totalCorrect: newTotalCorrect },
        })
      );
    }
  }

  return {
    previousState: current,
    newState,
    earnedFiveYen,
    newCycleCount: earnedFiveYen ? 10 : nextCycle,
    leveledUp,
    newLevel,
  };
}
