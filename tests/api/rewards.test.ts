import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getCurriculumProblemById } from "@/lib/curriculum/curriculumBank";
import { ensureCurriculumProblem } from "@/lib/curriculum/materialize";
import { recordCorrectReward } from "@/lib/rewards/serverRewards";
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
