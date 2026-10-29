import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { generateProblem } from "@/lib/generation/registry";
import { generateSimilarSet } from "@/lib/generation/similar";
import { nowJstIso } from "@/lib/utils/date";

const USER = "user-practice-similar";
const CHILD = "e1e1e1e1-1111-4111-8111-e1e1e1e1e1e1";
const SESSION = "e1e1e1e1-2222-4222-8222-e1e1e1e1e1e1";
const SOURCE_ID = "e1e1e1e1-3333-4333-8333-e1e1e1e1e1e1";

const aiCalls = vi.hoisted(() => ({ count: 0 }));

vi.mock("@/lib/ai", () => ({
  getAiProvider: () => {
    aiCalls.count += 1;
    throw new Error("生成した問題の類題で AI を呼んではいけない");
  },
}));

vi.mock("@/lib/utils/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/utils/api")>();
  return {
    ...original,
    requireOwnedChild: vi.fn(async () => ({ db: getDb(), user: { id: USER }, response: null })),
  };
});

import { POST as attempt } from "@/app/api/attempts/route";
import { POST as similar } from "@/app/api/ai/generate-similar-problems/route";

const db = getDb();
const call = (route: (request: Request) => Promise<Response>, path: string, body: Record<string, unknown>) =>
  route(new Request(`http://localhost${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));

async function addGeneratedSource(subUnit = "くり上がり", unit = "たし算", level: 1 | 2 | 3 | 4 | 5 = 2) {
  const problem = generateProblem({ unit, subUnit, level, seed: "source-seed" });
  const now = nowJstIso();
  await db
    .insert(schema.problems)
    .values({
      id: SOURCE_ID,
      childId: CHILD,
      problemText: problem.problemText,
      subject: problem.subject,
      unit: problem.unit,
      subUnit: problem.subUnit,
      correctAnswer: problem.correctAnswer,
      choices: problem.choices ? JSON.stringify(problem.choices) : null,
      listenText: problem.listenText ?? null,
      generatorRef: problem.ref,
      difficultyLevel: problem.level,
      explanationJson: JSON.stringify(problem.hints),
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return problem;
}

beforeEach(async () => {
  aiCalls.count = 0;
  const now = nowJstIso();
  await db.delete(schema.rateLimits).run();
  await db.delete(schema.attempts).run();
  await db.delete(schema.generatedSimilarProblems).run();
  await db.delete(schema.weaknessMap).run();
  await db.delete(schema.reviewSchedule).run();
  await db.delete(schema.problems).run();
  await db.delete(schema.learningSessions).run();
  await db.delete(schema.childProfiles).where(eq(schema.childProfiles.userId, USER)).run();
  await db.insert(schema.users).values({ id: USER, name: "parent", email: `${USER}@example.com`, createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing().run();
  await db.insert(schema.childProfiles).values({ id: CHILD, userId: USER, nickname: "子", grade: 2, createdAt: now, updatedAt: now }).run();
  await db.insert(schema.learningSessions).values({ id: SESSION, childId: CHILD, startedAt: now, createdAt: now, updatedAt: now }).run();
});

describe("生成した問題の類題(POST /api/ai/generate-similar-problems)", () => {
  it("AI を呼ばずに、同じ生成器で 5 問つくる(答えは返さない)", async () => {
    await addGeneratedSource();
    const response = await call(similar, "/api/ai/generate-similar-problems", { childId: CHILD, problemId: SOURCE_ID });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(aiCalls.count).toBe(0);
    expect(body.data).toHaveLength(5);
    for (const item of body.data) {
      expect(Object.keys(item).sort()).toEqual(["choices", "difficulty", "id", "listen_text", "problem_text", "sub_unit", "unit"]);
      expect(item.choices === null || item.choices.length === 4).toBe(true);
    }
    expect(JSON.stringify(body)).not.toMatch(/"answer"|explanation/);
  });

  it("保存される答えは 生成器が計算した答え。同じ元の問題から 同じ類題ができる", async () => {
    const source = await addGeneratedSource();
    const expected = generateSimilarSet({ id: SOURCE_ID, ref: source.ref })!;
    await call(similar, "/api/ai/generate-similar-problems", { childId: CHILD, problemId: SOURCE_ID });
    await call(similar, "/api/ai/generate-similar-problems", { childId: CHILD, problemId: SOURCE_ID });
    const rows = await db.select().from(schema.generatedSimilarProblems).where(eq(schema.generatedSimilarProblems.childId, CHILD)).all();
    expect(rows).toHaveLength(10);
    const stored = (offset: number) => rows.slice(offset, offset + 5).map((row) => [row.problemText, row.answer]);
    expect(stored(0)).toEqual(expected.map((problem) => [problem.problemText, problem.correctAnswer]));
    expect(stored(5)).toEqual(stored(0));
    expect(rows.every((row) => row.sourceProblemId === SOURCE_ID && row.unit === "たし算" && row.subUnit === "くり上がり")).toBe(true);
  });

  it("4 択の問題(英語)の類題は 4 択と聞く英語を引きつぐ", async () => {
    await addGeneratedSource("くだもの", "たべもの", 2);
    const response = await call(similar, "/api/ai/generate-similar-problems", { childId: CHILD, problemId: SOURCE_ID });
    const { data } = await response.json();
    expect(data).toHaveLength(5);
    for (const item of data) expect(item.choices).toHaveLength(4);
  });

  it("答え合わせは サーバーが保存した答えと選択肢で行う(選択肢にない tap は 400)", async () => {
    await addGeneratedSource("くだもの", "たべもの", 2);
    const { data } = await (await call(similar, "/api/ai/generate-similar-problems", { childId: CHILD, problemId: SOURCE_ID })).json();
    const first = data[0];
    const stored = (await db.select().from(schema.generatedSimilarProblems).where(eq(schema.generatedSimilarProblems.id, first.id)).get())!;
    const send = (childAnswer: string) => call(attempt, "/api/attempts", { childId: CHILD, sessionId: SESSION, similarProblemId: first.id, childAnswer, answerType: "tap" });

    expect((await send("not-a-choice")).status).toBe(400);
    const wrong = first.choices.find((choice: string) => choice !== stored.answer);
    expect((await (await send(wrong)).json()).data.is_correct).toBe(false);
    expect((await (await send(stored.answer)).json()).data.is_correct).toBe(true);
  });

  it("1 分に 10 回をこえると 429(DB で数える)", async () => {
    await addGeneratedSource();
    for (let index = 0; index < 10; index += 1) {
      expect((await call(similar, "/api/ai/generate-similar-problems", { childId: CHILD, problemId: SOURCE_ID })).status).toBe(201);
    }
    expect((await call(similar, "/api/ai/generate-similar-problems", { childId: CHILD, problemId: SOURCE_ID })).status).toBe(429);
  });
});
