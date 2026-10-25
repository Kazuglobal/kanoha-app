import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyServerReward, getRewardState, notifyProblemSolved, recordCorrectAnswer } from "@/lib/rewards/rewardStore";

describe("rewardStore", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("initializes with default reward state (0 yen, 0 cycle count)", () => {
    const state = getRewardState();
    expect(state.currentCycleCount).toBe(0);
    expect(state.totalCorrectCount).toBe(0);
    expect(state.totalRewardYen).toBe(0);
  });

  it("increments cycle count on correct answer without giving yen before 10", () => {
    const result1 = recordCorrectAnswer();
    expect(result1.earnedFiveYen).toBe(false);
    expect(result1.newState.currentCycleCount).toBe(1);
    expect(result1.newState.totalCorrectCount).toBe(1);
    expect(result1.newState.totalRewardYen).toBe(0);

    const result2 = recordCorrectAnswer();
    expect(result2.earnedFiveYen).toBe(false);
    expect(result2.newState.currentCycleCount).toBe(2);
    expect(result2.newState.totalCorrectCount).toBe(2);
    expect(result2.newState.totalRewardYen).toBe(0);
  });

  it("awards 5 yen and resets cycle count when reaching 10 correct answers", () => {
    // 9問正解
    for (let i = 0; i < 9; i++) {
      recordCorrectAnswer();
    }
    const stateBefore10 = getRewardState();
    expect(stateBefore10.currentCycleCount).toBe(9);
    expect(stateBefore10.totalRewardYen).toBe(0);

    // 10問目正解！
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const result10 = recordCorrectAnswer();

    expect(result10.earnedFiveYen).toBe(true);
    expect(result10.newState.currentCycleCount).toBe(0); // リセット
    expect(result10.newState.totalCorrectCount).toBe(10);
    expect(result10.newState.totalRewardYen).toBe(5); // +5円獲得！
    expect(result10.newState.lastRewardEarnedAt).toBeDefined();

    // 5円獲得イベントが発火されたことを検証
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "kanoha-five-yen-earned" }),
    );
  });

  it("accumulates multiple 5-yen rewards across 20 correct answers", () => {
    for (let i = 0; i < 20; i++) {
      recordCorrectAnswer();
    }
    const state = getRewardState();
    expect(state.totalCorrectCount).toBe(20);
    expect(state.totalRewardYen).toBe(10); // 10問ごとに5円 = 20問で10円
    expect(state.currentCycleCount).toBe(0);
  });

  describe("the character reacts to every correct answer, even when no reward was added", () => {
    const solvedEvents = () => {
      const listener = vi.fn();
      window.addEventListener("kanoha-problem-solved", listener);
      return { listener, stop: () => window.removeEventListener("kanoha-problem-solved", listener) };
    };

    it("notifyProblemSolved fires the event without touching the stored reward", () => {
      const { listener, stop } = solvedEvents();
      const before = getRewardState();
      notifyProblemSolved();
      stop();
      expect(listener).toHaveBeenCalledTimes(1);
      expect(getRewardState()).toEqual(before);
    });

    it("applyServerReward(null) (already paid today) still fires the event and changes nothing", () => {
      const { listener, stop } = solvedEvents();
      const before = getRewardState();
      expect(applyServerReward(null)).toBeNull();
      stop();
      expect(listener).toHaveBeenCalledTimes(1);
      expect(getRewardState()).toEqual(before);
    });
  });
});
