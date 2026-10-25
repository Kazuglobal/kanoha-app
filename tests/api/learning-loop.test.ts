import { beforeEach, describe, expect, it, vi } from "vitest";

import { addDaysJst, nowJstIso, todayKeyJst } from "@/lib/utils/date";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const CHILD = "11111111-1111-4111-8111-111111111111";
const SESSION = "22222222-2222-4222-8222-222222222222";
const PROBLEM = "33333333-3333-4333-8333-333333333333";
const SIMILAR = "44444444-4444-4444-8444-444444444444";
const REVIEW = "55555555-5555-4555-8555-555555555555";

vi.mock("@/lib/utils/rateLimit", () => ({
  checkRateLimit: () => true,
  checkRateLimitDb: async () => true,
}));

vi.mock("@/lib/utils/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/utils/api")>();
  return {
    ...original,
    requireOwnedChild: vi.fn(async () => ({
      db: getDb(),
      user: { id: "user-loop-1" },
      response: null,
    })),
  };
});

const post = (path: string, body: unknown) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const SIMILAR_CHOICES = ["2000mL", "200mL", "20000mL", "1000mL"];

describe("learning loop: attempts → weakness → review → schedule", () => {
  const db = getDb();

  beforeEach(async () => {
    const now = nowJstIso();

    await db.delete(schema.attempts).run();
    await db.delete(schema.reviewSchedule).run();
    await db.delete(schema.weaknessMap).run();
    await db.delete(schema.problemHintViews).run();
    await db.delete(schema.generatedSimilarProblems).run();
    await db.delete(schema.problems).run();
    await db.delete(schema.learningSessions).run();
    await db.delete(schema.uploadedMaterials).run();
    await db.delete(schema.appSettings).run();
    await db.delete(schema.childProfiles).run();

    await db
      .insert(schema.users)
      .values({
        id: "user-loop-1",
        name: "parent",
        email: "user-loop-1@example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing()
      .run();

    await db
      .insert(schema.childProfiles)
      .values({
        id: CHILD,
        userId: "user-loop-1",
        nickname: "子",
        grade: 2,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await db
      .insert(schema.uploadedMaterials)
      .values({
        id: "m-loop-1",
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
      .insert(schema.problems)
      .values({
        id: PROBLEM,
        childId: CHILD,
        materialId: "m-loop-1",
        problemText: "1L は なんmL ですか？",
        correctAnswer: "1000mL",
        unit: "水のかさ",
        subUnit: "LとmL",
        difficulty: "standard",
        explanationJson: JSON.stringify({ mistakeType: "unit_conversion_error", hint1: "h1" }),
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await db
      .insert(schema.generatedSimilarProblems)
      .values({
        id: SIMILAR,
        sourceProblemId: PROBLEM,
        childId: CHILD,
        problemText: "2L は なんmL ですか？",
        unit: "水のかさ",
        subUnit: "LとmL",
        difficulty: "standard",
        answer: "2000mL",
        explanation: "1Lは1000mLだよ。",
        choices: JSON.stringify(SIMILAR_CHOICES),
        createdAt: now,
      })
      .run();

    await db
      .insert(schema.learningSessions)
      .values({
        id: SESSION,
        childId: CHILD,
        startedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await db
      .insert(schema.problemHintViews)
      .values({
        childId: CHILD,
        problemId: PROBLEM,
        sessionId: SESSION,
        maxLevel: 2,
        updatedAt: now,
      })
      .run();
  });

  it("wrong first attempt: inherits AI mistakeType, recomputes the unit, creates a stage-1 review", async () => {
    const { POST } = await import("@/app/api/attempts/route");

    const response = await POST(
      post("/api/attempts", {
        childId: CHILD,
        sessionId: SESSION,
        problemId: PROBLEM,
        childAnswer: "100mL",
        answerType: "text",
        hintLevelUsed: 4,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);

    const attempts = await db.select().from(schema.attempts).where(eq(schema.attempts.childId, CHILD)).all();
    expect(attempts).toHaveLength(1);
    expect(Boolean(attempts[0].isCorrect)).toBe(false);
    expect(attempts[0].mistakeType).toBe("unit_conversion_error");
    // hint_level_used はクライアント値(4)ではなく problem_hint_views の max_level(2)
    expect(attempts[0].hintLevelUsed).toBe(2);

    expect(body.data.hint_level_used).toBe(2);
    expect(body.data.explanation).toBeNull();
    expect(JSON.stringify(body)).not.toContain("1000mL");

    const review = await db
      .select()
      .from(schema.reviewSchedule)
      .where(and(eq(schema.reviewSchedule.childId, CHILD), eq(schema.reviewSchedule.problemId, PROBLEM)))
      .get();
    expect(review?.reviewStage).toBe(1);
    expect(review?.status).toBe("pending");
    expect(review?.scheduledFor).toBe(addDaysJst(todayKeyJst(), 1));

    expect(body.data.mastery_level).toBe("learning");
    expect(body.data.review.action).toBe("created");
  });

  it("second wrong attempt while a review is pending does not create another review", async () => {
    const now = nowJstIso();
    await db
      .insert(schema.reviewSchedule)
      .values({
        id: REVIEW,
        childId: CHILD,
        problemId: PROBLEM,
        unit: "水のかさ",
        subUnit: "LとmL",
        reviewStage: 1,
        status: "pending",
        scheduledFor: addDaysJst(todayKeyJst(), 1),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const { POST } = await import("@/app/api/attempts/route");

    const response = await POST(
      post("/api/attempts", {
        childId: CHILD,
        sessionId: SESSION,
        problemId: PROBLEM,
        childAnswer: "10mL",
        answerType: "text",
      }),
    );

    expect(response.status).toBe(201);
    const reviews = await db.select().from(schema.reviewSchedule).where(eq(schema.reviewSchedule.childId, CHILD)).all();
    expect(reviews).toHaveLength(1);
    expect((await response.json()).data.review).toEqual({ action: "none" });
  });

  it("correct attempt on a review due today marks it done and keeps the request mistakeType null", async () => {
    const now = nowJstIso();
    await db
      .insert(schema.reviewSchedule)
      .values({
        id: REVIEW,
        childId: CHILD,
        problemId: PROBLEM,
        unit: "水のかさ",
        subUnit: "LとmL",
        reviewStage: 1,
        status: "pending",
        scheduledFor: todayKeyJst(),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const { POST } = await import("@/app/api/attempts/route");

    const response = await POST(
      post("/api/attempts", {
        childId: CHILD,
        sessionId: SESSION,
        problemId: PROBLEM,
        childAnswer: "1000 mL",
        answerType: "voice",
        mistakeType: "careless_error",
      }),
    );

    expect(response.status).toBe(201);
    const updatedReview = await db
      .select()
      .from(schema.reviewSchedule)
      .where(eq(schema.reviewSchedule.id, REVIEW))
      .get();
    expect(updatedReview?.status).toBe("done");
    expect((await response.json()).data.review).toEqual({ action: "completed", reviewId: REVIEW });
  });

  it("similar-problem attempt recomputes the same unit and inherits the source problem's mistakeType", async () => {
    const { POST } = await import("@/app/api/attempts/route");

    const response = await POST(
      post("/api/attempts", {
        childId: CHILD,
        sessionId: SESSION,
        similarProblemId: SIMILAR,
        childAnswer: "200mL",
        answerType: "tap",
      }),
    );

    expect(response.status).toBe(201);
    const att = await db
      .select()
      .from(schema.attempts)
      .where(eq(schema.attempts.similarProblemId, SIMILAR))
      .get();
    expect(att?.mistakeType).toBe("unit_conversion_error");
    expect(att?.hintLevelUsed).toBe(0);

    const body = await response.json();
    expect(body.data.is_correct).toBe(false);
    expect(body.data.explanation).toBe("1Lは1000mLだよ。");
  });

  it("similar-problem tap answers must be one of the stored choices", async () => {
    const { POST } = await import("@/app/api/attempts/route");

    const response = await POST(
      post("/api/attempts", {
        childId: CHILD,
        sessionId: SESSION,
        similarProblemId: SIMILAR,
        childAnswer: "2001mL",
        answerType: "tap",
      }),
    );

    expect(response.status).toBe(400);
  });

  it("a correct similar-problem answer returns no explanation", async () => {
    const { POST } = await import("@/app/api/attempts/route");

    const response = await POST(
      post("/api/attempts", {
        childId: CHILD,
        sessionId: SESSION,
        similarProblemId: SIMILAR,
        childAnswer: "2000mL",
        answerType: "tap",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.is_correct).toBe(true);
    expect(body.data.explanation).toBeNull();
  });

  it("typed similar-problem answers are accepted when the problem has no choices", async () => {
    await db
      .update(schema.generatedSimilarProblems)
      .set({ choices: null, answer: "3L50mL" })
      .where(eq(schema.generatedSimilarProblems.id, SIMILAR))
      .run();

    const { POST } = await import("@/app/api/attempts/route");

    const response = await POST(
      post("/api/attempts", {
        childId: CHILD,
        sessionId: SESSION,
        similarProblemId: SIMILAR,
        childAnswer: "3L50mL",
        answerType: "text",
      }),
    );
    expect(response.status).toBe(201);
    expect((await response.json()).data.is_correct).toBe(true);
  });
});

describe("learning loop: reviews schedule", () => {
  const db = getDb();
  const scheduleBody = { childId: CHILD, problemId: PROBLEM, sessionId: SESSION };

  beforeEach(async () => {
    const now = nowJstIso();

    await db.delete(schema.attempts).run();
    await db.delete(schema.reviewSchedule).run();
    await db.delete(schema.weaknessMap).run();
    await db.delete(schema.generatedSimilarProblems).run();
    await db.delete(schema.problems).run();
    await db.delete(schema.learningSessions).run();
    await db.delete(schema.uploadedMaterials).run();
    await db.delete(schema.childProfiles).run();

    await db
      .insert(schema.users)
      .values({
        id: "user-loop-1",
        name: "parent",
        email: "user-loop-1@example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing()
      .run();

    await db
      .insert(schema.childProfiles)
      .values({
        id: CHILD,
        userId: "user-loop-1",
        nickname: "子",
        grade: 2,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await db
      .insert(schema.uploadedMaterials)
      .values({
        id: "m-loop-1",
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
      .insert(schema.problems)
      .values({
        id: PROBLEM,
        childId: CHILD,
        materialId: "m-loop-1",
        problemText: "1L は なんmL ですか？",
        correctAnswer: "1000mL",
        unit: "水のかさ",
        subUnit: "LとmL",
        difficulty: "standard",
        explanationJson: "{}",
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await db
      .insert(schema.learningSessions)
      .values({
        id: SESSION,
        childId: CHILD,
        startedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  });

  const setupSimilarAndAttempts = async (similarCorrectCount: number, originalCorrect: boolean | null) => {
    const now = nowJstIso();

    for (let i = 0; i < 5; i++) {
      await db
        .insert(schema.generatedSimilarProblems)
        .values({
          id: `sim-${i}`,
          sourceProblemId: PROBLEM,
          childId: CHILD,
          problemText: `sim text ${i}`,
          unit: "水のかさ",
          subUnit: "LとmL",
          difficulty: "standard",
          answer: "ans",
          explanation: "exp",
          createdAt: now,
        })
        .run();

      await db
        .insert(schema.attempts)
        .values({
          id: `att-sim-${i}`,
          sessionId: SESSION,
          childId: CHILD,
          problemId: null,
          similarProblemId: `sim-${i}`,
          childAnswer: "ans",
          answerType: "tap",
          isCorrect: i < similarCorrectCount ? 1 : 0,
          createdAt: now,
        })
        .run();
    }

    if (originalCorrect !== null) {
      await db
        .insert(schema.attempts)
        .values({
          id: "att-orig",
          sessionId: SESSION,
          childId: CHILD,
          problemId: PROBLEM,
          similarProblemId: null,
          childAnswer: originalCorrect ? "1000mL" : "10mL",
          answerType: "text",
          isCorrect: originalCorrect ? 1 : 0,
          createdAt: now,
        })
        .run();
    }
  };

  it.each([
    [4, 1, 2, 3, "mastered"],
    [5, 1, 2, 7, "mastered"],
    [5, 2, 3, 7, "mastered"],
    [5, 3, 3, 7, "mastered"],
    [3, 2, 2, 1, "learning"],
    [0, 3, 3, 1, "learning"],
  ])(
    "schedule: %i/5 (derived from attempts) from stage %i → stage %i after %i days, mastery %s",
    async (similarCorrectCount, currentStage, expectedStage, days, mastery) => {
      const now = nowJstIso();
      await setupSimilarAndAttempts(similarCorrectCount, null);

      await db
        .insert(schema.reviewSchedule)
        .values({
          id: REVIEW,
          childId: CHILD,
          problemId: PROBLEM,
          unit: "水のかさ",
          subUnit: "LとmL",
          reviewStage: currentStage,
          status: "pending",
          scheduledFor: todayKeyJst(),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const { POST } = await import("@/app/api/reviews/schedule/route");
      const response = await POST(post("/api/reviews/schedule", { ...scheduleBody, similarCorrectCount: 5 }));

      expect(response.status).toBe(200);

      const review = await db
        .select()
        .from(schema.reviewSchedule)
        .where(eq(schema.reviewSchedule.id, REVIEW))
        .get();
      expect(review?.reviewStage).toBe(expectedStage);
      expect(review?.scheduledFor).toBe(addDaysJst(todayKeyJst(), days));
      expect(review?.status).toBe("pending");

      const body = await response.json();
      expect(body.data.mastery_level).toBe(mastery);
      expect(body.data.scheduled).toBe(true);
      expect(body.data.similar_correct_count).toBe(similarCorrectCount);
    },
  );

  it("schedule: 5/5 with no existing review and a correct original creates no review row", async () => {
    await setupSimilarAndAttempts(5, true);

    const { POST } = await import("@/app/api/reviews/schedule/route");
    const response = await POST(post("/api/reviews/schedule", scheduleBody));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.scheduled).toBe(false);
    expect(body.data.mastery_level).toBe("mastered");

    const reviews = await db.select().from(schema.reviewSchedule).where(eq(schema.reviewSchedule.childId, CHILD)).all();
    expect(reviews).toHaveLength(0);
  });

  it("schedule: no original attempt at all creates no review row", async () => {
    await setupSimilarAndAttempts(4, null);

    const { POST } = await import("@/app/api/reviews/schedule/route");
    const response = await POST(post("/api/reviews/schedule", scheduleBody));

    expect((await response.json()).data.scheduled).toBe(false);
    const reviews = await db.select().from(schema.reviewSchedule).where(eq(schema.reviewSchedule.childId, CHILD)).all();
    expect(reviews).toHaveLength(0);
  });

  it("schedule: a wrong original with no existing review creates the review (stage 1 → 3 days on 4/5)", async () => {
    await setupSimilarAndAttempts(4, false);

    const { POST } = await import("@/app/api/reviews/schedule/route");
    const response = await POST(post("/api/reviews/schedule", scheduleBody));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.scheduled).toBe(true);

    const review = await db
      .select()
      .from(schema.reviewSchedule)
      .where(and(eq(schema.reviewSchedule.childId, CHILD), eq(schema.reviewSchedule.problemId, PROBLEM)))
      .get();
    expect(review?.reviewStage).toBe(2);
    expect(review?.status).toBe("pending");
    expect(review?.scheduledFor).toBe(addDaysJst(todayKeyJst(), 3));
  });

  it("schedule: 3/5 demotes mastered explicitly", async () => {
    const now = nowJstIso();
    await setupSimilarAndAttempts(3, null);

    await db
      .insert(schema.reviewSchedule)
      .values({
        id: REVIEW,
        childId: CHILD,
        problemId: PROBLEM,
        unit: "水のかさ",
        subUnit: "LとmL",
        reviewStage: 1,
        status: "pending",
        scheduledFor: todayKeyJst(),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await db
      .insert(schema.weaknessMap)
      .values({
        id: "w-map-1",
        childId: CHILD,
        unit: "水のかさ",
        subUnit: "LとmL",
        accuracyRate: 0.8,
        mistakeCount: 2,
        masteryLevel: "mastered",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const { POST } = await import("@/app/api/reviews/schedule/route");
    const response = await POST(post("/api/reviews/schedule", scheduleBody));

    expect((await response.json()).data.mastery_level).toBe("reviewing");

    const w = await db
      .select()
      .from(schema.weaknessMap)
      .where(and(eq(schema.weaknessMap.childId, CHILD), eq(schema.weaknessMap.unit, "水のかさ")))
      .get();
    expect(w?.masteryLevel).toBe("reviewing");
  });

  it("schedule: rejects a session the child does not own and requires sessionId", async () => {
    const { POST } = await import("@/app/api/reviews/schedule/route");

    expect(
      (
        await POST(
          post("/api/reviews/schedule", {
            ...scheduleBody,
            sessionId: "99999999-9999-4999-8999-999999999999",
          }),
        )
      ).status,
    ).toBe(404);
    expect(
      (await POST(post("/api/reviews/schedule", { childId: CHILD, problemId: PROBLEM }))).status,
    ).toBe(400);
  });
});

describe("learning loop: sessions", () => {
  const db = getDb();

  beforeEach(async () => {
    const now = nowJstIso();

    await db.delete(schema.attempts).run();
    await db.delete(schema.learningSessions).run();
    await db.delete(schema.appSettings).run();
    await db.delete(schema.childProfiles).run();

    await db
      .insert(schema.users)
      .values({
        id: "user-loop-1",
        name: "parent",
        email: "user-loop-1@example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing()
      .run();

    await db
      .insert(schema.childProfiles)
      .values({
        id: CHILD,
        userId: "user-loop-1",
        nickname: "子",
        grade: 2,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await db
      .insert(schema.appSettings)
      .values({
        id: "set-sess",
        childId: CHILD,
        dailyLimitMinutes: 10,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  });

  it("GET /api/sessions counts open sessions by elapsed time and finished sessions by duration", async () => {
    const startedAt = new Date(Date.now() - 4 * 60_000).toISOString();
    const now = nowJstIso();

    await db.insert(schema.learningSessions).values([
      {
        id: "open",
        childId: CHILD,
        startedAt,
        endedAt: null,
        durationSeconds: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "done",
        childId: CHILD,
        startedAt,
        endedAt: startedAt,
        durationSeconds: 300,
        createdAt: now,
        updatedAt: now,
      },
    ]).run();

    const { GET } = await import("@/app/api/sessions/route");
    const response = await GET(new Request(`http://localhost/api/sessions?childId=${CHILD}`));
    const body = await response.json();

    expect(body.data).toEqual({ limitMinutes: 10, usedMinutes: 9, remainingMinutes: 1, limitReached: false });
  });

  it("POST /api/sessions refuses to start once the limit is reached", async () => {
    const now = nowJstIso();
    await db.insert(schema.learningSessions).values({
      id: "done",
      childId: CHILD,
      startedAt: now,
      endedAt: now,
      durationSeconds: 600, // 10分 (制限一杯)
      createdAt: now,
      updatedAt: now,
    }).run();

    const { POST } = await import("@/app/api/sessions/route");
    const response = await POST(post("/api/sessions", { childId: CHILD }));
    expect((await response.json()).data.limitReached).toBe(true);
  });

  it("PATCH /api/sessions/[id] clamps duration to server time and derives counts from attempts", async () => {
    const startedAt = new Date(Date.now() - 90_000).toISOString();
    const now = nowJstIso();

    await db.insert(schema.learningSessions).values({
      id: SESSION,
      childId: CHILD,
      startedAt,
      endedAt: null,
      createdAt: now,
      updatedAt: now,
    }).run();

    await db.insert(schema.attempts).values([
      { id: "a1", sessionId: SESSION, childId: CHILD, childAnswer: "1", answerType: "text", isCorrect: 1, createdAt: now },
      { id: "a2", sessionId: SESSION, childId: CHILD, childAnswer: "2", answerType: "text", isCorrect: 0, createdAt: now },
      { id: "a3", sessionId: SESSION, childId: CHILD, childAnswer: "3", answerType: "text", isCorrect: 1, createdAt: now },
    ]).run();

    const { PATCH } = await import("@/app/api/sessions/[id]/route");

    const response = await PATCH(
      new Request(`http://localhost/api/sessions/${SESSION}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ childId: CHILD, durationSeconds: 3600, totalQuestions: 99, correctCount: 99 }),
      }),
      { params: Promise.resolve({ id: SESSION }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    const sess = await db.select().from(schema.learningSessions).where(eq(schema.learningSessions.id, SESSION)).get();
    expect(sess?.totalQuestions).toBe(3);
    expect(sess?.correctCount).toBe(2);
    expect(sess?.durationSeconds).toBeGreaterThanOrEqual(89);
    expect(sess?.durationSeconds).toBeLessThanOrEqual(92);
    expect(body.data.correct_count).toBe(2);
  });
});

describe("learning loop: repeated mistakes lower similar-problem difficulty", () => {
  const db = getDb();

  beforeEach(async () => {
    const now = nowJstIso();

    await db.delete(schema.attempts).run();
    await db.delete(schema.generatedSimilarProblems).run();
    await db.delete(schema.problems).run();
    await db.delete(schema.learningSessions).run();
    await db.delete(schema.uploadedMaterials).run();
    await db.delete(schema.childProfiles).run();

    await db
      .insert(schema.users)
      .values({
        id: "user-loop-1",
        name: "parent",
        email: "user-loop-1@example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing()
      .run();

    await db
      .insert(schema.childProfiles)
      .values({
        id: CHILD,
        userId: "user-loop-1",
        nickname: "子",
        grade: 2,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await db
      .insert(schema.uploadedMaterials)
      .values({
        id: "m-loop-1",
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
      .insert(schema.problems)
      .values({
        id: PROBLEM,
        childId: CHILD,
        materialId: "m-loop-1",
        problemText: "1L は なんmL ですか？",
        correctAnswer: "1000mL",
        unit: "水のかさ",
        subUnit: "LとmL",
        difficulty: "standard",
        explanationJson: JSON.stringify({ mistakeType: "unit_conversion_error" }),
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await db
      .insert(schema.learningSessions)
      .values({
        id: SESSION,
        childId: CHILD,
        startedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  });

  it("passes one difficulty lower and the repeated mistakeType to the provider", async () => {

    // 直近2回の同一ミス (unit_conversion_error) をセットアップ
    await db.insert(schema.attempts).values([
      {
        id: "att-hist-1",
        sessionId: SESSION,
        childId: CHILD,
        problemId: PROBLEM,
        childAnswer: "1",
        answerType: "text",
        mistakeType: "unit_conversion_error",
        isCorrect: 0,
        createdAt: new Date(Date.now() - 2000).toISOString(),
      },
      {
        id: "att-hist-2",
        sessionId: SESSION,
        childId: CHILD,
        problemId: PROBLEM,
        childAnswer: "2",
        answerType: "text",
        mistakeType: "unit_conversion_error",
        isCorrect: 0,
        createdAt: new Date(Date.now() - 1000).toISOString(),
      },
    ]).run();

    const generate = vi.fn(async (input: { difficulty: string; unit: string; subUnit: string }) =>
      Array.from({ length: 5 }, (_, index) => ({
        problemText: `もんだい ${index + 1}`,
        answer: `${index + 1}L`,
        unit: input.unit,
        subUnit: input.subUnit,
        difficulty: input.difficulty,
        explanation: "せつめい",
      })),
    );

    vi.doMock("@/lib/ai", () => ({
      getAiProvider: () => ({ name: "mock", generateSimilarProblems: generate }),
    }));

    const { POST } = await import("@/app/api/ai/generate-similar-problems/route");

    const response = await POST(
      post("/api/ai/generate-similar-problems", { childId: CHILD, problemId: PROBLEM }),
    );

    expect(response.status).toBe(201);
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        difficulty: "basic",
        mistakeType: "unit_conversion_error",
        unit: "水のかさ",
      }),
    );

    const inserted = await db
      .select()
      .from(schema.generatedSimilarProblems)
      .where(eq(schema.generatedSimilarProblems.sourceProblemId, PROBLEM))
      .all();
    expect(inserted).toHaveLength(5);
    for (const row of inserted) {
      const choices = JSON.parse(row.choices ?? "[]");
      expect(choices).toHaveLength(4);
      expect(choices).toContain(row.answer);
      expect(new Set(choices).size).toBe(4);
    }

    vi.doUnmock("@/lib/ai");
  });
});
