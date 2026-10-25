import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

import { getCurriculumProblemById } from "@/lib/curriculum/curriculumBank";
import { ensureCurriculumProblem } from "@/lib/curriculum/materialize";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { nowJstIso } from "@/lib/utils/date";

const USER = "user-comp-1";
const CHILD = "dddddddd-4444-4444-8444-dddddddddddd";
const SESSION = "eeeeeeee-5555-4555-8555-eeeeeeeeeeee";

const state = vi.hoisted(() => ({ failStep: null as null | "weakness" | "review" }));

vi.mock("@/lib/utils/rateLimit", () => ({
  checkRateLimit: () => true,
  checkRateLimitDb: async () => true,
}));

vi.mock("@/lib/utils/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/utils/api")>();
  return {
    ...original,
    requireOwnedChild: vi.fn(async () => ({ db: getDb(), user: { id: USER }, response: null })),
  };
});

vi.mock("@/lib/review/loop", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/review/loop")>();
  return {
    ...original,
    recomputeWeakness: (...args: Parameters<typeof original.recomputeWeakness>) =>
      state.failStep === "weakness" ? Promise.resolve(null) : original.recomputeWeakness(...args),
    transitionReview: (...args: Parameters<typeof original.transitionReview>) =>
      state.failStep === "review" ? Promise.resolve({ action: "error" as const }) : original.transitionReview(...args),
  };
});

describe("POST /api/attempts does not leave a half-recorded answer behind", () => {
  const db = getDb();
  const bank = getCurriculumProblemById("english-animals-1")!;

  const send = async (problemId: string) => {
    const { POST } = await import("@/app/api/attempts/route");
    return POST(
      new Request("http://localhost/api/attempts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          childId: CHILD,
          sessionId: SESSION,
          problemId,
          childAnswer: bank.correctAnswer,
          answerType: "text",
        }),
      }),
    );
  };

  beforeEach(async () => {
    state.failStep = null;
    const now = nowJstIso();
    await db.delete(schema.attempts).run();
    await db.delete(schema.childRewards).run();
    await db.delete(schema.rewardClaims).run();
    await db.delete(schema.childProfiles).where(eq(schema.childProfiles.id, CHILD)).run();
    await db
      .insert(schema.users)
      .values({ id: USER, name: "parent", email: `${USER}@example.com`, createdAt: new Date(), updatedAt: new Date() })
      .onConflictDoNothing()
      .run();
    await db.insert(schema.childProfiles).values({ id: CHILD, userId: USER, nickname: "子", grade: 2, createdAt: now, updatedAt: now }).run();
    await db.insert(schema.learningSessions).values({ id: SESSION, childId: CHILD, startedAt: now, createdAt: now, updatedAt: now }).run();
  });

  it.each(["weakness", "review"] as const)(
    "removes the saved attempt and pays nothing when the %s update fails, so a retry is not double counted",
    async (step) => {
      const problemId = await ensureCurriculumProblem(db, CHILD, bank);
      state.failStep = step;

      expect((await send(problemId)).status).toBe(500);
      expect(await db.select().from(schema.attempts).all()).toHaveLength(0);
      expect(await db.select().from(schema.childRewards).all()).toHaveLength(0);

      state.failStep = null;
      const retry = await send(problemId);
      expect(retry.status).toBe(201);
      expect(await db.select().from(schema.attempts).all()).toHaveLength(1);
      expect((await retry.json()).data.reward).not.toBeNull();
    },
  );
});
