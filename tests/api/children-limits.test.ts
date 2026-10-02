import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nowJstIso } from "@/lib/utils/date";

const state = vi.hoisted(() => ({
  rateLimitAllowed: true,
}));

vi.mock("@/lib/utils/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/utils/api")>();
  return {
    ...original,
    requireUser: vi.fn(async () => ({ user: { id: "user-limit-1" }, db: getDb() })),
  };
});

vi.mock("@/lib/utils/rateLimit", () => ({
  checkRateLimit: () => true,
  checkRateLimitDb: vi.fn(async () => state.rateLimitAllowed),
}));

const post = (body: unknown) =>
  new Request("http://localhost/api/children", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const input = { nickname: "はな", grade: 2, readingMode: "hiragana" };

const loadRoute = async () => (await import("@/app/api/children/route")).POST;

describe("POST /api/children (rate limit + profile cap)", () => {
  const db = getDb();

  beforeEach(async () => {
    state.rateLimitAllowed = true;
    const now = nowJstIso();

    await db
      .insert(schema.users)
      .values({
        id: "user-limit-1",
        name: "parent",
        email: "user-limit-1@example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing()
      .run();

    await db
      .delete(schema.childProfiles)
      .where(eq(schema.childProfiles.userId, "user-limit-1"))
      .run();
  });

  it("returns 429 when the DB rate limit rejects the call", async () => {
    state.rateLimitAllowed = false;

    const response = await (await loadRoute())(post(input));

    expect(response.status).toBe(429);
  });

  it("rejects the 9th profile with 400 (doc.md §14.2 cap of 8)", async () => {
    const now = nowJstIso();
    // 既存の8人を作成
    for (let i = 0; i < 8; i++) {
      await db.insert(schema.childProfiles).values({
        id: `child-${i}`,
        userId: "user-limit-1",
        nickname: `子${i}`,
        grade: 2,
        createdAt: now,
        updatedAt: now,
      }).run();
    }

    const response = await (await loadRoute())(post(input));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Child profile limit reached");
  });

  it("creates the profile when under the cap", async () => {
    const now = nowJstIso();
    // 既存の7人を作成
    for (let i = 0; i < 7; i++) {
      await db.insert(schema.childProfiles).values({
        id: `child-${i}`,
        userId: "user-limit-1",
        nickname: `子${i}`,
        grade: 2,
        createdAt: now,
        updatedAt: now,
      }).run();
    }

    const response = await (await loadRoute())(post(input));

    expect(response.status).toBe(201);
  });
});
