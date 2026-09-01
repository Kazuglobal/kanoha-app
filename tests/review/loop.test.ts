import { describe, expect, it } from "vitest";

import {
  clampDurationSeconds,
  mistakeTypeFromExplanation,
  recentUnitAttempts,
  transitionReview,
  weaknessStatsAfterAttempt,
} from "@/lib/review/loop";
import { addDaysJst, todayKeyJst } from "@/lib/utils/date";
import { callsFor, fakeSupabase, type QueryCall, type Row } from "@/tests/review/fakeSupabase";

const CHILD = "11111111-1111-4111-8111-111111111111";
const PROBLEM = "33333333-3333-4333-8333-333333333333";

describe("weaknessStatsAfterAttempt", () => {
  it("routes the RPC counts through updateWeakness", () => {
    expect(weaknessStatsAfterAttempt(
      { attempt_count: "5", correct_count: "4", mistake_count: 1, accuracy_rate: "0.8", mastery_level: "mastered" },
      true,
    )).toEqual({ accuracyRate: 0.8, attemptCount: 5, correctCount: 4, masteryLevel: "mastered", mistakeCount: 1 });
  });

  it("treats the first attempt as having no previous statistics", () => {
    expect(weaknessStatsAfterAttempt(
      { attempt_count: 1, correct_count: 0, mistake_count: 1, accuracy_rate: 0, mastery_level: "learning" },
      false,
    )).toEqual({ accuracyRate: 0, attemptCount: 1, correctCount: 0, masteryLevel: "learning", mistakeCount: 1 });
  });
});

describe("mistakeTypeFromExplanation", () => {
  it("accepts only curriculum mistake ids", () => {
    expect(mistakeTypeFromExplanation({ mistakeType: "carry_error" })).toBe("carry_error");
    expect(mistakeTypeFromExplanation({ mistakeType: "unit_confusion" })).toBeNull();
    expect(mistakeTypeFromExplanation(null)).toBeNull();
    expect(mistakeTypeFromExplanation("carry_error")).toBeNull();
  });
});

describe("clampDurationSeconds", () => {
  const startedAt = "2026-09-02T00:00:00.000Z";

  it("never exceeds the server-measured elapsed time", () => {
    expect(clampDurationSeconds(3600, startedAt, new Date("2026-09-02T00:01:30.000Z"))).toBe(90);
    expect(clampDurationSeconds(45, startedAt, new Date("2026-09-02T00:01:30.000Z"))).toBe(45);
    expect(clampDurationSeconds(45, startedAt, new Date("2026-09-01T23:59:00.000Z"))).toBe(0);
    expect(clampDurationSeconds(45, "not a date", new Date())).toBe(0);
  });
});

describe("transitionReview", () => {
  const reviewTable = (existing: Row | null) => (call: QueryCall) =>
    call.operation === "select" ? (existing ? [existing] : []) : [call.payload as Row];

  it("creates a stage-1 review one day out on the first wrong answer", async () => {
    const fake = fakeSupabase({ tables: { review_schedule: reviewTable(null) } });
    const now = new Date("2026-09-02T12:00:00+09:00");
    const result = await transitionReview(fake.client, {
      childId: CHILD, problemId: PROBLEM, unit: "たし算", subUnit: "くり上がり", isCorrect: false, now,
    });
    expect(result).toEqual({ action: "created", scheduledFor: "2026-09-03", reviewStage: 1 });
    expect(callsFor(fake.calls, "review_schedule", "upsert")[0].payload).toMatchObject({
      review_stage: 1, status: "pending", scheduled_for: "2026-09-03",
    });
  });

  it("re-opens a finished review on a new wrong answer", async () => {
    const fake = fakeSupabase({ tables: { review_schedule: reviewTable({ id: "r", status: "done", scheduled_for: "2026-08-01" }) } });
    const result = await transitionReview(fake.client, {
      childId: CHILD, problemId: PROBLEM, unit: "たし算", subUnit: "", isCorrect: false,
    });
    expect(result.action).toBe("created");
  });

  it("does not complete a review that is not yet due", async () => {
    const future = { id: "r", status: "pending", scheduled_for: addDaysJst(todayKeyJst(), 2) };
    const fake = fakeSupabase({ tables: { review_schedule: reviewTable(future) } });
    const result = await transitionReview(fake.client, {
      childId: CHILD, problemId: PROBLEM, unit: "たし算", subUnit: "", isCorrect: true,
    });
    expect(result).toEqual({ action: "none" });
    expect(callsFor(fake.calls, "review_schedule", "update")).toHaveLength(0);
  });

  it("completes a review that was due yesterday", async () => {
    const overdue = { id: "r", status: "pending", scheduled_for: addDaysJst(todayKeyJst(), -1) };
    const fake = fakeSupabase({ tables: { review_schedule: reviewTable(overdue) } });
    const result = await transitionReview(fake.client, {
      childId: CHILD, problemId: PROBLEM, unit: "たし算", subUnit: "", isCorrect: true,
    });
    expect(result).toEqual({ action: "completed", reviewId: "r" });
  });

  it("surfaces read failures instead of guessing", async () => {
    const fake = fakeSupabase({ tables: { review_schedule: () => ({ error: { message: "down" } }) } });
    const result = await transitionReview(fake.client, {
      childId: CHILD, problemId: PROBLEM, unit: "たし算", subUnit: "", isCorrect: false,
    });
    expect(result).toEqual({ action: "error" });
  });
});

describe("recentUnitAttempts", () => {
  it("keeps only attempts of the unit, newest first, capped at the limit", async () => {
    const fake = fakeSupabase({
      tables: {
        problems: () => [{ id: "p-unit" }],
        generated_similar_problems: () => [{ id: "s-unit" }],
        attempts: () => [
          { problem_id: "p-other", similar_problem_id: null, mistake_type: "carry_error", is_correct: false },
          { problem_id: null, similar_problem_id: "s-unit", mistake_type: "carry_error", is_correct: false },
          { problem_id: "p-unit", similar_problem_id: null, mistake_type: "bogus", is_correct: false },
          { problem_id: "p-unit", similar_problem_id: null, mistake_type: null, is_correct: true },
        ],
      },
    });
    const history = await recentUnitAttempts(fake.client, CHILD, "たし算", 2);
    expect(history).toEqual([
      { isCorrect: false, mistakeType: "carry_error" },
      { isCorrect: false, mistakeType: null },
    ]);
    const query = callsFor(fake.calls, "attempts")[0];
    expect(query.order).toEqual({ column: "created_at", ascending: false });
    expect(query.limit).toBe(50);
  });
});
