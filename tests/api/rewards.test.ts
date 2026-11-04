import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getCurriculumProblemById } from "@/lib/curriculum/curriculumBank";
import { ensureCurriculumProblem } from "@/lib/curriculum/materialize";
import { recordCorrectReward, recordProblemReward } from "@/lib/rewards/serverRewards";
import { nowJstIso } from "@/lib/utils/date";

const USER = "user-rewards-1";
const OTHER_USER = "user-rewards-2";
const CHILD = "88888888-8888-4888-8888-888888888888";
const OTHER_CHILD = "99999999-9999-4999-8999-999999999999";
const SESSION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const state = vi.hoisted(() => ({ userId: "user-rewards-1" as string | null }));

vi.mock("@/lib/utils/rateLimit", () => ({
  checkRateLimit: () => true,
  checkRateLimitDb: async () => true,
}));

// 所有確認は本物(ownsChild)を通し、ログイン中のユーザーだけ差し替える
vi.mock("@/lib/utils/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/utils/api")>();
  return {
    ...original,
    requireUser: vi.fn(async () => ({ db: getDb(), user: state.userId ? { id: state.userId } : null })),
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

const request = (method: string, body?: unknown) =>
  new Request("http://localhost/api/children/x/rewards", {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const route = () => import("@/app/api/children/[id]/rewards/route");

describe("child rewards are stored per child in the DB", () => {
  const db = getDb();

  beforeEach(async () => {
    state.userId = USER;
    const now = nowJstIso();
    await db.delete(schema.childRewards).run();
    await db.delete(schema.attempts).run();
    await db.delete(schema.weaknessMap).run();
    await db.delete(schema.reviewSchedule).run();
    await db.delete(schema.problems).run();
    await db.delete(schema.learningSessions).run();
    for (const [id, userId] of [[CHILD, USER], [OTHER_CHILD, OTHER_USER]] as const) {
      await db.delete(schema.childProfiles).where(eq(schema.childProfiles.id, id)).run();
      await db
        .insert(schema.users)
        .values({ id: userId, name: "parent", email: `${userId}@example.com`, createdAt: new Date(), updatedAt: new Date() })
        .onConflictDoNothing()
        .run();
      await db.insert(schema.childProfiles).values({ id, userId, nickname: "子", grade: 2, createdAt: now, updatedAt: now }).run();
    }
    await db
      .insert(schema.learningSessions)
      .values({ id: SESSION, childId: CHILD, startedAt: now, createdAt: now, updatedAt: now })
      .run();
  });

  it("returns defaults before anything is stored", async () => {
    const response = await (await route()).GET(request("GET"), ctx(CHILD));
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data).toMatchObject({
      reward: { currentCycleCount: 0, totalCorrectCount: 0, totalRewardYen: 0 },
      equipped: { hat: "hat_none", clothes: "clothes_tshirt" },
      stored: false,
    });
  });

  it("rejects another parent's child and unauthenticated access", async () => {
    const { GET, PATCH, POST } = await route();
    expect((await GET(request("GET"), ctx(OTHER_CHILD))).status).toBe(404);
    expect((await PATCH(request("PATCH", { category: "hat", itemId: "hat_safari" }), ctx(OTHER_CHILD))).status).toBe(404);
    expect(
      (await POST(request("POST", { reward: { currentCycleCount: 0, totalCorrectCount: 10, totalRewardYen: 5 } }), ctx(OTHER_CHILD)))
        .status,
    ).toBe(404);
    expect(await db.select().from(schema.childRewards).all()).toHaveLength(0);

    state.userId = null;
    expect((await GET(request("GET"), ctx(CHILD))).status).toBe(401);
  });

  it("counts correct answers atomically (5 yen per 10)", async () => {
    await Promise.all(Array.from({ length: 12 }, () => recordCorrectReward(db, CHILD)));
    const row = await db.select().from(schema.childRewards).where(eq(schema.childRewards.childId, CHILD)).get();
    expect(row).toMatchObject({ currentCycleCount: 2, totalCorrectCount: 12, totalRewardYen: 5 });
    expect(row!.lastRewardEarnedAt).toBeTruthy();
  });

  it("adds the reward when the original problem is answered correctly via /api/attempts", async () => {
    const bank = getCurriculumProblemById("english-animals-1")!;
    const problemId = await ensureCurriculumProblem(db, CHILD, bank);
    const { POST: attempt } = await import("@/app/api/attempts/route");
    const send = (childAnswer: string) =>
      attempt(
        new Request("http://localhost/api/attempts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ childId: CHILD, sessionId: SESSION, problemId, childAnswer, answerType: "text" }),
        }),
      );

    const wrong = await (await send("dog-not-cat")).json();
    expect(wrong.data.reward).toBeNull();

    const right = await (await send(bank.correctAnswer)).json();
    expect(right.data.reward).toMatchObject({ currentCycleCount: 1, totalCorrectCount: 1, totalRewardYen: 0 });
  });

  describe("reward rules for the original problem", () => {
    const bank = getCurriculumProblemById("english-animals-1")!;

    const answer = async (problemId: string, childAnswer = bank.correctAnswer) => {
      const { POST: attempt } = await import("@/app/api/attempts/route");
      const response = await attempt(
        new Request("http://localhost/api/attempts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ childId: CHILD, sessionId: SESSION, problemId, childAnswer, answerType: "text" }),
        }),
      );
      return (await response.json()).data as { is_correct: boolean; reward: unknown };
    };

    const storedCorrect = async () =>
      (await db.select().from(schema.childRewards).where(eq(schema.childRewards.childId, CHILD)).get())
        ?.totalCorrectCount ?? 0;

    const openHints = (problemId: string, maxLevel: number) =>
      db
        .insert(schema.problemHintViews)
        .values({ childId: CHILD, problemId, sessionId: SESSION, maxLevel, updatedAt: nowJstIso() })
        .run();

    it("pays only once per problem per day, but still records every attempt", async () => {
      const problemId = await ensureCurriculumProblem(db, CHILD, bank);
      expect((await answer(problemId)).reward).not.toBeNull();

      const again = await answer(problemId);
      expect(again.is_correct).toBe(true);
      expect(again.reward).toBeNull();
      expect(await storedCorrect()).toBe(1);
      expect(await db.select().from(schema.attempts).all()).toHaveLength(2);
    });

    it("pays again for the same problem on another day (reviews are rewarded)", async () => {
      const problemId = await ensureCurriculumProblem(db, CHILD, bank);
      await answer(problemId);
      await db.update(schema.rewardClaims).set({ claimDate: "2000-01-01" }).run();

      expect((await answer(problemId)).reward).not.toBeNull();
      expect(await storedCorrect()).toBe(2);
    });

    it("a wrong answer does not use up the day's reward", async () => {
      const problemId = await ensureCurriculumProblem(db, CHILD, bank);
      await answer(problemId, "not-the-answer");
      expect((await answer(problemId)).reward).not.toBeNull();
    });

    it("does not pay when the answer hint (level 4) was opened, but does after the solution hint (level 3)", async () => {
      const problemId = await ensureCurriculumProblem(db, CHILD, bank);
      await openHints(problemId, 4);
      const peeked = await answer(problemId);
      expect(peeked.is_correct).toBe(true);
      expect(peeked.reward).toBeNull();
      expect(await storedCorrect()).toBe(0);

      // 解き方(level 3)までなら、覗いた回答はごほうびを使っていないのでそのまま対象になる
      await db.update(schema.problemHintViews).set({ maxLevel: 3 }).run();
      expect((await answer(problemId)).reward).not.toBeNull();
    });

    it("also counts hints opened in an earlier session today (starting over does not reset the peek)", async () => {
      const problemId = await ensureCurriculumProblem(db, CHILD, bank);
      const earlier = "bbbbbbbb-aaaa-4aaa-8aaa-bbbbbbbbbbbb";
      const now = nowJstIso();
      await db.insert(schema.learningSessions).values({ id: earlier, childId: CHILD, startedAt: now, createdAt: now, updatedAt: now }).run();
      await db
        .insert(schema.problemHintViews)
        .values({ childId: CHILD, problemId, sessionId: earlier, maxLevel: 4, updatedAt: now })
        .run();

      const result = await answer(problemId); // 今回のセッションではヒントを開いていない
      expect(result.is_correct).toBe(true);
      expect(result.reward).toBeNull();
    });

    it("pays exactly once when identical correct answers arrive in parallel", async () => {
      const problemId = await ensureCurriculumProblem(db, CHILD, bank);
      const results = await Promise.all(
        Array.from({ length: 4 }, () => recordProblemReward(db, CHILD, problemId, 0)),
      );
      expect(results.filter((reward) => reward !== null)).toHaveLength(1);
      expect(await storedCorrect()).toBe(1);
    });
  });

  it("saves only unlocked accessories", async () => {
    const { PATCH, GET } = await route();
    const locked = await PATCH(request("PATCH", { category: "hat", itemId: "hat_crown" }), ctx(CHILD));
    expect(locked.status).toBe(400);
    const wrongCategory = await PATCH(request("PATCH", { category: "glasses", itemId: "hat_safari" }), ctx(CHILD));
    expect(wrongCategory.status).toBe(400);

    const ok = await PATCH(request("PATCH", { category: "hat", itemId: "hat_safari" }), ctx(CHILD));
    expect(ok.status).toBe(200);
    const { data } = await (await GET(request("GET"), ctx(CHILD))).json();
    expect(data.equipped.hat).toBe("hat_safari");
    expect(data.stored).toBe(true);
  });

  describe("PUT saves the whole equipped set in one write", () => {
    const seedCorrect = (totalCorrectCount: number) => {
      const now = nowJstIso();
      return db.insert(schema.childRewards).values({ childId: CHILD, totalCorrectCount, createdAt: now, updatedAt: now }).run();
    };
    const put = async (childId: string, equipped: unknown) => (await route()).PUT(request("PUT", { equipped }), ctx(childId));
    const stored = async () => (await (await (await route()).GET(request("GET"), ctx(CHILD))).json()).data;

    it("applies several slots at once and keeps the reward counts as they were", async () => {
      await seedCorrect(5);
      const response = await put(CHILD, { hat: "hat_safari", glasses: "glasses_round", effect: "effect_sparkle", pet: "pet_cat" });
      expect(response.status).toBe(200);
      const { data } = await response.json();
      expect(data.rejected).toEqual([]);
      expect(data.equipped).toMatchObject({ hat: "hat_safari", glasses: "glasses_round", effect: "effect_sparkle", pet: "pet_cat" });
      expect(data.reward.totalCorrectCount).toBe(5);

      const after = await stored();
      expect(after.equipped).toMatchObject({ hat: "hat_safari", effect: "effect_sparkle", pet: "pet_cat" });
      expect(after.reward.totalCorrectCount).toBe(5);
    });

    it("creates the row on the first save without inventing any reward", async () => {
      const response = await put(CHILD, { hat: "hat_safari" });
      expect(response.status).toBe(200);
      const after = await stored();
      expect(after).toMatchObject({ stored: true, reward: { totalCorrectCount: 0, totalRewardYen: 0 }, equipped: { hat: "hat_safari" } });
    });

    it("leaves locked and unknown items off, reports their slots, and still applies the rest", async () => {
      const response = await put(CHILD, {
        hat: "hat_crown", // Lv.5
        effect: "effect_aura", // Lv.10
        pet: "pet_not_in_catalog",
        glasses: "glasses_round",
        motion: "glasses_round", // 別の枠のアイテム
      });
      expect(response.status).toBe(200);
      const { data } = await response.json();
      expect([...data.rejected].sort()).toEqual(["effect", "hat", "motion", "pet"]);
      expect(data.equipped).toMatchObject({ hat: "hat_none", effect: "effect_none", pet: "pet_none", motion: "motion_calm", glasses: "glasses_round" });
    });

    it("unlocks new slots by level (effect_sparkle at Lv.2 = 5 correct)", async () => {
      expect((await (await put(CHILD, { effect: "effect_sparkle" })).json()).data.rejected).toEqual(["effect"]);
      await seedCorrect(5);
      const response = await put(CHILD, { effect: "effect_sparkle" });
      expect((await response.json()).data).toMatchObject({ rejected: [], equipped: { effect: "effect_sparkle" } });
    });

    it("rejects unknown slots and malformed bodies without writing", async () => {
      for (const body of [{ equipped: { cape: "cape_red" } }, { equipped: { hat: 3 } }, { equipped: { hat: "" } }, { equipped: "hat_safari" }, {}]) {
        const response = await (await route()).PUT(request("PUT", body), ctx(CHILD));
        expect(response.status, JSON.stringify(body)).toBe(400);
      }
      expect(await db.select().from(schema.childRewards).all()).toHaveLength(0);
    });

    it("does not touch another parent's child, and needs a login", async () => {
      expect((await put(OTHER_CHILD, { hat: "hat_safari" })).status).toBe(404);
      expect(await db.select().from(schema.childRewards).all()).toHaveLength(0);
      state.userId = null;
      expect((await put(CHILD, { hat: "hat_safari" })).status).toBe(401);
    });

    it("keeps both changes when two requests for different slots arrive together", async () => {
      await Promise.all([put(CHILD, { hat: "hat_safari" }), put(CHILD, { glasses: "glasses_round" })]);
      expect((await stored()).equipped).toMatchObject({ hat: "hat_safari", glasses: "glasses_round" });
    });

    it("ends up as exactly one of two whole sets sent together, never a mix", async () => {
      const first = { hat: "hat_safari", glasses: "glasses_none", clothes: "clothes_tshirt" };
      const second = { hat: "hat_none", glasses: "glasses_round", clothes: "clothes_school" };
      await Promise.all([put(CHILD, first), put(CHILD, second)]);
      const { equipped } = await stored();
      const picked = { hat: equipped.hat, glasses: equipped.glasses, clothes: equipped.clothes };
      expect([first, second]).toContainEqual(picked);
    });

    it("leaves the stored set alone when nothing in the request can be applied", async () => {
      await put(CHILD, { hat: "hat_safari" });
      const response = await put(CHILD, { hat: "hat_crown" });
      expect((await response.json()).data).toMatchObject({ rejected: ["hat"], equipped: { hat: "hat_safari" } });
    });
  });

  it("imports legacy device rewards only once and caps the yen", async () => {
    const { POST } = await route();
    const first = await POST(
      request("POST", {
        reward: { currentCycleCount: 3, totalCorrectCount: 23, totalRewardYen: 999 },
        equipped: { hat: "hat_crown", glasses: "glasses_round" },
      }),
      ctx(CHILD),
    );
    expect(first.status).toBe(200);
    const imported = (await first.json()).data;
    expect(imported.imported).toBe(true);
    expect(imported.reward).toMatchObject({ currentCycleCount: 3, totalCorrectCount: 23, totalRewardYen: 10 });
    // Lv.3 では きんのクラウン(Lv.5) は使えない
    expect(imported.equipped).toMatchObject({ hat: "hat_none", glasses: "glasses_round" });

    const second = await POST(
      request("POST", { reward: { currentCycleCount: 0, totalCorrectCount: 500, totalRewardYen: 250 } }),
      ctx(CHILD),
    );
    const again = (await second.json()).data;
    expect(again.imported).toBe(false);
    expect(again.reward.totalCorrectCount).toBe(23);
  });

  it("rejects out-of-range import input", async () => {
    const { POST } = await route();
    const response = await POST(
      request("POST", { reward: { currentCycleCount: 10, totalCorrectCount: -1, totalRewardYen: 0 } }),
      ctx(CHILD),
    );
    expect(response.status).toBe(400);
  });
});
