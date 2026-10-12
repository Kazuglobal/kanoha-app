import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getCurriculumProblemById } from "@/lib/curriculum/curriculumBank";
import { ensureCurriculumProblem } from "@/lib/curriculum/materialize";
import { nowJstIso } from "@/lib/utils/date";

const USER = "user-curriculum-1";
const CHILD = "66666666-6666-4666-8666-666666666666";
const SESSION = "77777777-7777-4777-8777-777777777777";

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

const post = (path: string, body: unknown) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("curriculum (stage map) problems join the real learning loop", () => {
  const db = getDb();

  beforeEach(async () => {
    const now = nowJstIso();
    await db.delete(schema.attempts).run();
    await db.delete(schema.weaknessMap).run();
    await db.delete(schema.reviewSchedule).run();
    await db.delete(schema.generatedSimilarProblems).run();
    await db.delete(schema.problems).run();
    await db.delete(schema.learningSessions).run();
    await db.delete(schema.childProfiles).where(eq(schema.childProfiles.id, CHILD)).run();
    await db
      .insert(schema.users)
      .values({ id: USER, name: "parent", email: `${USER}@example.com`, createdAt: new Date(), updatedAt: new Date() })
      .onConflictDoNothing()
      .run();
    await db
      .insert(schema.childProfiles)
      .values({ id: CHILD, userId: USER, nickname: "子", grade: 2, createdAt: now, updatedAt: now })
      .run();
    await db
      .insert(schema.learningSessions)
      .values({ id: SESSION, childId: CHILD, startedAt: now, createdAt: now, updatedAt: now })
      .run();
  });

  it("registers a bank problem once per child (idempotent)", async () => {
    const bank = getCurriculumProblemById("english-animals-1")!;
    const first = await ensureCurriculumProblem(db, CHILD, bank);
    const second = await ensureCurriculumProblem(db, CHILD, bank);
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);

    const row = await db.select().from(schema.problems).where(eq(schema.problems.id, first)).get();
    expect(row).toMatchObject({ subject: "english", unit: "ほしいものとお買い物", correctAnswer: "なにが ほしいですか？", curriculumProblemId: bank.id });
    expect(JSON.parse(row!.explanationJson).hint1).toBe(bank.hints.hint1);
  });

  it("builds bank-based practice with choices and listen text, then grades it on the server", async () => {
    const problemId = await ensureCurriculumProblem(db, CHILD, getCurriculumProblemById("english-animals-1")!);
    const { POST: similar } = await import("@/app/api/ai/generate-similar-problems/route");
    const response = await similar(post("/api/ai/generate-similar-problems", { childId: CHILD, problemId }));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data).toHaveLength(5);
    for (const item of body.data) {
      expect(item.choices).toHaveLength(4);
      expect(item).not.toHaveProperty("answer");
    }
    expect(body.data.some((item: { listen_text: string | null }) => item.listen_text)).toBe(true);

    const first = body.data[0];
    const stored = await db
      .select()
      .from(schema.generatedSimilarProblems)
      .where(eq(schema.generatedSimilarProblems.id, first.id))
      .get();

    const { POST: attempt } = await import("@/app/api/attempts/route");
    const judged = await attempt(
      post("/api/attempts", {
        childId: CHILD,
        sessionId: SESSION,
        similarProblemId: first.id,
        childAnswer: stored!.answer,
        answerType: "tap",
      }),
    );
    expect(judged.status).toBeLessThan(300);
    expect((await judged.json()).data.is_correct).toBeTruthy();

    const weakness = await db.select().from(schema.weaknessMap).where(eq(schema.weaknessMap.childId, CHILD)).all();
    expect(weakness.length).toBeGreaterThan(0);
  });
});
