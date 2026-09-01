import { describe, expect, it } from "vitest";

import { calculateReviewSchedule } from "@/lib/review/schedule";

describe("calculateReviewSchedule", () => {
  const reviewedAt = new Date("2026-06-12T10:00:00+09:00");

  it.each([
    [5, 3, "2026-06-19"],
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
      reviewStage: 3,
      scheduledFor: "2026-06-20",
    });
  });

  it("rejects scores outside the five-question set", () => {
    expect(() =>
      calculateReviewSchedule({ correctCount: 6, reviewedAt }),
    ).toThrow();
  });
});
