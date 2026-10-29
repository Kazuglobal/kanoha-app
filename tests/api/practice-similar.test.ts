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
const scrubCalls = vi.hoisted(() => ({ count: 0 }));

vi.mock("@/lib/ai/pii", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ai/pii")>();
  return {
    ...original,
    scrubPiiFromSimilarProblem: (item: Parameters<typeof original.scrubPiiFromSimilarProblem>[0]) => {
      scrubCalls.count += 1;
      return original.scrubPiiFromSimilarProblem(item);
    },
  };
});

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

async function addGeneratedSource(subUnit = "くり上がり", unit = "たし算", level: 1 | 2 | 3 | 4 | 5 = 2, id = SOURCE_ID) {
  const problem = generateProblem({ unit, subUnit, level, seed: "source-seed" });
  const now = nowJstIso();
  await db
    .insert(schema.problems)
    .values({
      id,
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
  scrubCalls.count = 0;
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
    const rows = await db.select().from(schema.generatedSimilarProblems).where(eq(schema.generatedSimilarProblems.childId, CHILD)).all();
    expect(rows).toHaveLength(5);
    const stored = rows.map((row) => [row.problemText, row.answer]);
    expect(stored).toEqual(expected.map((problem) => [problem.problemText, problem.correctAnswer]));
    expect(rows.every((row) => row.sourceProblemId === SOURCE_ID && row.unit === "たし算" && row.subUnit === "くり上がり")).toBe(true);
  });

  it("同じ問題の類題をもういちど頼まれたら、作りなおさず 前の 5 問を返す(中身は同じなので、行を増やさない)", async () => {
    await addGeneratedSource();
    const first = await call(similar, "/api/ai/generate-similar-problems", { childId: CHILD, problemId: SOURCE_ID });
    const again = await call(similar, "/api/ai/generate-similar-problems", { childId: CHILD, problemId: SOURCE_ID });
    expect(first.status).toBe(201);
    expect(again.status).toBe(200);
    const [a, b] = [(await first.json()).data, (await again.json()).data];
    expect(b.map((item: { id: string }) => item.id)).toEqual(a.map((item: { id: string }) => item.id));
    expect(b.map((item: { problem_text: string }) => item.problem_text)).toEqual(a.map((item: { problem_text: string }) => item.problem_text));
    expect(await db.select().from(schema.generatedSimilarProblems).all()).toHaveLength(5);
    expect(Object.keys(b[0]).sort()).toEqual(["choices", "difficulty", "id", "listen_text", "problem_text", "sub_unit", "unit"]);
  });

  it("テンプレートで作った文は 個人情報の除去にかけない(先生・小さい のような漢字の語が こわれない)", async () => {
    // 『先生』『小さい』を含む類題が できる元の問題を探す(seed は元の問題の id から決まる)
    const ref = generateProblem({ unit: "漢字", subUnit: "漢字の読み", level: 2, seed: "pii" }).ref;
    const idFor = (n: number) => `e1e1e1e1-3333-4333-8333-${String(n).padStart(12, "0")}`;
    const found = Array.from({ length: 600 }, (_, index) => idFor(index + 1)).find((id) =>
      generateSimilarSet({ id, ref })?.some((problem) => /『(先生|小さい)』/.test(problem.problemText)),
    );
    expect(found, "先生・小さい を含む類題が できる id が見つからない").toBeTruthy();
    await addGeneratedSource("漢字の読み", "漢字", 2, found!);
    const response = await call(similar, "/api/ai/generate-similar-problems", { childId: CHILD, problemId: found! });
    expect(response.status).toBe(201);
    const expected = generateSimilarSet({ id: found!, ref: (await db.select().from(schema.problems).where(eq(schema.problems.id, found!)).get())!.generatorRef! })!;
    const rows = await db.select().from(schema.generatedSimilarProblems).where(eq(schema.generatedSimilarProblems.sourceProblemId, found!)).all();
    expect(rows.map((row) => row.problemText)).toEqual(expected.map((problem) => problem.problemText));
    expect(rows.some((row) => row.problemText.includes("〇"))).toBe(false);
    expect(scrubCalls.count).toBe(0);
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
      expect((await call(similar, "/api/ai/generate-similar-problems", { childId: CHILD, problemId: SOURCE_ID })).status).toBeLessThan(300);
    }
    expect((await call(similar, "/api/ai/generate-similar-problems", { childId: CHILD, problemId: SOURCE_ID })).status).toBe(429);
  });
});
