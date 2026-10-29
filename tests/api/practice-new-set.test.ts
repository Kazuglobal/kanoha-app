import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { nowJstIso } from "@/lib/utils/date";

const USER = "user-practice-route-1";
const OTHER_USER = "user-practice-route-2";
const CHILD = "abababab-1111-4111-8111-abababababab";
const SESSION = "abababab-3333-4333-8333-abababababab";
const OTHER_CHILD = "cdcdcdcd-2222-4222-8222-cdcdcdcdcdcd";

const state = vi.hoisted(() => ({ userId: "user-practice-route-1" as string | null }));

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

import { POST } from "@/app/api/practice/new-set/route";

const post = async (body: unknown) => {
  const res = await POST(
    new Request("http://localhost/api/practice/new-set", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
  return { status: res.status, body: (await res.json()) as { success: boolean; data?: Record<string, unknown>; error?: string } };
};

describe("POST /api/practice/new-set", () => {
  const db = getDb();

  beforeEach(async () => {
    state.userId = USER;
    const now = nowJstIso();
    await db.delete(schema.attempts).run();
    await db.delete(schema.learningSessions).run();
    await db.delete(schema.practiceBatches).run();
    await db.delete(schema.problems).run();
    await db.delete(schema.rateLimits).run();
    for (const [id, userId] of [[CHILD, USER], [OTHER_CHILD, OTHER_USER]] as const) {
      await db.delete(schema.childProfiles).where(eq(schema.childProfiles.id, id)).run();
      await db.insert(schema.users).values({ id: userId, name: "parent", email: `${userId}@example.com`, createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing().run();
      await db.insert(schema.childProfiles).values({ id, userId, nickname: "子", grade: 2, createdAt: now, updatedAt: now }).run();
    }
    await db.insert(schema.learningSessions).values({ id: SESSION, childId: CHILD, startedAt: now, createdAt: now, updatedAt: now }).run();
  });

  /** セットの問題を ぜんぶ 正解したことにする。 */
  const finish = async (items: readonly { problemId: string }[]) => {
    for (const [index, item] of items.entries()) {
      await db.insert(schema.attempts).values({ id: `fin-${item.problemId}-${index}`, sessionId: SESSION, childId: CHILD, problemId: item.problemId, childAnswer: "1", answerType: "tap", isCorrect: 1, hintLevelUsed: 0, createdAt: nowJstIso() }).run();
    }
  };

  afterEach(() => vi.unstubAllEnvs());

  const batchCount = async () => (await db.select().from(schema.practiceBatches).all()).length;

  it("ログインしていなければ 401(何も作らない)", async () => {
    state.userId = null;
    expect((await post({ childId: CHILD, subject: "math" })).status).toBe(401);
    expect(await batchCount()).toBe(0);
  });

  it("他人の子どもなら 404(セットも問題も作らない)", async () => {
    const { status } = await post({ childId: OTHER_CHILD, subject: "math" });
    expect(status).toBe(404);
    expect(await batchCount()).toBe(0);
    expect(await db.select().from(schema.problems).all()).toEqual([]);
  });

  it.each([
    ["教科が知らない値", { childId: CHILD, subject: "science" }],
    ["childId が UUID でない", { childId: "not-a-uuid", subject: "math" }],
    ["more が真偽値でない", { childId: CHILD, subject: "math", more: "yes" }],
    ["本文が空", ""],
    ["本文が JSON でない", "{oops"],
  ])("入力が正しくなければ 400: %s", async (_name, body) => {
    expect((await post(body)).status).toBe(400);
    expect(await batchCount()).toBe(0);
  });

  it("FEATURE_PRACTICE_GENERATION を止めると 404(何も作らない)", async () => {
    vi.stubEnv("FEATURE_PRACTICE_GENERATION", "0");
    expect((await post({ childId: CHILD, subject: "math" })).status).toBe(404);
    expect(await batchCount()).toBe(0);
  });

  it("今日のセット(5問)を返す。答え・ヒント・生成の手がかりは どこにも入らない", async () => {
    const { status, body } = await post({ childId: CHILD, subject: "math" });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ status: "ready", seq: 1, remainingSets: 2 });
    const items = body.data!.items as Record<string, unknown>[];
    expect(items).toHaveLength(5);
    const text = JSON.stringify(body);
    expect(text).not.toMatch(/correctAnswer|correct_answer|hint1|hint2|solution|generatorRef|generator_ref|explanation|"answer"/);
    // ホームのカードに要る分だけ返す。問題文・選択肢・聞く英語は 問題を開いたときに画面が受け取る
    // (聞く英語は 答えそのものなので、5 問ぶんを先に渡さない)
    expect(text).not.toMatch(/problemText|listenText|choices|"unit"|subUnit|"level"/);
    expect(Object.keys(body.data!).sort()).toEqual(["batchId", "items", "remainingSets", "seq", "status"]);
    for (const item of items) expect(Object.keys(item).sort()).toEqual(["done", "position", "problemId"]);
  });

  it("もういちど呼んでも(リロード)同じセット。more を付けると次のセットで、上限のあとは limit", async () => {
    const first = await post({ childId: CHILD, subject: "math" });
    const again = await post({ childId: CHILD, subject: "math", more: false });
    expect(again.body.data).toEqual(first.body.data);

    await finish(first.body.data!.items as { problemId: string }[]);
    const second = await post({ childId: CHILD, subject: "math", more: true });
    await finish(second.body.data!.items as { problemId: string }[]);
    const third = await post({ childId: CHILD, subject: "math", more: true });
    expect([second.body.data!.seq, third.body.data!.seq]).toEqual([2, 3]);
    expect(third.body.data!.remainingSets).toBe(0);
    await finish(third.body.data!.items as { problemId: string }[]);

    const fourth = await post({ childId: CHILD, subject: "math", more: true });
    expect(fourth.status).toBe(200);
    expect(fourth.body.data).toEqual({ status: "limit", remainingSets: 0 });
    expect(await batchCount()).toBe(3);

    const reload = await post({ childId: CHILD, subject: "math" });
    expect(reload.body.data).toMatchObject({ batchId: third.body.data!.batchId, seq: 3 });
  });

  it("セットが終わっていないうちに more が来ても(古い画面)、いまのセットを返して新しく作らない", async () => {
    const first = await post({ childId: CHILD, subject: "math" });
    const stale = await post({ childId: CHILD, subject: "math", more: true });
    expect(stale.body.data!.batchId).toBe(first.body.data!.batchId);
    expect(await batchCount()).toBe(1);
  });

  it("PRACTICE_MAX_SETS_PER_DAY=0 のときは カードを出さない(empty)。「ぜんぶ できたね」とは言わない", async () => {
    vi.stubEnv("PRACTICE_MAX_SETS_PER_DAY", "0");
    const { status, body } = await post({ childId: CHILD, subject: "math" });
    expect(status).toBe(200);
    expect(body.data).toEqual({ status: "empty", remainingSets: 0 });
  });

  it("教科ごとに別のセット", async () => {
    const math = await post({ childId: CHILD, subject: "math" });
    const english = await post({ childId: CHILD, subject: "english" });
    expect(english.body.data!.batchId).not.toBe(math.body.data!.batchId);
    expect(english.body.data).toMatchObject({ status: "ready", seq: 1 });
  });

  it("セットを読むだけの呼び出し(ホームを開く・教科を切りかえる)は 1 分に 60 回まで。それをこえると 429", async () => {
    for (let index = 0; index < 60; index += 1) expect((await post({ childId: CHILD, subject: "math" })).status).toBe(200);
    expect((await post({ childId: CHILD, subject: "math" })).status).toBe(429);
  });

  it("次のセットを作る呼び出し(more)は 1 分に 10 回まで。読むだけの呼び出しの枠は使わない", async () => {
    for (let index = 0; index < 10; index += 1) expect((await post({ childId: CHILD, subject: "math", more: true })).status).toBe(200);
    expect((await post({ childId: CHILD, subject: "math", more: true })).status).toBe(429);
    expect((await post({ childId: CHILD, subject: "math" })).status).toBe(200);
  });
});
