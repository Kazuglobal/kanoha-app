import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

import { getTalkScene } from "@/lib/curriculum/englishTalkScenes";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { nowJstIso } from "@/lib/utils/date";

const USER = "user-talk-complete-1";
const OTHER_USER = "user-talk-complete-2";
const CHILD = "c1c1c1c1-1111-4111-8111-c1c1c1c1c1c1";
const OTHER_CHILD = "c2c2c2c2-2222-4222-8222-c2c2c2c2c2c2";

const state = vi.hoisted(() => ({ userId: "user-talk-complete-1" as string | null }));

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

import { POST } from "@/app/api/english-talk/complete/route";

const SCENE = "park";
const turnIds = (sceneId = SCENE): string[] => getTalkScene(sceneId)!.turns.map((turn) => turn.id);
const outcomes = (outcome: "clean" | "help" | "teach", sceneId = SCENE) => turnIds(sceneId).map((turnId) => ({ turnId, outcome }));

/** 挑戦ごとの ID(端末が決める UUID)。テストでは番号から作る。 */
const runId = (n = 1): string => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const complete = async (body: unknown) => {
  const res = await POST(
    new Request("http://localhost/api/english-talk/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
  return { status: res.status, body: (await res.json()) as { success: boolean; data?: Record<string, unknown>; error?: string } };
};

describe("POST /api/english-talk/complete", () => {
  const db = getDb();

  beforeEach(async () => {
    state.userId = USER;
    const now = nowJstIso();
    await db.delete(schema.englishTalkProgress).run();
    await db.delete(schema.rateLimits).run();
    for (const [id, userId] of [[CHILD, USER], [OTHER_CHILD, OTHER_USER]] as const) {
      await db.delete(schema.childProfiles).where(eq(schema.childProfiles.id, id)).run();
      await db.insert(schema.users).values({ id: userId, name: "parent", email: `${userId}@example.com`, createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing().run();
      await db.insert(schema.childProfiles).values({ id, userId, nickname: "子", grade: 2, createdAt: now, updatedAt: now }).run();
    }
  });

  const rows = () => db.select().from(schema.englishTalkProgress).all();

  it("ログインしていなければ 401、他人の子どもなら 404(何も記録しない)", async () => {
    state.userId = null;
    expect((await complete({ childId: CHILD, sceneId: SCENE, runId: runId(), outcomes: outcomes("clean") })).status).toBe(401);
    state.userId = USER;
    expect((await complete({ childId: OTHER_CHILD, sceneId: SCENE, runId: runId(), outcomes: outcomes("clean") })).status).toBe(404);
    expect(await rows()).toEqual([]);
  });

  it.each([
    ["結果が空", { childId: CHILD, sceneId: SCENE, runId: runId(), outcomes: [] }],
    ["知らない結果の種類", { childId: CHILD, sceneId: SCENE, runId: runId(), outcomes: [{ turnId: "park-dog", outcome: "perfect" }] }],
    ["childId が UUID でない", { childId: "nope", sceneId: SCENE, runId: runId(), outcomes: outcomes("clean") }],
    ["13 件をこえる", { childId: CHILD, sceneId: SCENE, runId: runId(), outcomes: Array.from({ length: 13 }, (_, index) => ({ turnId: `t${index}`, outcome: "clean" })) }],
    ["挑戦の ID が無い", { childId: CHILD, sceneId: SCENE, outcomes: outcomes("clean") }],
    ["挑戦の ID が UUID でない", { childId: CHILD, sceneId: SCENE, runId: "not-a-uuid", outcomes: outcomes("clean") }],
    ["本文が JSON でない", "{oops"],
  ])("入力が正しくなければ 400: %s", async (_name, body) => {
    expect((await complete(body)).status).toBe(400);
    expect(await rows()).toEqual([]);
  });

  it("知らない場面は 404", async () => {
    expect((await complete({ childId: CHILD, sceneId: "no-such-scene", runId: runId(), outcomes: outcomes("clean") })).status).toBe(404);
  });

  it("その場面のターンぜんぶが 1 回ずつ そろっていなければ 400(一部だけ・重複・ほかの場面のターン)", async () => {
    const all = outcomes("clean");
    expect((await complete({ childId: CHILD, sceneId: SCENE, runId: runId(), outcomes: all.slice(1) })).status).toBe(400);
    expect((await complete({ childId: CHILD, sceneId: SCENE, runId: runId(), outcomes: [...all.slice(1), all[1]] })).status).toBe(400);
    expect((await complete({ childId: CHILD, sceneId: SCENE, runId: runId(), outcomes: [...all.slice(1), { turnId: turnIds("zoo")[0], outcome: "clean" }] })).status).toBe(400);
    expect(await rows()).toEqual([]);
  });

  it("ぜんぶ ヘルプなしで言えたら ★3。記録は 場面・★・回数・日時だけ", async () => {
    const { status, body } = await complete({ childId: CHILD, sceneId: SCENE, runId: runId(), outcomes: outcomes("clean") });
    expect(status).toBe(200);
    expect(body.data).toEqual({ stars: 3, bestStars: 3, clearCount: 1 });
    const [row] = await rows();
    expect(row).toMatchObject({ childId: CHILD, sceneId: SCENE, bestStars: 3, clearCount: 1, lastRunId: runId() });
    expect(Object.keys(row).sort()).toEqual(["bestStars", "childId", "clearCount", "lastClearedAt", "lastRunId", "sceneId"]);
  });

  it("★はサーバーが結果から計算する。端末の申告の★は無視する", async () => {
    const { body } = await complete({ childId: CHILD, sceneId: SCENE, runId: runId(), stars: 3, bestStars: 3, outcomes: outcomes("teach") });
    expect(body.data).toEqual({ stars: 1, bestStars: 1, clearCount: 1 });
  });

  it("ヘルプを使ったぶんは ★が下がる(ぜんぶ help → ★2)。おてほんを見たターンが 1 つでもあれば ★3 にならない", async () => {
    expect((await complete({ childId: CHILD, sceneId: SCENE, runId: runId(1), outcomes: outcomes("help") })).body.data!.stars).toBe(2);
    const oneTaught = outcomes("clean").map((item, index) => (index === 0 ? { ...item, outcome: "teach" as const } : item));
    expect((await complete({ childId: CHILD, sceneId: SCENE, runId: runId(2), outcomes: oneTaught })).body.data!.stars).toBe(2);
  });

  it("最高の★は下がらず、クリアした回数は増える", async () => {
    await complete({ childId: CHILD, sceneId: SCENE, runId: runId(1), outcomes: outcomes("clean") });
    const second = await complete({ childId: CHILD, sceneId: SCENE, runId: runId(2), outcomes: outcomes("teach") });
    expect(second.body.data).toEqual({ stars: 1, bestStars: 3, clearCount: 2 });
    const third = await complete({ childId: CHILD, sceneId: SCENE, runId: runId(3), outcomes: outcomes("clean") });
    expect(third.body.data).toEqual({ stars: 3, bestStars: 3, clearCount: 3 });
    expect(await rows()).toHaveLength(1);
  });

  it("同じ挑戦(同じ runId)が再送されても、回数は 1 回ぶんだけ(返事が失われて送りなおされた場合)。★の最高は保たれる", async () => {
    const first = await complete({ childId: CHILD, sceneId: SCENE, runId: runId(7), outcomes: outcomes("clean") });
    const resent = await complete({ childId: CHILD, sceneId: SCENE, runId: runId(7), outcomes: outcomes("clean") });
    expect(first.body.data).toEqual({ stars: 3, bestStars: 3, clearCount: 1 });
    expect(resent.body.data).toEqual({ stars: 3, bestStars: 3, clearCount: 1 });
    // 同じ挑戦の再送で ★ が低く届いても、最高は下がらず、回数も増えない
    const lower = await complete({ childId: CHILD, sceneId: SCENE, runId: runId(7), outcomes: outcomes("teach") });
    expect(lower.body.data).toEqual({ stars: 1, bestStars: 3, clearCount: 1 });
    // ちがう挑戦は 数える
    expect((await complete({ childId: CHILD, sceneId: SCENE, runId: runId(8), outcomes: outcomes("clean") })).body.data).toEqual({ stars: 3, bestStars: 3, clearCount: 2 });
  });

  it("場面ごとに別の行。ほかの子どもの記録は変わらない", async () => {
    await complete({ childId: CHILD, sceneId: SCENE, runId: runId(1), outcomes: outcomes("clean") });
    await complete({ childId: CHILD, sceneId: "zoo", runId: runId(2), outcomes: outcomes("help", "zoo") });
    expect((await rows()).map((row) => row.sceneId).sort()).toEqual(["park", "zoo"]);
    expect((await rows()).every((row) => row.childId === CHILD)).toBe(true);
  });

  it("1 分に 20 回をこえると 429", async () => {
    for (let index = 0; index < 20; index += 1) expect((await complete({ childId: CHILD, sceneId: SCENE, runId: runId(index + 1), outcomes: outcomes("clean") })).status).toBe(200);
    expect((await complete({ childId: CHILD, sceneId: SCENE, runId: runId(99), outcomes: outcomes("clean") })).status).toBe(429);
  });
});
