import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { UNTOUCHED_RETENTION_DAYS, pruneUntouchedGenerated } from "@/lib/practice/prune";

const USER = "user-prune";
const CHILD = "a3a3a3a3-1111-4111-8111-a3a3a3a3a3a3";
const OTHER_CHILD = "a3a3a3a3-2222-4222-8222-a3a3a3a3a3a3";
const SESSION = "a3a3a3a3-3333-4333-8333-a3a3a3a3a3a3";
const NOW = new Date("2026-11-10T03:00:00.000Z");
const DAY = 86_400_000;
const daysAgo = (days: number): string => new Date(NOW.getTime() - days * DAY).toISOString();

const db = getDb();

async function addProblem(id: string, createdAt: string, overrides: Partial<typeof schema.problems.$inferInsert> = {}): Promise<void> {
  await db
    .insert(schema.problems)
    .values({ id, childId: CHILD, problemText: id, unit: "たし算", subUnit: "くり上がり", correctAnswer: "1", explanationJson: "{}", generatorRef: `たし算/くり上がり/L2/${id}`, difficultyLevel: 2, createdAt, updatedAt: createdAt, ...overrides })
    .run();
}

const remainingIds = async (): Promise<string[]> => (await db.select({ id: schema.problems.id }).from(schema.problems).all()).map((row) => row.id).sort();

beforeEach(async () => {
  const now = new Date().toISOString();
  await db.delete(schema.practiceBatches).run();
  await db.delete(schema.attempts).run();
  await db.delete(schema.reviewSchedule).run();
  await db.delete(schema.problemHintViews).run();
  await db.delete(schema.generatedSimilarProblems).run();
  await db.delete(schema.problems).run();
  await db.delete(schema.learningSessions).run();
  await db.delete(schema.childProfiles).where(eq(schema.childProfiles.userId, USER)).run();
  await db.insert(schema.users).values({ id: USER, name: "parent", email: `${USER}@example.com`, createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing().run();
  for (const id of [CHILD, OTHER_CHILD]) await db.insert(schema.childProfiles).values({ id, userId: USER, nickname: "子", grade: 2, createdAt: now, updatedAt: now }).run();
  await db.insert(schema.learningSessions).values({ id: SESSION, childId: CHILD, startedAt: now, createdAt: now, updatedAt: now }).run();
});

describe("pruneUntouchedGenerated: 解かれないまま古くなった自動生成の問題の整理", () => {
  it("保持期間は 7 日", () => {
    expect(UNTOUCHED_RETENTION_DAYS).toBe(7);
  });

  it("7 日より古い、一度も触れていない自動生成の問題だけを消す", async () => {
    await addProblem("old-untouched", daysAgo(8));
    await addProblem("exactly-7-days", daysAgo(7));
    await addProblem("recent", daysAgo(6));
    expect(await pruneUntouchedGenerated(db, CHILD, NOW)).toBe(1);
    expect(await remainingIds()).toEqual(["exactly-7-days", "recent"]);
  });

  it("一度でも解いた・復習の予定がある・ヒントを開いた・類題がある問題は、古くても残す", async () => {
    for (const id of ["attempted", "reviewed", "hinted", "has-similar", "gone"]) await addProblem(id, daysAgo(30));
    await db.insert(schema.attempts).values({ id: "a1", sessionId: SESSION, childId: CHILD, problemId: "attempted", childAnswer: "1", answerType: "tap", isCorrect: 0, createdAt: daysAgo(29) }).run();
    await db.insert(schema.reviewSchedule).values({ id: "r1", childId: CHILD, problemId: "reviewed", unit: "たし算", subUnit: "くり上がり", scheduledFor: "2026-11-11", createdAt: daysAgo(29), updatedAt: daysAgo(29) }).run();
    await db.insert(schema.problemHintViews).values({ childId: CHILD, problemId: "hinted", sessionId: SESSION, maxLevel: 1, updatedAt: daysAgo(29) }).run();
    await db.insert(schema.generatedSimilarProblems).values({ id: "s1", sourceProblemId: "has-similar", childId: CHILD, problemText: "q", answer: "1", explanation: "e", unit: "たし算", subUnit: "くり上がり", difficulty: "standard", createdAt: daysAgo(29) }).run();
    expect(await pruneUntouchedGenerated(db, CHILD, NOW)).toBe(1);
    expect(await remainingIds()).toEqual(["attempted", "has-similar", "hinted", "reviewed"]);
  });

  it("自動で作った問題ではないもの(バンク・アップロード)と、ほかの子どもの問題は消さない", async () => {
    await addProblem("bank", daysAgo(60), { generatorRef: null, difficultyLevel: null, curriculumProblemId: "math-add-1" });
    await addProblem("upload", daysAgo(60), { generatorRef: null, difficultyLevel: null });
    await addProblem("other-child", daysAgo(60), { childId: OTHER_CHILD });
    expect(await pruneUntouchedGenerated(db, CHILD, NOW)).toBe(0);
    expect(await remainingIds()).toEqual(["bank", "other-child", "upload"]);
  });

  it("問題がなくなった古いセットも片づける。新しいセットと、問題の残っているセットは残す", async () => {
    await addProblem("old-untouched", daysAgo(10));
    await addProblem("old-attempted", daysAgo(10));
    await addProblem("fresh", daysAgo(1));
    await db.insert(schema.attempts).values({ id: "a1", sessionId: SESSION, childId: CHILD, problemId: "old-attempted", childAnswer: "1", answerType: "tap", isCorrect: 1, createdAt: daysAgo(9) }).run();
    const batch = (id: string, date: string, seq: number) => db.insert(schema.practiceBatches).values({ id, childId: CHILD, subject: "math", batchDate: date, seq, createdAt: daysAgo(10) }).run();
    await batch("b-empty-after", "2026-10-31", 1);
    await batch("b-kept-old", "2026-10-31", 2);
    await batch("b-fresh", "2026-11-09", 1);
    await batch("b-fresh-empty", "2026-11-10", 1);
    await db.insert(schema.practiceBatchItems).values([
      { batchId: "b-empty-after", position: 0, problemId: "old-untouched", reason: "practice" },
      { batchId: "b-kept-old", position: 0, problemId: "old-attempted", reason: "practice" },
      { batchId: "b-fresh", position: 0, problemId: "fresh", reason: "practice" },
    ]).run();

    await pruneUntouchedGenerated(db, CHILD, NOW);
    const ids = (await db.select({ id: schema.practiceBatches.id }).from(schema.practiceBatches).all()).map((row) => row.id).sort();
    expect(ids).toEqual(["b-fresh", "b-fresh-empty", "b-kept-old"]);
  });

  it("消すものがなければ 0 を返して何も変えない", async () => {
    await addProblem("recent", daysAgo(1));
    expect(await pruneUntouchedGenerated(db, CHILD, NOW)).toBe(0);
    expect(await remainingIds()).toEqual(["recent"]);
  });
});
