import { describe, expect, it } from "vitest";

import { updateWeakness } from "@/lib/review/weakness";

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
});
