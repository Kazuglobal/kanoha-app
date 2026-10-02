import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  clampDurationSeconds,
  mistakeTypeFromExplanation,
  recentUnitAttempts,
  recomputeWeakness,
  transitionReview,
  weaknessStatsFromRow,
} from "@/lib/review/loop";
import { addDaysJst, nowJstIso, todayKeyJst } from "@/lib/utils/date";
import * as operations from "@/lib/db/operations";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const CHILD = "11111111-1111-4111-8111-111111111111";
const PROBLEM = "33333333-3333-4333-8333-333333333333";

describe("weaknessStatsFromRow", () => {
  it("maps the RPC row (numeric strings included) without recomputing mastery", () => {
    expect(
      weaknessStatsFromRow({
        attempt_count: "5",
        correct_count: "4",
        mistake_count: 1,
        accuracy_rate: "0.8",
        mastery_level: "mastered",
      }),
    ).toEqual({
      accuracyRate: 0.8,
      attemptCount: 5,
      correctCount: 4,
      masteryLevel: "mastered",
      mistakeCount: 1,
    });
  });

  it("keeps the DB's sticky mastered even when the latest attempt was wrong", () => {
    expect(
      weaknessStatsFromRow({
        attempt_count: 6,
        correct_count: 4,
        mistake_count: 2,
        accuracy_rate: 0.6667,
        mastery_level: "mastered",
      }).masteryLevel,
    ).toBe("mastered");
  });

  it("falls back to learning for an unknown mastery string", () => {
    expect(
      weaknessStatsFromRow({
        attempt_count: 1,
        correct_count: 0,
        mistake_count: 1,
        accuracy_rate: 0,
        mastery_level: "bogus",
      }).masteryLevel,
    ).toBe("learning");
  });
});

describe("recomputeWeakness", () => {
  const unit = { childId: CHILD, unit: "たし算", subUnit: "" };

  it("returns the stats recomputed by operations", async () => {
    vi.spyOn(operations, "recomputeWeakness").mockResolvedValueOnce({
      accuracyRate: 0.6667,
      attemptCount: 6,
      correctCount: 4,
      masteryLevel: "mastered",
      mistakeCount: 2,
    });

    const stats = await recomputeWeakness(unit);
    expect(stats).toEqual({
      accuracyRate: 0.6667,
      attemptCount: 6,
      correctCount: 4,
      masteryLevel: "mastered",
      mistakeCount: 2,
    });
    expect(operations.recomputeWeakness).toHaveBeenCalledWith(
      CHILD,
      "たし算",
      "",
      expect.anything(),
    );
  });

  it("returns null when recomputeWeakness throws", async () => {
    vi.spyOn(operations, "recomputeWeakness").mockRejectedValueOnce(new Error("boom"));
    expect(await recomputeWeakness(unit)).toBeNull();
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
  const db = getDb();

  beforeEach(async () => {
    const now = nowJstIso();
    await db
      .insert(schema.users)
      .values({
        id: "u-loop",
        name: "test user",
        email: "test-loop@example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing()
      .run();

    await db
      .insert(schema.childProfiles)
      .values({
        id: CHILD,
        userId: "u-loop",
        nickname: "子",
        grade: 2,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
    await db
      .insert(schema.uploadedMaterials)
      .values({
        id: "m-loop",
        childId: CHILD,
        fileUrls: "[]",
        fileType: "image/png",
        pageCount: 1,
        sourceType: "camera",
        expiresAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .run();

    await db
      .insert(schema.problems)
      .values({
        id: PROBLEM,
        childId: CHILD,
        materialId: "m-loop",
        problemText: "test problem",
        subject: "math",
        grade: 2,
        unit: "たし算",
        subUnit: "くり上がり",
        difficulty: "standard",
        correctAnswer: "10",
        explanationJson: "{}",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .run();

    await db.delete(schema.reviewSchedule).where(eq(schema.reviewSchedule.childId, CHILD)).run();
  });

  it("creates a stage-1 review one day out on the first wrong answer", async () => {
    const now = new Date("2026-09-02T12:00:00+09:00");
    const result = await transitionReview(
      {
        childId: CHILD,
        problemId: PROBLEM,
        unit: "たし算",
        subUnit: "くり上がり",
        isCorrect: false,
        now,
      },
      db,
    );
    expect(result).toEqual({ action: "created", scheduledFor: "2026-09-03", reviewStage: 1 });

    const saved = await db
      .select()
      .from(schema.reviewSchedule)
      .where(eq(schema.reviewSchedule.problemId, PROBLEM))
      .get();
    expect(saved).toMatchObject({
      reviewStage: 1,
      status: "pending",
      scheduledFor: "2026-09-03",
    });
  });

  it("re-opens a finished review on a new wrong answer", async () => {
    const now = nowJstIso();
    await db
      .insert(schema.reviewSchedule)
      .values({
        id: "r1",
        childId: CHILD,
        problemId: PROBLEM,
        unit: "たし算",
        subUnit: "",
        scheduledFor: "2026-08-01",
        reviewStage: 1,
        status: "done",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const result = await transitionReview(
      {
        childId: CHILD,
        problemId: PROBLEM,
        unit: "たし算",
        subUnit: "",
        isCorrect: false,
      },
      db,
    );
    expect(result.action).toBe("created");
  });

  it("does not complete a review that is not yet due", async () => {
    const now = nowJstIso();
    await db
      .insert(schema.reviewSchedule)
      .values({
        id: "r2",
        childId: CHILD,
        problemId: PROBLEM,
        unit: "たし算",
        subUnit: "",
        scheduledFor: addDaysJst(todayKeyJst(), 2),
        reviewStage: 1,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const result = await transitionReview(
      {
        childId: CHILD,
        problemId: PROBLEM,
        unit: "たし算",
        subUnit: "",
        isCorrect: true,
      },
      db,
    );
    expect(result).toEqual({ action: "none" });
  });

  it("completes a review that was due yesterday", async () => {
    const now = nowJstIso();
    await db
      .insert(schema.reviewSchedule)
      .values({
        id: "r3",
        childId: CHILD,
        problemId: PROBLEM,
        unit: "たし算",
        subUnit: "",
        scheduledFor: addDaysJst(todayKeyJst(), -1),
        reviewStage: 1,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const result = await transitionReview(
      {
        childId: CHILD,
        problemId: PROBLEM,
        unit: "たし算",
        subUnit: "",
        isCorrect: true,
      },
      db,
    );
    expect(result).toEqual({ action: "completed", reviewId: "r3" });
  });
});

describe("recentUnitAttempts", () => {
  const db = getDb();

  it("keeps only attempts of the unit, newest first, capped at the limit", async () => {
    const now = nowJstIso();
    // 依存する親・子どもレコードを作成
    await db
      .insert(schema.users)
      .values({
        id: "u-1",
        name: "test user",
        email: "test@example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing()
      .run();

    await db
      .insert(schema.childProfiles)
      .values({
        id: CHILD,
        userId: "u-1",
        nickname: "子",
        grade: 2,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .run();

    await db
      .insert(schema.uploadedMaterials)
      .values({
        id: "m-1",
        childId: CHILD,
        fileUrls: "[]",
        fileType: "image/png",
        pageCount: 1,
        sourceType: "camera",
        expiresAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .run();

    await db
      .insert(schema.problems)
      .values([
        {
          id: "p-unit",
          childId: CHILD,
          materialId: "m-1",
          problemText: "p1",
          subject: "math",
          grade: 2,
          unit: "たし算",
          subUnit: "",
          difficulty: "standard",
          correctAnswer: "10",
          explanationJson: "{}",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "p-other",
          childId: CHILD,
          materialId: "m-1",
          problemText: "p2",
          subject: "math",
          grade: 2,
          unit: "ひき算",
          subUnit: "",
          difficulty: "standard",
          correctAnswer: "5",
          explanationJson: "{}",
          createdAt: now,
          updatedAt: now,
        },
      ])
      .onConflictDoNothing()
      .run();

    await db
      .insert(schema.generatedSimilarProblems)
      .values({
        id: "s-unit",
        childId: CHILD,
        sourceProblemId: "p-unit",
        problemText: "s1",
        unit: "たし算",
        subUnit: "",
        difficulty: "standard",
        answer: "12",
        explanation: "{}",
        createdAt: now,
      })
      .onConflictDoNothing()
      .run();

    await db
      .insert(schema.learningSessions)
      .values({
        id: "sess-1",
        childId: CHILD,
        startedAt: "2026-09-02T00:00:00.000Z",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .run();

    await db
      .insert(schema.attempts)
      .values([
        {
          id: "a-1",
          sessionId: "sess-1",
          childId: CHILD,
          problemId: "p-other",
          similarProblemId: null,
          childAnswer: "3",
          answerType: "keypad",
          mistakeType: "carry_error",
          isCorrect: 0,
          createdAt: "2026-09-02T01:00:00.000Z",
        },
        {
          id: "a-2",
          sessionId: "sess-1",
          childId: CHILD,
          problemId: null,
          similarProblemId: "s-unit",
          childAnswer: "4",
          answerType: "keypad",
          mistakeType: "carry_error",
          isCorrect: 0,
          createdAt: "2026-09-02T02:00:00.000Z",
        },
        {
          id: "a-3",
          sessionId: "sess-1",
          childId: CHILD,
          problemId: "p-unit",
          similarProblemId: null,
          childAnswer: "5",
          answerType: "keypad",
          mistakeType: "bogus",
          isCorrect: 0,
          createdAt: "2026-09-02T03:00:00.000Z",
        },
        {
          id: "a-4",
          sessionId: "sess-1",
          childId: CHILD,
          problemId: "p-unit",
          similarProblemId: null,
          childAnswer: "10",
          answerType: "keypad",
          mistakeType: null,
          isCorrect: 1,
          createdAt: "2026-09-02T04:00:00.000Z",
        },
      ])
      .run();

    const history = await recentUnitAttempts(CHILD, "たし算", 2, db);
    expect(history).toEqual([
      { isCorrect: true, mistakeType: null },
      { isCorrect: false, mistakeType: null },
    ]);
  });
});
