import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nowJstIso, todayKeyJst } from "@/lib/utils/date";

const CHILD = "11111111-1111-4111-8111-111111111111";

const state = vi.hoisted(() => ({
  rateLimitAllowed: true,
  sent: [] as string[],
  sendError: false,
}));

vi.mock("@/lib/utils/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/utils/api")>();
  return {
    ...original,
    requireOwnedChild: vi.fn(async () => ({
      db: getDb(),
      user: { id: "user-slack-1" },
      response: null,
    })),
  };
});

vi.mock("@/lib/utils/rateLimit", () => ({
  checkRateLimit: () => true,
  checkRateLimitDb: vi.fn(async () => state.rateLimitAllowed),
}));

vi.mock("@/lib/slack/sendReport", () => ({
  sendSlackReport: vi.fn(async (_url: string, message: string) => {
    if (state.sendError) throw new Error("Slack delivery failed");
    state.sent.push(message);
  }),
}));

const post = (body: unknown) =>
  new Request("http://localhost/api/reports/slack", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const loadRoute = async () => (await import("@/app/api/reports/slack/route")).POST;

describe("POST /api/reports/slack (real daily report)", () => {
  const db = getDb();

  beforeEach(async () => {
    state.rateLimitAllowed = true;
    state.sent = [];
    state.sendError = false;

    const now = nowJstIso();

    // 関連テーブル初期化
    await db.delete(schema.parentReports).where(eq(schema.parentReports.childId, CHILD)).run();
    await db.delete(schema.attempts).where(eq(schema.attempts.childId, CHILD)).run();
    await db.delete(schema.learningSessions).where(eq(schema.learningSessions.childId, CHILD)).run();
    await db.delete(schema.weaknessMap).where(eq(schema.weaknessMap.childId, CHILD)).run();
    await db.delete(schema.problems).where(eq(schema.problems.childId, CHILD)).run();
    await db.delete(schema.appSettings).where(eq(schema.appSettings.childId, CHILD)).run();
    await db.delete(schema.uploadedMaterials).where(eq(schema.uploadedMaterials.childId, CHILD)).run();
    await db.delete(schema.childProfiles).where(eq(schema.childProfiles.id, CHILD)).run();

    await db
      .insert(schema.users)
      .values({
        id: "user-slack-1",
        name: "parent",
        email: "user-slack-1@example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing()
      .run();

    await db
      .insert(schema.childProfiles)
      .values({
        id: CHILD,
        userId: "user-slack-1",
        nickname: "子",
        grade: 2,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await db
      .insert(schema.uploadedMaterials)
      .values({
        id: "m-slack",
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
        id: "p1",
        childId: CHILD,
        materialId: "m-slack",
        problemText: "3+9は？",
        subject: "math",
        grade: 2,
        unit: "たし算",
        subUnit: "くり上がり",
        difficulty: "standard",
        correctAnswer: "12",
        explanationJson: "{}",
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await db
      .insert(schema.appSettings)
      .values({
        id: "set-slack",
        childId: CHILD,
        enableSlack: 1,
        slackWebhookUrl: "https://hooks.slack.com/services/a/b/c",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await db
      .insert(schema.learningSessions)
      .values({
        id: "sess-slack",
        childId: CHILD,
        startedAt: now,
        durationSeconds: 600,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await db
      .insert(schema.attempts)
      .values([
        {
          id: "att-slack-1",
          sessionId: "sess-slack",
          childId: CHILD,
          problemId: "p1",
          similarProblemId: null,
          childAnswer: "12",
          answerType: "keypad",
          hintLevelUsed: 1,
          isCorrect: 1,
          createdAt: now,
        },
        {
          id: "att-slack-2",
          sessionId: "sess-slack",
          childId: CHILD,
          problemId: "p1",
          similarProblemId: null,
          childAnswer: "11",
          answerType: "keypad",
          mistakeType: "carry_error",
          hintLevelUsed: 0,
          isCorrect: 0,
          createdAt: now,
        },
      ])
      .run();

    await db
      .insert(schema.weaknessMap)
      .values({
        id: "w-slack",
        childId: CHILD,
        unit: "たし算",
        subUnit: "くり上がり",
        accuracyRate: 0.5,
        mistakeCount: 1,
        masteryLevel: "learning",
        createdAt: now,
        updatedAt: now,
      })
      .run();
  });

  it("builds the report from real aggregates, saves it, and sends the §17 message", async () => {
    const response = await (await loadRoute())(post({ childId: CHILD }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ sent: true, alreadySent: false });

    const saved = await db
      .select()
      .from(schema.parentReports)
      .where(eq(schema.parentReports.childId, CHILD))
      .get();

    expect(saved).toBeDefined();
    expect(saved?.accuracyRate).toBe(0.5);
    expect(JSON.parse(saved?.weakUnits ?? "[]")).toEqual(["たし算・くり上がり"]);

    expect(state.sent).toHaveLength(1);
    expect(state.sent[0]).toContain("学習時間:10分");
    expect(state.sent[0]).toContain("正答率:1/2");
    expect(state.sent[0]).toContain("・たし算・くり上がり");
  });

  it("returns 429 when the DB rate limit rejects the call", async () => {
    state.rateLimitAllowed = false;

    const response = await (await loadRoute())(post({ childId: CHILD }));

    expect(response.status).toBe(429);
    expect(state.sent).toHaveLength(0);
  });

  it("does not send twice for the same day", async () => {
    const today = todayKeyJst();
    const now = nowJstIso();

    await db
      .insert(schema.parentReports)
      .values({
        id: "rep-done",
        childId: CHILD,
        reportDate: today,
        summary: "test",
        accuracyRate: 1,
        weakUnits: "[]",
        growthPoints: "[]",
        nextRecommendations: "[]",
        slackSentAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const response = await (await loadRoute())(post({ childId: CHILD }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ sent: false, alreadySent: true });
    expect(state.sent).toHaveLength(0);
  });

  it("releases the claim and returns 502 when Slack delivery fails", async () => {
    state.sendError = true;

    const response = await (await loadRoute())(post({ childId: CHILD }));

    expect(response.status).toBe(502);

    const saved = await db
      .select()
      .from(schema.parentReports)
      .where(eq(schema.parentReports.childId, CHILD))
      .get();
    expect(saved?.slackSentAt).toBeNull();
  });
});
