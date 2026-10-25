import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  checkDbRateLimit,
  incrementAiUsage,
  purgeStaleRateLimits,
  reserveDailyBudget,
} from "@/lib/db/operations";
import * as schema from "@/lib/db/schema";

const USER_A = "user-ops-a";
const USER_B = "user-ops-b";

describe("checkDbRateLimit (real DB)", () => {
  const db = getDb();

  beforeEach(async () => {
    await db.delete(schema.rateLimits).run();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to the limit and denies after", async () => {
    const results = [];
    for (let i = 0; i < 4; i += 1) results.push(await checkDbRateLimit("k:a", 3, 60));
    expect(results).toEqual([true, true, true, false]);
  });

  it("keeps separate keys independent", async () => {
    expect(await checkDbRateLimit("k:a", 1, 60)).toBe(true);
    expect(await checkDbRateLimit("k:a", 1, 60)).toBe(false);
    expect(await checkDbRateLimit("k:b", 1, 60)).toBe(true);
  });

  it("starts a new window after windowSeconds", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-25T00:00:00Z"));
    expect(await checkDbRateLimit("k:w", 1, 60)).toBe(true);
    expect(await checkDbRateLimit("k:w", 1, 60)).toBe(false);
    vi.setSystemTime(new Date("2026-10-25T00:01:01Z"));
    expect(await checkDbRateLimit("k:w", 1, 60)).toBe(true);
    expect(await checkDbRateLimit("k:w", 1, 60)).toBe(false);
  });

  it("is atomic: a parallel burst never gets more than the limit through", async () => {
    const results = await Promise.all(Array.from({ length: 30 }, () => checkDbRateLimit("k:burst", 5, 60)));
    expect(results.filter(Boolean)).toHaveLength(5);
    expect(await db.select().from(schema.rateLimits).where(eq(schema.rateLimits.limiterKey, "k:burst")).all()).toHaveLength(1);
  });

  it("purges only rows whose window ended long ago", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-20T00:00:00Z"));
    await checkDbRateLimit("k:old", 5, 60);
    vi.setSystemTime(new Date("2026-10-25T00:00:00Z"));
    await checkDbRateLimit("k:new", 5, 60);

    await purgeStaleRateLimits(db, 2 * 86_400_000);
    const keys = (await db.select().from(schema.rateLimits).all()).map((row) => row.limiterKey);
    expect(keys).toEqual(["k:new"]);
  });
});

describe("incrementAiUsage (real DB)", () => {
  const db = getDb();

  beforeEach(async () => {
    await db.delete(schema.aiDailyUsage).run();
    for (const id of [USER_A, USER_B]) {
      await db
        .insert(schema.users)
        .values({ id, name: id, email: `${id}@example.com`, createdAt: new Date(), updatedAt: new Date() })
        .onConflictDoNothing()
        .run();
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts per user: one user hitting the limit does not block another", async () => {
    expect(await incrementAiUsage(USER_A, 0.01, 1, 2)).toEqual({ allowed: true, calls: 1, costUsd: 0.01 });
    expect(await incrementAiUsage(USER_A, 0.01, 1, 2)).toEqual({ allowed: false, calls: 1, costUsd: 0.01 });
    expect(await incrementAiUsage(USER_B, 0.01, 1, 2)).toEqual({ allowed: true, calls: 1, costUsd: 0.01 });
  });

  it("denies when the cost limit would be exceeded and does not record the denied call", async () => {
    expect((await incrementAiUsage(USER_A, 0.6, 100, 1)).allowed).toBe(true);
    const denied = await incrementAiUsage(USER_A, 0.6, 100, 1);
    expect(denied).toEqual({ allowed: false, calls: 1, costUsd: 0.6 });
    expect((await incrementAiUsage(USER_A, 0.4, 100, 1)).allowed).toBe(true);
  });

  it("denies a first call that already exceeds the limits", async () => {
    expect(await incrementAiUsage(USER_A, 5, 100, 1)).toEqual({ allowed: false, calls: 0, costUsd: 0 });
    expect(await incrementAiUsage(USER_A, 0.1, 0, 1)).toEqual({ allowed: false, calls: 0, costUsd: 0 });
    expect(await db.select().from(schema.aiDailyUsage).all()).toHaveLength(0);
  });

  it("is atomic: parallel reservations never exceed the call limit", async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => incrementAiUsage(USER_A, 0.01, 3, 2)));
    expect(results.filter((result) => result.allowed)).toHaveLength(3);
    const row = await db.select().from(schema.aiDailyUsage).where(eq(schema.aiDailyUsage.userId, USER_A)).get();
    expect(row).toMatchObject({ calls: 3, costUsd: 0.03 });
  });

  it("resets at midnight JST", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-25T14:59:00Z")); // 23:59 JST
    expect((await incrementAiUsage(USER_A, 0.01, 1, 2)).allowed).toBe(true);
    expect((await incrementAiUsage(USER_A, 0.01, 1, 2)).allowed).toBe(false);
    vi.setSystemTime(new Date("2026-10-25T15:01:00Z")); // 00:01 JST next day
    expect((await incrementAiUsage(USER_A, 0.01, 1, 2)).allowed).toBe(true);
  });
});

describe("reserveDailyBudget (real DB)", () => {
  const db = getDb();

  beforeEach(async () => {
    await db.delete(schema.rateLimits).run();
  });

  it("adds the amount while it fits under the limit and refuses (without recording) once it would not", async () => {
    expect(await reserveDailyBudget("budget:a", 400, 1000, db)).toBe(true);
    expect(await reserveDailyBudget("budget:a", 400, 1000, db)).toBe(true);
    expect(await reserveDailyBudget("budget:a", 400, 1000, db)).toBe(false); // 1200 > 1000
    expect(await reserveDailyBudget("budget:a", 200, 1000, db)).toBe(true); // 1000 ちょうどは入る
    const row = await db.select().from(schema.rateLimits).where(eq(schema.rateLimits.limiterKey, "budget:a")).get();
    expect(row?.callCount).toBe(1000);
  });

  it("refuses a first amount that already exceeds the limit and keeps keys separate", async () => {
    expect(await reserveDailyBudget("budget:big", 2000, 1000, db)).toBe(false);
    expect(await db.select().from(schema.rateLimits).where(eq(schema.rateLimits.limiterKey, "budget:big")).all()).toHaveLength(0);
    expect(await reserveDailyBudget("budget:b", 900, 1000, db)).toBe(true);
    expect(await reserveDailyBudget("budget:c", 900, 1000, db)).toBe(true);
  });

  it("never lets a parallel burst exceed the limit", async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => reserveDailyBudget("budget:burst", 100, 500, db)));
    expect(results.filter(Boolean)).toHaveLength(5);
  });
});
