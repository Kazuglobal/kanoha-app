import { describe, expect, it } from "vitest";

import { masteryAfterSimilarSet, updateWeakness } from "@/lib/review/weakness";

describe("updateWeakness", () => {
  it("creates weakness statistics from a first incorrect attempt", () => {
    expect(updateWeakness(null, { isCorrect: false })).toEqual({
      accuracyRate: 0,
      attemptCount: 1,
      correctCount: 0,
      masteryLevel: "learning",
      mistakeCount: 1,
    });
  });

  it("immutably recalculates accuracy and mastery", () => {
    const current = {
      accuracyRate: 0.75,
      attemptCount: 4,
      correctCount: 3,
      masteryLevel: "reviewing" as const,
      mistakeCount: 1,
    };

    expect(updateWeakness(current, { isCorrect: true })).toEqual({
      accuracyRate: 0.8,
      attemptCount: 5,
      correctCount: 4,
      masteryLevel: "mastered",
      mistakeCount: 1,
    });
    expect(current.attemptCount).toBe(4);
  });

  it("keeps mastered after a wrong attempt (demotion only via masteryAfterSimilarSet)", () => {
    const mastered = {
      accuracyRate: 0.8,
      attemptCount: 5,
      correctCount: 4,
      masteryLevel: "mastered" as const,
      mistakeCount: 1,
    };
    const next = updateWeakness(mastered, { isCorrect: false });
    expect(next).toEqual({
      accuracyRate: 0.6667,
      attemptCount: 6,
      correctCount: 4,
      masteryLevel: "mastered",
      mistakeCount: 2,
    });
    expect(updateWeakness(next, { isCorrect: false }).masteryLevel).toBe("mastered");
    expect(masteryAfterSimilarSet(next.masteryLevel, 3)).toBe("reviewing");
  });

  it("still promotes and demotes normally below mastered", () => {
    const reviewing = { accuracyRate: 1, attemptCount: 1, correctCount: 1, masteryLevel: "reviewing" as const, mistakeCount: 0 };
    expect(updateWeakness(reviewing, { isCorrect: false }).masteryLevel).toBe("reviewing");
    expect(updateWeakness(null, { isCorrect: true }).masteryLevel).toBe("reviewing");
  });
});

describe("masteryAfterSimilarSet", () => {
  it.each([
    ["learning", 4, "mastered"],
    ["reviewing", 5, "mastered"],
    ["mastered", 3, "reviewing"],
    ["reviewing", 3, "reviewing"],
    ["learning", 0, "learning"],
  ] as const)("%s with %i/5 becomes %s", (current, count, expected) => {
    expect(masteryAfterSimilarSet(current, count)).toBe(expected);
  });

  it("rejects counts outside the five-question set", () => {
    expect(() => masteryAfterSimilarSet("learning", 6)).toThrow(RangeError);
  });
});
