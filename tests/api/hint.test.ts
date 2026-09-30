import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nowJstIso } from "@/lib/utils/date";

const CHILD = "11111111-1111-4111-8111-111111111111";
const SESSION = "22222222-2222-4222-8222-222222222222";
const PROBLEM = "33333333-3333-4333-8333-333333333333";

vi.mock("@/lib/utils/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/utils/api")>();
  return {
    ...original,
    requireOwnedChild: vi.fn(async () => ({
      db: getDb(),
      user: { id: "user-hint-1" },
      response: null,
    })),
  };
});

const post = (path: string, body: unknown, cookie?: string) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });

const context = (id: string) => ({ params: Promise.resolve({ id }) });

describe("POST /api/problems/[id]/hint (staged reveal)", () => {
  const db = getDb();

  beforeEach(async () => {
    const now = nowJstIso();

    await db.delete(schema.problemHintViews).run();
    await db.delete(schema.attempts).run();
    await db.delete(schema.learningSessions).run();
    await db.delete(schema.problems).run();
    await db.delete(schema.uploadedMaterials).run();
    await db.delete(schema.childProfiles).run();

    await db
      .insert(schema.users)
      .values({
        id: "user-hint-1",
        name: "parent",
        email: "user-hint-1@example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing()
      .run();

    await db
      .insert(schema.childProfiles)
      .values({
        id: CHILD,
        userId: "user-hint-1",
        nickname: "子",
        grade: 2,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await db
      .insert(schema.uploadedMaterials)
      .values({
        id: "m-hint",
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
        materialId: "m-hint",
        problemText: "1L は なんmL ですか？",
        correctAnswer: "1000mL",
        unit: "水のかさ",
        subUnit: "LとmL",
        explanationJson: JSON.stringify({
          hint1: "h1",
          hint2: "h2",
          solution: "s",
          answer: "1000mL",
          praise: "p",
        }),
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

  it("returns only hint 1 the first time and records max_level=1", async () => {
    const { POST } = await import("@/app/api/problems/[id]/hint/route");

    const response = await POST(
      post(`/api/problems/${PROBLEM}/hint`, { childId: CHILD, sessionId: SESSION, level: 1 }),
      context(PROBLEM),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ level: 1, label: "ヒント 1", text: "h1", maxLevel: 1 });
    expect(JSON.stringify(body)).not.toContain("1000mL");
    expect(JSON.stringify(body)).not.toContain("h2");

    const view = await db
      .select()
      .from(schema.problemHintViews)
      .where(eq(schema.problemHintViews.problemId, PROBLEM))
      .get();
    expect(view?.maxLevel).toBe(1);
  });

  it("refuses to skip ahead (level 3 when only level 1 is open) and records nothing", async () => {
    const now = nowJstIso();
    await db
      .insert(schema.problemHintViews)
      .values({
        childId: CHILD,
        problemId: PROBLEM,
        sessionId: SESSION,
        maxLevel: 1,
        updatedAt: now,
      })
      .run();

    const { POST } = await import("@/app/api/problems/[id]/hint/route");

    const response = await POST(
      post(`/api/problems/${PROBLEM}/hint`, { childId: CHILD, sessionId: SESSION, level: 3 }),
      context(PROBLEM),
    );

    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).not.toContain("1000mL");
  });

  it("returns the answer only at level 4 after level 3 is open", async () => {
    const now = nowJstIso();
    await db
      .insert(schema.problemHintViews)
      .values({
        childId: CHILD,
        problemId: PROBLEM,
        sessionId: SESSION,
        maxLevel: 3,
        updatedAt: now,
      })
      .run();

    const { POST } = await import("@/app/api/problems/[id]/hint/route");

    const response = await POST(
      post(`/api/problems/${PROBLEM}/hint`, { childId: CHILD, sessionId: SESSION, level: 4 }),
      context(PROBLEM),
    );
    const body = await response.json();

    expect(body.data).toEqual({ level: 4, label: "こたえ", text: "1000mL", maxLevel: 4 });

    const view = await db
      .select()
      .from(schema.problemHintViews)
      .where(eq(schema.problemHintViews.problemId, PROBLEM))
      .get();
    expect(view?.maxLevel).toBe(4);
  });

  it("re-reading an already open level does not lower max_level", async () => {
    const now = nowJstIso();
    await db
      .insert(schema.problemHintViews)
      .values({
        childId: CHILD,
        problemId: PROBLEM,
        sessionId: SESSION,
        maxLevel: 3,
        updatedAt: now,
      })
      .run();

    const { POST } = await import("@/app/api/problems/[id]/hint/route");

    const body = await (
      await POST(
        post(`/api/problems/${PROBLEM}/hint`, { childId: CHILD, sessionId: SESSION, level: 2 }),
        context(PROBLEM),
      )
    ).json();

    expect(body.data).toMatchObject({ level: 2, text: "h2", maxLevel: 3 });

    const view = await db
      .select()
      .from(schema.problemHintViews)
      .where(eq(schema.problemHintViews.problemId, PROBLEM))
      .get();
    expect(view?.maxLevel).toBe(3);
  });

  it("falls back to the correct_answer column when explanation_json has no answer", async () => {
    const now = nowJstIso();
    await db
      .update(schema.problems)
      .set({ explanationJson: "{}" })
      .where(eq(schema.problems.id, PROBLEM))
      .run();

    await db
      .insert(schema.problemHintViews)
      .values({
        childId: CHILD,
        problemId: PROBLEM,
        sessionId: SESSION,
        maxLevel: 3,
        updatedAt: now,
      })
      .run();

    const { POST } = await import("@/app/api/problems/[id]/hint/route");

    const body = await (
      await POST(
        post(`/api/problems/${PROBLEM}/hint`, { childId: CHILD, sessionId: SESSION, level: 4 }),
        context(PROBLEM),
      )
    ).json();
    expect(body.data.text).toBe("1000mL");
  });

  it.each([
    [{ childId: CHILD, sessionId: SESSION, level: 0 }],
    [{ childId: CHILD, sessionId: SESSION, level: 5 }],
    [{ childId: CHILD, level: 1 }],
    [{ childId: CHILD, sessionId: SESSION, level: "1" }],
  ])("rejects invalid input %j", async (payload) => {
    const { POST } = await import("@/app/api/problems/[id]/hint/route");
    expect(
      (await POST(post(`/api/problems/${PROBLEM}/hint`, payload), context(PROBLEM))).status,
    ).toBe(400);
  });

  it("returns 404 for a session or problem the child does not own", async () => {
    const { POST } = await import("@/app/api/problems/[id]/hint/route");
    expect(
      (
        await POST(
          post(`/api/problems/${PROBLEM}/hint`, {
            childId: CHILD,
            sessionId: "99999999-9999-4999-8999-999999999999",
            level: 1,
          }),
          context(PROBLEM),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await POST(
          post("/api/problems/not-a-uuid/hint", { childId: CHILD, sessionId: SESSION, level: 1 }),
          context("not-a-uuid"),
        )
      ).status,
    ).toBe(404);
  });
});

describe("POST /api/problems/[id]/hint (demo without database)", () => {
  it("serves the mock problem one level at a time and tracks the level in a cookie", async () => {
    const { POST } = await import("@/app/api/problems/[id]/hint/route");
    const first = await POST(post("/api/problems/volume-1/hint", { level: 1 }), context("volume-1"));
    const firstBody = await first.json();

    expect(first.status).toBe(200);
    expect(firstBody.data).toMatchObject({ level: 1, text: "1Lの中には、100mLがいくつあるかな。", maxLevel: 1 });
    expect(JSON.stringify(firstBody)).not.toContain("1000mL");
    expect(first.headers.get("set-cookie")).toContain("kanoha_demo_hint=volume-1%3A1");

    const skip = await POST(
      post("/api/problems/volume-1/hint", { level: 3 }, "kanoha_demo_hint=volume-1%3A1"),
      context("volume-1"),
    );
    expect(skip.status).toBe(400);

    const answer = await POST(
      post("/api/problems/volume-1/hint", { level: 4 }, "kanoha_demo_hint=volume-1%3A3"),
      context("volume-1"),
    );
    expect((await answer.json()).data).toMatchObject({ level: 4, text: "1000mL" });
  });

  it("returns 404 for unknown demo ids", async () => {
    const { POST } = await import("@/app/api/problems/[id]/hint/route");
    expect((await POST(post("/api/problems/other/hint", { level: 1 }), context("other"))).status).toBe(404);
  });
});
