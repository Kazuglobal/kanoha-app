import { describe, expect, it } from "vitest";

import { calculateReviewSchedule, nextReviewStage, toReviewStage } from "@/lib/review/schedule";

describe("calculateReviewSchedule", () => {
  const reviewedAt = new Date("2026-06-12T10:00:00+09:00");

  it.each([
    [5, 2, "2026-06-19"],
    [4, 2, "2026-06-15"],
    [3, 1, "2026-06-13"],
    [0, 1, "2026-06-13"],
  ])(
    "schedules %i correct answers at stage %i for %s",
    (correctCount, reviewStage, scheduledFor) => {
      expect(calculateReviewSchedule({ correctCount, reviewedAt })).toEqual({
        reviewStage,
        scheduledFor,
      });
    },
  );

  it("keeps the current stage after an unsuccessful review", () => {
    expect(
      calculateReviewSchedule({
        correctCount: 2,
        currentStage: 2,
        reviewedAt,
      }),
    ).toEqual({ reviewStage: 2, scheduledFor: "2026-06-13" });
  });

  it("schedules by the Asia/Tokyo date even when the instant is past UTC midnight", () => {
    // 2026-06-12T20:00Z is already 2026-06-13 05:00 in Asia/Tokyo.
    const utcEvening = new Date("2026-06-12T20:00:00Z");
    expect(calculateReviewSchedule({ correctCount: 0, reviewedAt: utcEvening })).toEqual({
      reviewStage: 1,
      scheduledFor: "2026-06-14",
    });
    expect(calculateReviewSchedule({ correctCount: 5, reviewedAt: utcEvening })).toEqual({
      reviewStage: 2,
      scheduledFor: "2026-06-20",
    });
  });

  it.each([
    [5, 1, 2, "2026-06-19"],
    [5, 2, 3, "2026-06-19"],
    [5, 3, 3, "2026-06-19"],
    [4, 3, 3, "2026-06-15"],
    [4, 1, 2, "2026-06-15"],
    [3, 3, 3, "2026-06-13"],
    [1, 1, 1, "2026-06-13"],
  ] as const)(
    "%i/5 from stage %i moves to stage %i on %s (5/5 steps up, max 3; <=3/5 keeps stage)",
    (correctCount, currentStage, reviewStage, scheduledFor) => {
      expect(calculateReviewSchedule({ correctCount, currentStage, reviewedAt })).toEqual({
        reviewStage,
        scheduledFor,
      });
    },
  );

  it("normalizes stored stages and steps them up to the cap", () => {
    expect(toReviewStage(2)).toBe(2);
    expect(toReviewStage(null)).toBe(1);
    expect(toReviewStage(9)).toBe(1);
    expect(nextReviewStage(1)).toBe(2);
    expect(nextReviewStage(3)).toBe(3);
  });

  it("rejects scores outside the five-question set", () => {
    expect(() =>
      calculateReviewSchedule({ correctCount: 6, reviewedAt }),
    ).toThrow();
  });
});
