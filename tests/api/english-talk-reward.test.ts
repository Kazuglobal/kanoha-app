import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { recordEnglishTalkClear } from "@/lib/rewards/serverRewards";
import { nowJstIso } from "@/lib/utils/date";

const USER = "user-talk-reward-1";
const OTHER_USER = "user-talk-reward-2";
const CHILD = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const OTHER_CHILD = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";

const state = vi.hoisted(() => ({ userId: "user-talk-reward-1" as string | null }));

// 所有確認は本物(ownsChild)を通し、ログイン中のユーザーだけ差し替える
vi.mock("@/lib/utils/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/utils/api")>();
  return {
    ...original,
    requireOwnedChild: vi.fn(async (childId: string) => {
      const db = getDb();
      if (!state.userId) return { db, user: null, response: original.apiError("Authentication required", 401) };
      if (!(await original.ownsChild(state.userId, childId, db))) {
        return { db, user: { id: state.userId }, response: original.apiError("Child profile not found", 404) };
      }
      return { db, user: { id: state.userId }, response: null };
    }),
  };
});

import { POST } from "@/app/api/english-talk/check/route";

const check = async (body: Record<string, unknown>) => {
  const res = await POST(
    new Request("http://localhost/api/english-talk/check", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": crypto.randomUUID() },
      body: JSON.stringify(body),
    }),
  );
  return { status: res.status, data: (await res.json()).data };
};

const DOG = { sceneId: "park", turnId: "park-dog", answer: "It's a dog.", mode: "choice", firstTry: true };

describe("POST /api/english-talk/check awards the reward on the server", () => {
  const db = getDb();

  beforeEach(async () => {
    state.userId = USER;
    const now = nowJstIso();
    await db.delete(schema.rewardClaims).run();
    await db.delete(schema.childRewards).run();
    for (const [id, userId] of [[CHILD, USER], [OTHER_CHILD, OTHER_USER]] as const) {
      await db.delete(schema.childProfiles).where(eq(schema.childProfiles.id, id)).run();
      await db
        .insert(schema.users)
        .values({ id: userId, name: "parent", email: `${userId}@example.com`, createdAt: new Date(), updatedAt: new Date() })
        .onConflictDoNothing()
        .run();
      await db.insert(schema.childProfiles).values({ id, userId, nickname: "子", grade: 2, createdAt: now, updatedAt: now }).run();
    }
  });

  const storedCorrect = async (childId = CHILD) =>
    (await db.select().from(schema.childRewards).where(eq(schema.childRewards.childId, childId)).get())?.totalCorrectCount ?? 0;

  it("counts a first-try correct answer once and returns the new reward state", async () => {
    const { status, data } = await check({ ...DOG, childId: CHILD });
    expect(status).toBe(200);
    expect(data.correct).toBe(true);
    expect(data.reward).toMatchObject({ totalCorrectCount: 1, currentCycleCount: 1 });
    expect(await storedCorrect()).toBe(1);
  });

  it("does not pay again for the same turn on the same day", async () => {
    await check({ ...DOG, childId: CHILD });
    const again = await check({ ...DOG, childId: CHILD });
    expect(again.data.correct).toBe(true);
    expect(again.data.reward).toBeUndefined();
    expect(await storedCorrect()).toBe(1);
  });

  it("pays for a different turn", async () => {
    await check({ ...DOG, childId: CHILD });
    const other = await check({
      sceneId: "shop",
      turnId: "shop-want",
      answer: "Apples, please.",
      mode: "choice",
      firstTry: true,
      childId: CHILD,
    });
    expect(other.data.reward).toMatchObject({ totalCorrectCount: 2 });
  });

  it("does not pay when the client says it was not the first try, or in repeat mode, or when wrong", async () => {
    expect((await check({ ...DOG, childId: CHILD, firstTry: false })).data.reward).toBeUndefined();
    expect((await check({ ...DOG, childId: CHILD, firstTry: undefined })).data.reward).toBeUndefined();
    expect((await check({ ...DOG, childId: CHILD, mode: "repeat" })).data.reward).toBeUndefined();
    expect((await check({ ...DOG, childId: CHILD, answer: "It's a cat." })).data.reward).toBeUndefined();
    expect(await storedCorrect()).toBe(0);
  });

  it("still judges but never pays for a child the parent does not own, a missing child or no login", async () => {
    const foreign = await check({ ...DOG, childId: OTHER_CHILD });
    expect(foreign.data).toEqual({ correct: true });
    expect(await storedCorrect(OTHER_CHILD)).toBe(0);

    expect((await check({ ...DOG })).data).toEqual({ correct: true });

    state.userId = null;
    expect((await check({ ...DOG, childId: CHILD })).data).toEqual({ correct: true });
    expect(await db.select().from(schema.rewardClaims).all()).toHaveLength(0);
  });

  it("claims atomically: parallel identical requests pay exactly once", async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }, () => recordEnglishTalkClear(db, CHILD, "park", "park-dog")),
    );
    expect(results.filter((reward) => reward !== null)).toHaveLength(1);
    expect(await storedCorrect()).toBe(1);
  });

  it("gives the claim back when the reward cannot be recorded, so it can be counted next time", async () => {
    const failing = new Proxy(db, {
      get(target, prop) {
        if (prop === "insert") {
          return (table: unknown) => {
            if (table === schema.childRewards) throw new Error("boom");
            return target.insert(table as typeof schema.rewardClaims);
          };
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });

    await expect(recordEnglishTalkClear(failing, CHILD, "park", "park-dog")).rejects.toThrow("boom");
    expect(await db.select().from(schema.rewardClaims).all()).toHaveLength(0);
    expect(await recordEnglishTalkClear(db, CHILD, "park", "park-dog")).not.toBeNull();
  });

  it("starts a new day at midnight JST, not midnight UTC", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-10-25T14:59:59Z")); // 23:59:59 JST
      expect(await recordEnglishTalkClear(db, CHILD, "park", "park-dog")).not.toBeNull();
      vi.setSystemTime(new Date("2026-10-25T15:00:01Z")); // 00:00:01 JST (next day)
      expect(await recordEnglishTalkClear(db, CHILD, "park", "park-dog")).not.toBeNull();
      vi.setSystemTime(new Date("2026-10-25T16:00:00Z")); // same JST day as above
      expect(await recordEnglishTalkClear(db, CHILD, "park", "park-dog")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("english-talk and demo checks ignore the spoofable x-forwarded-for header for rate limiting", () => {
  const send = (path: string, body: unknown, headers: Record<string, string>) =>
    import(path === "demo" ? "@/app/api/demo/check/route" : "@/app/api/english-talk/check/route").then(({ POST }) =>
      POST(
        new Request(`http://localhost/api/${path}`, {
          method: "POST",
          headers: { "content-type": "application/json", ...headers },
          body: JSON.stringify(body),
        }),
      ),
    );

  it("english-talk/check: rotating x-forwarded-for does not reset the limit", async () => {
    const body = { sceneId: "park", turnId: "park-dog", answer: "It's a dog.", mode: "choice" };
    let limited = 0;
    for (let i = 0; i < 125; i += 1) {
      const res = await send("english-talk/check", body, { "cf-connecting-ip": "198.51.100.77", "x-forwarded-for": `10.0.0.${i}` });
      if (res.status === 429) limited += 1;
    }
    expect(limited).toBeGreaterThan(0);
  });

  it("demo/check: rotating x-forwarded-for does not reset the limit", async () => {
    let limited = 0;
    for (let i = 0; i < 125; i += 1) {
      const res = await send("demo", { checkId: "nope", answer: "1" }, { "cf-connecting-ip": "198.51.100.78", "x-forwarded-for": `10.0.1.${i}` });
      if (res.status === 429) limited += 1;
    }
    expect(limited).toBeGreaterThan(0);
  });
});
