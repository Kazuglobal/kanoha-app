import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";

import { ENGLISH_MISTAKE_TYPES, JAPANESE_MISTAKE_TYPES } from "@/lib/curriculum/mistakeTypes";
import { getCurriculumProblemsBySubject } from "@/lib/curriculum/curriculumBank";
import { ensureCurriculumProblem } from "@/lib/curriculum/materialize";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { nowJstIso } from "@/lib/utils/date";

const USER = "user-practice-attempts";
const CHILD = "dadadada-1111-4111-8111-dadadadadada";
const SESSION = "dadadada-2222-4222-8222-dadadadadada";

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

import { POST as attempt } from "@/app/api/attempts/route";

const db = getDb();
let counter = 0;

/** 生成した問題の行(4 択の英語)。 */
async function addGenerated(overrides: Partial<typeof schema.problems.$inferInsert> = {}): Promise<string> {
  counter += 1;
  const id = `1a1a1a1a-0000-4000-8000-${counter.toString().padStart(12, "0")}`;
  const now = nowJstIso();
  await db
    .insert(schema.problems)
    .values({
      id,
      childId: CHILD,
      problemText: `どれが「りんご」? (${counter})`,
      subject: "english",
      unit: "たべもの",
      subUnit: "くだもの",
      correctAnswer: "apple",
      choices: JSON.stringify(["apple", "banana", "cat", "dog"]),
      generatorRef: `たべもの/くだもの/L2/s${counter}`,
      difficultyLevel: 2,
      difficulty: "standard",
      explanationJson: JSON.stringify({ hint1: "h1", hint2: "h2", solution: "s", answer: "a", praise: "p" }),
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .run();
  return id;
}

const post = (body: Record<string, unknown>) =>
  attempt(
    new Request("http://localhost/api/attempts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ childId: CHILD, sessionId: SESSION, answerType: "tap", ...body }),
    }),
  );

const answer = async (problemId: string, childAnswer = "apple", extra: Record<string, unknown> = {}) => {
  const response = await post({ problemId, childAnswer, ...extra });
  return { status: response.status, body: await response.json() };
};

beforeEach(async () => {
  const now = nowJstIso();
  await db.delete(schema.rewardClaims).run();
  await db.delete(schema.childRewards).run();
  await db.delete(schema.attempts).run();
  await db.delete(schema.weaknessMap).run();
  await db.delete(schema.reviewSchedule).run();
  await db.delete(schema.problemHintViews).run();
  await db.delete(schema.problems).run();
  await db.delete(schema.learningSessions).run();
  await db.delete(schema.childProfiles).where(eq(schema.childProfiles.userId, USER)).run();
  await db.insert(schema.users).values({ id: USER, name: "parent", email: `${USER}@example.com`, createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing().run();
  await db.insert(schema.childProfiles).values({ id: CHILD, userId: USER, nickname: "子", grade: 2, createdAt: now, updatedAt: now }).run();
  await db.insert(schema.learningSessions).values({ id: SESSION, childId: CHILD, startedAt: now, createdAt: now, updatedAt: now }).run();
});

afterEach(() => vi.unstubAllEnvs());

describe("生成した問題の答え合わせ(POST /api/attempts)", () => {
  it("4 択の問題は、保存した選択肢の中の答えだけ受け付ける(選択肢にない tap は 400)", async () => {
    const id = await addGenerated();
    expect((await answer(id, "zzz")).status).toBe(400);
    expect(await db.select().from(schema.attempts).all()).toEqual([]);
    const ok = await answer(id, "banana");
    expect(ok.status).toBe(201);
    expect(ok.body.data.is_correct).toBe(false);
    expect((await answer(id, "apple")).body.data.is_correct).toBe(true);
  });

  it("声や文字で答えたとき(tap 以外)は、選択肢の外でも受け付けて判定する", async () => {
    const id = await addGenerated();
    const spoken = await answer(id, "Apple!", { answerType: "voice" });
    expect(spoken.status).toBe(201);
  });

  it("国語・英語のまちがい方の種類も受け付けて 記録する(算数だけの一覧で弾かない)", async () => {
    const id = await addGenerated();
    const english = ENGLISH_MISTAKE_TYPES[0].id;
    const japanese = JAPANESE_MISTAKE_TYPES[0].id;
    const first = await answer(id, "banana", { mistakeType: english });
    expect(first.status).toBe(201);
    expect(first.body.data.mistake_type).toBe(english);
    const second = await answer(id, "cat", { mistakeType: japanese });
    expect(second.body.data.mistake_type).toBe(japanese);
    expect((await answer(id, "dog", { mistakeType: "nonsense" })).status).toBe(400);
  });

  it("正誤は 苦手マップ(weakness_map)に 小単元ごとに記録される", async () => {
    const id = await addGenerated();
    await answer(id, "banana");
    await answer(id, "apple");
    const rows = await db.select().from(schema.weaknessMap).where(eq(schema.weaknessMap.childId, CHILD)).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ unit: "たべもの", subUnit: "くだもの" });
  });
});

describe("セットで作った問題でも、段階ヒントと答え合わせの流れが そのまま動く", () => {
  it("ヒント 1 → 2 → ときかた → こたえ の順に 保存したヒントが開き、最初のヒントに答えは入らない", async () => {
    const { createOrGetPracticeSet } = await import("@/lib/practice/newSet");
    const { POST: hint } = await import("@/app/api/problems/[id]/hint/route");
    const result = await createOrGetPracticeSet(db, { childId: CHILD, subject: "math", more: false });
    if (!result.ok) throw new Error("セットが作れない");
    const item = result.set.items[0];
    const row = (await db.select().from(schema.problems).where(eq(schema.problems.id, item.problemId)).get())!;
    const stored = JSON.parse(row.explanationJson) as Record<string, string>;
    const open = async (level: number) => {
      const response = await hint(
        new Request(`http://localhost/api/problems/${row.id}/hint`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ childId: CHILD, sessionId: SESSION, level }) }),
        { params: Promise.resolve({ id: row.id }) },
      );
      return { status: response.status, body: await response.json() };
    };
    const first = await open(1);
    expect(first.body.data.text).toBe(stored.hint1);
    expect(JSON.stringify(first.body)).not.toContain(stored.solution);
    expect(JSON.stringify(first.body)).not.toContain(stored.answer);
    expect((await open(2)).body.data.text).toBe(stored.hint2);
    expect((await open(3)).body.data.text).toBe(stored.solution);
    expect((await open(4)).body.data.text).toBe(stored.answer);
  });
});

describe("生成した問題の 5円(1 日の上限つき)", () => {
  const claims = (kind: string) => db.select().from(schema.rewardClaims).where(and(eq(schema.rewardClaims.childId, CHILD), eq(schema.rewardClaims.kind, kind))).all();
  const total = async () => (await db.select().from(schema.childRewards).where(eq(schema.childRewards.childId, CHILD)).get())?.totalCorrectCount ?? 0;

  it("生成した問題の正解は 5円に数える(種類は generated)。同じ問題を同じ日に何度解いても 1 回", async () => {
    const id = await addGenerated();
    const first = await answer(id);
    expect(first.body.data.reward).toMatchObject({ totalCorrectCount: 1 });
    const again = await answer(id);
    expect(again.body.data.is_correct).toBe(true);
    expect(again.body.data.reward).toBeNull();
    expect(await claims("generated")).toHaveLength(1);
    expect(await claims("problem")).toHaveLength(0);
    expect(await total()).toBe(1);
  });

  it("1 日に 10 回まで(それ以上は正解になるが 5円は増えない)", async () => {
    const results = [];
    for (let index = 0; index < 12; index += 1) results.push((await answer(await addGenerated())).body.data);
    expect(results.every((data) => data.is_correct)).toBe(true);
    expect(results.map((data) => data.reward !== null)).toEqual([...Array(10).fill(true), false, false]);
    expect(await claims("generated")).toHaveLength(10);
    expect(await total()).toBe(10);
  });

  it("GENERATED_DAILY_REWARD_CAP で上限を変えられる(0 なら数えない)", async () => {
    vi.stubEnv("GENERATED_DAILY_REWARD_CAP", "2");
    for (let index = 0; index < 4; index += 1) await answer(await addGenerated());
    expect(await total()).toBe(2);
    vi.stubEnv("GENERATED_DAILY_REWARD_CAP", "0");
    await answer(await addGenerated());
    expect(await total()).toBe(2);
  });

  it("答えのヒントを見たあとの正解は 数えない(上限の枠も使わない)", async () => {
    vi.stubEnv("GENERATED_DAILY_REWARD_CAP", "1");
    const peeked = await addGenerated();
    await db.insert(schema.problemHintViews).values({ childId: CHILD, problemId: peeked, sessionId: SESSION, maxLevel: 4, updatedAt: nowJstIso() }).run();
    expect((await answer(peeked)).body.data.reward).toBeNull();
    expect((await answer(await addGenerated())).body.data.reward).toMatchObject({ totalCorrectCount: 1 });
  });

  it("問題バンクの問題は これまでどおり(上限なし・種類は problem)", async () => {
    vi.stubEnv("GENERATED_DAILY_REWARD_CAP", "1");
    for (const bank of getCurriculumProblemsBySubject("math").slice(0, 3)) {
      const id = await ensureCurriculumProblem(db, CHILD, bank);
      const result = await answer(id, bank.correctAnswer, { answerType: "text" });
      expect(result.body.data.reward, bank.id).not.toBeNull();
    }
    expect(await claims("problem")).toHaveLength(3);
    expect(await claims("generated")).toHaveLength(0);
  });
});
