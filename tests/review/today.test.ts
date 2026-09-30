import { describe, expect, it, beforeEach } from "vitest";
import { findRecentMistake, getTodayRecommendations } from "@/lib/review/today";
import { addDaysJst, nowJstIso, todayKeyJst } from "@/lib/utils/date";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const CHILD = "11111111-1111-4111-8111-111111111111";

describe("findRecentMistake", () => {
  it("returns the newest incorrect attempt with a curriculum mistake type", () => {
    const attempts = [
      { problem_id: "a", similar_problem_id: null, mistake_type: null, is_correct: true },
      { problem_id: "b", similar_problem_id: null, mistake_type: "nonsense", is_correct: false },
      { problem_id: "c", similar_problem_id: null, mistake_type: "time_error", is_correct: false },
    ];
    expect(findRecentMistake(attempts, (attempt) => `unit-${attempt.problem_id}`)).toEqual({
      mistakeType: "time_error",
      unit: "unit-c",
    });
    expect(findRecentMistake(attempts, () => undefined)).toBeNull();
  });
});

describe("getTodayRecommendations", () => {
  const db = getDb();

  beforeEach(async () => {
    // クリーンアップ
    await db.delete(schema.attempts).where(eq(schema.attempts.childId, CHILD)).run();
    await db.delete(schema.learningSessions).where(eq(schema.learningSessions.childId, CHILD)).run();
    await db.delete(schema.reviewSchedule).where(eq(schema.reviewSchedule.childId, CHILD)).run();
    await db.delete(schema.weaknessMap).where(eq(schema.weaknessMap.childId, CHILD)).run();
    await db.delete(schema.generatedSimilarProblems).where(eq(schema.generatedSimilarProblems.childId, CHILD)).run();
    await db.delete(schema.problems).where(eq(schema.problems.childId, CHILD)).run();
    await db.delete(schema.appSettings).where(eq(schema.appSettings.childId, CHILD)).run();
    await db.delete(schema.uploadedMaterials).where(eq(schema.uploadedMaterials.childId, CHILD)).run();
    await db.delete(schema.childProfiles).where(eq(schema.childProfiles.id, CHILD)).run();

    const now = nowJstIso();
    await db
      .insert(schema.users)
      .values({
        id: "u-today",
        name: "parent",
        email: "parent@example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing()
      .run();

    await db
      .insert(schema.childProfiles)
      .values({
        id: CHILD,
        userId: "u-today",
        nickname: "子",
        grade: 2,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await db
      .insert(schema.uploadedMaterials)
      .values({
        id: "m-today",
        childId: CHILD,
        fileUrls: "[]",
        fileType: "image/png",
        pageCount: 1,
        sourceType: "camera",
        expiresAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await db
      .insert(schema.appSettings)
      .values({
        id: "set-1",
        childId: CHILD,
        dailyLimitMinutes: 15,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  });

  const setupDefaultScenario = async () => {
    const now = nowJstIso();
    await db.insert(schema.problems).values([
      {
        id: "p-add",
        childId: CHILD,
        materialId: "m-today",
        problemText: "p-add text",
        subject: "math",
        grade: 2,
        unit: "たし算",
        subUnit: "くり上がり",
        difficulty: "standard",
        correctAnswer: "10",
        explanationJson: "{}",
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "p-sub",
        childId: CHILD,
        materialId: "m-today",
        problemText: "p-sub text",
        subject: "math",
        grade: 2,
        unit: "ひき算",
        subUnit: "",
        difficulty: "standard",
        correctAnswer: "5",
        explanationJson: "{}",
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "p-len",
        childId: CHILD,
        materialId: "m-today",
        problemText: "p-len text",
        subject: "math",
        grade: 2,
        unit: "長さ",
        subUnit: "",
        difficulty: "standard",
        correctAnswer: "3",
        explanationJson: "{}",
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
    ]).run();

    await db.insert(schema.generatedSimilarProblems).values({
      id: "s-add",
      childId: CHILD,
      sourceProblemId: "p-add",
      problemText: "s-add text",
      unit: "たし算",
      subUnit: "くり上がり",
      difficulty: "basic",
      answer: "12",
      explanation: "{}",
      createdAt: now,
    }).run();

    await db.insert(schema.reviewSchedule).values({
      id: "r-len",
      childId: CHILD,
      problemId: "p-len",
      unit: "長さ",
      subUnit: "",
      scheduledFor: todayKeyJst(),
      reviewStage: 1,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    }).run();

    await db.insert(schema.weaknessMap).values({
      id: "w-sub",
      childId: CHILD,
      unit: "ひき算",
      subUnit: "",
      accuracyRate: 0.2,
      mistakeCount: 4,
      masteryLevel: "learning",
      createdAt: now,
      updatedAt: now,
    }).run();

    await db.insert(schema.learningSessions).values({
      id: "sess-today",
      childId: CHILD,
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    }).run();

    await db.insert(schema.attempts).values({
      id: "att-1",
      sessionId: "sess-today",
      childId: CHILD,
      problemId: null,
      similarProblemId: "s-add",
      childAnswer: "8",
      answerType: "keypad",
      mistakeType: "carry_error",
      isCorrect: 0,
      createdAt: now,
    }).run();
  };

  it("ranks due review, weak unit, then the recent-mistake unit resolved from its similar problem", async () => {
    await setupDefaultScenario();
    const result = await getTodayRecommendations(CHILD, new Date(), db);

    expect(result.error).toBe(false);
    expect(result.problems.map(({ id }) => id)).toEqual(["p-len", "p-sub", "p-add"]);
    expect(result.problems[0]).toMatchObject({ problem_text: "p-len text", estimatedMinutes: 3 });
  });

  it("uses the minutes remaining today as the time budget", async () => {
    await setupDefaultScenario();
    const now = new Date();
    const startedAt = new Date(now.getTime() - 10 * 60_000).toISOString();

    // 10分経過した未終了セッションを追加
    await db.insert(schema.learningSessions).values({
      id: "sess-10m",
      childId: CHILD,
      startedAt,
      endedAt: null,
      durationSeconds: 0,
      createdAt: startedAt,
      updatedAt: startedAt,
    }).run();

    const result = await getTodayRecommendations(CHILD, now, db);

    expect(result.remainingMinutes).toBe(5);
    expect(result.limitReached).toBe(false);
    expect(result.problems).toHaveLength(1);
  });

  it("recommends nothing once the daily limit is used up", async () => {
    await setupDefaultScenario();
    const now = nowJstIso();
    // 15分終了済みセッションを追加
    await db.insert(schema.learningSessions).values({
      id: "sess-15m",
      childId: CHILD,
      startedAt: now,
      endedAt: now,
      durationSeconds: 15 * 60,
      createdAt: now,
      updatedAt: now,
    }).run();

    const result = await getTodayRecommendations(CHILD, new Date(), db);

    expect(result.limitReached).toBe(true);
    expect(result.problems).toEqual([]);
  });

  it("ignores reviews scheduled for a later day", async () => {
    await setupDefaultScenario();
    // レビューの予定日を3日後に更新
    await db.update(schema.reviewSchedule)
      .set({ scheduledFor: addDaysJst(todayKeyJst(), 3) })
      .where(eq(schema.reviewSchedule.problemId, "p-len"))
      .run();

    // attempts を削除
    await db.delete(schema.attempts).where(eq(schema.attempts.childId, CHILD)).run();

    const result = await getTodayRecommendations(CHILD, new Date(), db);
    expect(result.problems[0].id).toBe("p-sub");
  });
});
