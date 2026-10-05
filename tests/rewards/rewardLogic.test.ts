import { describe, expect, it } from "vitest";
import { DEFAULT_EQUIPPED } from "@/lib/rewards/catalog";
import {
  DEFAULT_REWARD_STATE,
  applyCorrectAnswer,
  canEquip,
  describeRewardChange,
  normalizeEquipped,
  normalizeRewardState,
  parseEquippedJson,
  previousOfCorrectAnswer,
  type RewardState,
} from "@/lib/rewards/rewardLogic";

const NOW = "2026-10-05T10:00:00+09:00";

const repeat = (times: number): RewardState =>
  Array.from({ length: times }).reduce<RewardState>((state) => applyCorrectAnswer(state, NOW), DEFAULT_REWARD_STATE);

describe("rewardLogic", () => {
  it("gives 5 yen and resets the cycle on every 10th correct answer", () => {
    expect(repeat(9)).toEqual({ currentCycleCount: 9, totalCorrectCount: 9, totalRewardYen: 0 });
    expect(repeat(10)).toEqual({
      currentCycleCount: 0,
      totalCorrectCount: 10,
      totalRewardYen: 5,
      lastRewardEarnedAt: NOW,
    });
    expect(repeat(23)).toMatchObject({ currentCycleCount: 3, totalCorrectCount: 23, totalRewardYen: 10 });
  });

  it("does not mutate the given state", () => {
    const before = { ...DEFAULT_REWARD_STATE };
    applyCorrectAnswer(before, NOW);
    expect(before).toEqual(DEFAULT_REWARD_STATE);
  });

  it("restores the state before a correct answer (for server responses)", () => {
    expect(previousOfCorrectAnswer(repeat(4))).toEqual(repeat(3));
    expect(previousOfCorrectAnswer(repeat(10))).toMatchObject({
      currentCycleCount: 9,
      totalCorrectCount: 9,
      totalRewardYen: 0,
    });
  });

  it("describes five-yen and level-up moments", () => {
    const tenth = describeRewardChange(repeat(9), repeat(10));
    expect(tenth).toMatchObject({ earnedFiveYen: true, newCycleCount: 10, leveledUp: false });

    const fifth = describeRewardChange(repeat(4), repeat(5));
    expect(fifth).toMatchObject({ earnedFiveYen: false, leveledUp: true });
    expect(fifth.newLevel.level).toBe(2);

    const plain = describeRewardChange(repeat(1), repeat(2));
    expect(plain).toMatchObject({ earnedFiveYen: false, newCycleCount: 2, leveledUp: false });
  });

  it("normalizes broken or negative stored values", () => {
    expect(normalizeRewardState(null)).toEqual(DEFAULT_REWARD_STATE);
    expect(
      normalizeRewardState({ currentCycleCount: 13, totalCorrectCount: -3, totalRewardYen: "x", lastRewardEarnedAt: null }),
    ).toEqual({ currentCycleCount: 3, totalCorrectCount: 0, totalRewardYen: 0 });
  });

  it("keeps only catalog items in the right category", () => {
    expect(normalizeEquipped({ hat: "hat_crown", glasses: "hat_crown", gloves: 1 })).toEqual({
      ...DEFAULT_EQUIPPED,
      hat: "hat_crown",
    });
    expect(parseEquippedJson("{broken")).toEqual(DEFAULT_EQUIPPED);
    expect(parseEquippedJson(null)).toEqual(DEFAULT_EQUIPPED);
  });

  it("allows equipping only unlocked items of the same category", () => {
    expect(canEquip("hat", "hat_safari", 0)).toBe(true);
    expect(canEquip("hat", "hat_crown", 49)).toBe(false);
    expect(canEquip("hat", "hat_crown", 50)).toBe(true);
    expect(canEquip("glasses", "hat_safari", 50)).toBe(false);
    expect(canEquip("hat", "no_such_item", 50)).toBe(false);
  });
});
