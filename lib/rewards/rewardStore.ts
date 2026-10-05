"use client";

import type { GrowthLevelInfo } from "./catalog";
import {
  DEFAULT_REWARD_STATE,
  applyCorrectAnswer,
  describeRewardChange,
  normalizeRewardState,
  previousOfCorrectAnswer,
  type RewardChange,
  type RewardState,
} from "./rewardLogic";

export type { RewardState } from "./rewardLogic";

/**
 * ごほうびの端末キャッシュ。ログイン中の正は DB(child_rewards)で、
 * ここには「いま表示している子ども」の値を置く。未ログインのデモだけはここで数える。
 */
const STORAGE_KEY = "kanoha_child_rewards_v1";

export function getRewardState(): RewardState {
  if (typeof window === "undefined") return DEFAULT_REWARD_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeRewardState(JSON.parse(raw)) : DEFAULT_REWARD_STATE;
  } catch {
    return DEFAULT_REWARD_STATE;
  }
}

export function saveRewardState(state: RewardState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 保存できなくても表示は続ける
  }
  window.dispatchEvent(new CustomEvent("kanoha-reward-update", { detail: state }));
}

export interface RecordCorrectResult {
  previousState: RewardState;
  newState: RewardState;
  earnedFiveYen: boolean; // 今回の正解で10問達成（5円獲得）したか
  newCycleCount: number;
  leveledUp: boolean; // 今回の正解でレベルアップしたか
  newLevel: GrowthLevelInfo;
}

function announce(change: RewardChange): RecordCorrectResult {
  saveRewardState(change.newState);
  window.dispatchEvent(new CustomEvent("kanoha-problem-solved", { detail: { correct: true } }));
  if (change.earnedFiveYen) {
    window.dispatchEvent(new CustomEvent("kanoha-five-yen-earned", { detail: change.newState }));
  }
  if (change.leveledUp) {
    window.dispatchEvent(
      new CustomEvent("kanoha-level-up", {
        detail: {
          previousLevel: change.previousLevel,
          newLevel: change.newLevel,
          totalCorrect: change.newState.totalCorrectCount,
        },
      }),
    );
  }
  return {
    previousState: change.previousState,
    newState: change.newState,
    earnedFiveYen: change.earnedFiveYen,
    newCycleCount: change.newCycleCount,
    leveledUp: change.leveledUp,
    newLevel: change.newLevel,
  };
}

/**
 * 未ログイン(デモ)の1問正解を端末だけで記録する。
 * 10問正解ごとに5円、正解数に応じてキャラクターレベルもアップ。
 */
export function recordCorrectAnswer(): RecordCorrectResult {
  const current = getRewardState();
  return announce(describeRewardChange(current, applyCorrectAnswer(current, new Date().toISOString())));
}

/** ログイン中: /api/attempts がサーバーで記録した正解後の値を表示に反映する。 */
export function applyServerReward(raw: unknown): RecordCorrectResult | null {
  if (!raw || typeof raw !== "object") return null;
  const next = normalizeRewardState(raw as Partial<Record<keyof RewardState, unknown>>);
  return announce(describeRewardChange(previousOfCorrectAnswer(next), next));
}
