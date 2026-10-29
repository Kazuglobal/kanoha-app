import { asc, eq, isNotNull } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCurriculumProblemById } from "@/lib/curriculum/curriculumBank";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { generateBatch, type BatchEntry } from "@/lib/generation/batch";
import { createOrGetPracticeSet } from "@/lib/practice/newSet";
import { nowJstIso } from "@/lib/utils/date";

const USER = "user-new-set";
const CHILD = "ffffffff-1111-4111-8111-ffffffffffff";
const SESSION = "ffffffff-2222-4222-8222-ffffffffffff";
const NOW = new Date("2026-10-29T03:00:00.000Z");
const TOMORROW = new Date("2026-10-30T03:00:00.000Z");

const db = getDb();

beforeEach(async () => {
  const now = nowJstIso();
  await db.delete(schema.practiceBatches).run();
  await db.delete(schema.attempts).run();
  await db.delete(schema.problems).run();
  await db.delete(schema.learningSessions).run();
  await db.delete(schema.childProfiles).where(eq(schema.childProfiles.userId, USER)).run();
  await db.insert(schema.users).values({ id: USER, name: "parent", email: `${USER}@example.com`, createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing().run();
  await db.insert(schema.childProfiles).values({ id: CHILD, userId: USER, nickname: "子", grade: 2, createdAt: now, updatedAt: now }).run();
  await db.insert(schema.learningSessions).values({ id: SESSION, childId: CHILD, startedAt: now, createdAt: now, updatedAt: now }).run();
});

afterEach(() => vi.unstubAllEnvs());

const request = (overrides: Partial<Parameters<typeof createOrGetPracticeSet>[1]> = {}) => ({ childId: CHILD, subject: "math" as const, more: false, now: NOW, ...overrides });

async function setOf(overrides: Partial<Parameters<typeof createOrGetPracticeSet>[1]> = {}, deps?: Parameters<typeof createOrGetPracticeSet>[2]) {
  const result = await createOrGetPracticeSet(db, request(overrides), deps);
  if (!result.ok) throw new Error(`セットが作れない: ${result.reason}`);
  return result.set;
}

const allBatches = () => db.select().from(schema.practiceBatches).orderBy(asc(schema.practiceBatches.seq)).all();

describe("createOrGetPracticeSet: 今日の「あたらしい もんだい」", () => {
  it("はじめての呼び出しで、5 問のセット(1 セット目)を作る", async () => {
    const set = await setOf();
    expect(set.seq).toBe(1);
    expect(set.remainingSets).toBe(2);
    expect(set.items).toHaveLength(5);
    expect(set.items.map((item) => item.position)).toEqual([0, 1, 2, 3, 4]);
    const batches = await allBatches();
    expect(batches).toHaveLength(1);
    expect(batches[0]).toMatchObject({ id: set.batchId, childId: CHILD, subject: "math", batchDate: "2026-10-29", seq: 1 });
  });

  it("問題は子どもの problems 行になり、生成した問題には 4 択・手がかり・レベル・ヒントが保存される", async () => {
    const set = await setOf();
    for (const item of set.items) {
      const row = await db.select().from(schema.problems).where(eq(schema.problems.id, item.problemId)).get();
      expect(row, item.problemId).toMatchObject({ childId: CHILD, subject: "math", status: "active", unit: item.unit, subUnit: item.subUnit, problemText: item.problemText });
      if (row?.generatorRef) {
        expect(row.difficultyLevel).toBe(item.level);
        expect(row.generatorRef).toContain(`${item.unit}/${item.subUnit}/L${item.level}/`);
        expect(row.curriculumProblemId).toBeNull();
        expect(Object.keys(JSON.parse(row.explanationJson)).sort()).toEqual(["answer", "hint1", "hint2", "praise", "solution"]);
        expect(row.correctAnswer.length).toBeGreaterThan(0);
        if (row.choices) expect(JSON.parse(row.choices)).toEqual(item.choices);
      }
    }
    expect(set.items.some((item) => item.reason === "practice")).toBe(true);
  });

  it("同じ日にもう一度呼んでも(リロード)、同じセットが返り、新しい行は増えない", async () => {
    const first = await setOf();
    const problemsBefore = (await db.select({ id: schema.problems.id }).from(schema.problems).all()).length;
    const again = await setOf();
    expect(again).toEqual(first);
    expect((await db.select({ id: schema.problems.id }).from(schema.problems).all()).length).toBe(problemsBefore);
    expect(await allBatches()).toHaveLength(1);
  });

  it("more で 2 セット目・3 セット目を作る。セットごとに問題がちがい、のこりの数が減る", async () => {
    const first = await setOf();
    const second = await setOf({ more: true });
    const third = await setOf({ more: true });
    expect([second.seq, third.seq]).toEqual([2, 3]);
    expect([first.remainingSets, second.remainingSets, third.remainingSets]).toEqual([2, 1, 0]);
    const ids = [...first.items, ...second.items, ...third.items].map((item) => item.problemId);
    expect(new Set(ids).size).toBe(ids.length);
    const texts = [first, second, third].map((set) => set.items.map((item) => item.problemText).join("|"));
    expect(new Set(texts).size).toBe(3);
  });

  it("1 日の上限(既定 3 セット)をこえては作らず、行も増えない。リロードは変わらず同じセットを返す", async () => {
    await setOf();
    await setOf({ more: true });
    const third = await setOf({ more: true });
    const problemsBefore = (await db.select({ id: schema.problems.id }).from(schema.problems).all()).length;
    expect(await createOrGetPracticeSet(db, request({ more: true }))).toEqual({ ok: false, reason: "limit" });
    expect((await db.select({ id: schema.problems.id }).from(schema.problems).all()).length).toBe(problemsBefore);
    expect(await allBatches()).toHaveLength(3);
    expect(await setOf()).toEqual(third);
  });

  it("PRACTICE_MAX_SETS_PER_DAY で上限を変えられる。0 ならセットを作らない", async () => {
    vi.stubEnv("PRACTICE_MAX_SETS_PER_DAY", "1");
    await setOf();
    expect(await createOrGetPracticeSet(db, request({ more: true }))).toEqual({ ok: false, reason: "limit" });
    vi.stubEnv("PRACTICE_MAX_SETS_PER_DAY", "0");
    expect(await createOrGetPracticeSet(db, request({ subject: "english" }))).toEqual({ ok: false, reason: "limit" });
    expect(await allBatches()).toHaveLength(1);
  });

  it("教科ごと・日ごとに別のセット(翌日は また 1 セット目から)", async () => {
    const math = await setOf();
    const english = await setOf({ subject: "english" });
    expect(english.seq).toBe(1);
    expect(english.batchId).not.toBe(math.batchId);
    expect(english.items.every((item) => item.unit && item.problemText)).toBe(true);
    const tomorrow = await setOf({ now: TOMORROW });
    expect(tomorrow.seq).toBe(1);
    expect((await allBatches()).map((batch) => `${batch.subject}/${batch.batchDate}/${batch.seq}`).sort()).toEqual(["english/2026-10-29/1", "math/2026-10-29/1", "math/2026-10-30/1"]);
  });

  it("日付は日本時間で数える(UTC の夜は 日本ではもう翌日)", async () => {
    const nearMidnightUtc = new Date("2026-10-29T16:30:00.000Z");
    const set = await setOf({ now: nearMidnightUtc });
    expect((await db.select().from(schema.practiceBatches).where(eq(schema.practiceBatches.id, set.batchId)).get())?.batchDate).toBe("2026-10-30");
  });

  it("子どもに返す内容に、答え・ヒント・生成の手がかりは入らない(キーが決まっている)", async () => {
    const set = await setOf();
    expect(Object.keys(set).sort()).toEqual(["batchId", "items", "remainingSets", "seq"]);
    for (const item of set.items) {
      expect(Object.keys(item).sort()).toEqual(["choices", "done", "level", "listenText", "position", "problemId", "problemText", "reason", "subUnit", "unit"]);
    }
    expect(JSON.stringify(set)).not.toMatch(/correctAnswer|correct_answer|hint1|hint2|solution|generatorRef|generator_ref|explanation/);
  });

  it("正解した問題は done になる(まちがえただけの問題・まだの問題は false)。セットを作った直後は すべて false", async () => {
    const first = await setOf();
    expect(first.items.every((item) => item.done === false)).toBe(true);
    const attempt = (id: string, problemId: string, correct: boolean) =>
      db.insert(schema.attempts).values({ id, sessionId: SESSION, childId: CHILD, problemId, childAnswer: "1", answerType: "tap", isCorrect: correct ? 1 : 0, hintLevelUsed: 0, createdAt: nowJstIso() }).run();
    await attempt("done-0", first.items[0].problemId, true);
    await attempt("miss-1", first.items[1].problemId, false);
    await attempt("done-1-later", first.items[1].problemId, false);
    const reloaded = await setOf();
    expect(reloaded.items.map((item) => item.done)).toEqual([true, false, false, false, false]);
  });

  it("英語のセットの問題は、どれも 4 択(英語は書かせない)。聞く英語があれば ASCII の文", async () => {
    const english = await setOf({ subject: "english" });
    expect(english.items.length).toBeGreaterThan(0);
    for (const item of english.items) {
      expect(item.choices, item.problemText).toHaveLength(4);
      if (item.listenText) expect(item.listenText).toMatch(/^[\x20-\x7e]+$/);
    }
  });
});

describe("出題は子どもの記録で変わる", () => {
  it("まちがえつづけた小単元は おさらい(review)として入る", async () => {
    const now = nowJstIso();
    const problemId = "99999999-9999-4999-8999-999999999999";
    await db.insert(schema.problems).values({ id: problemId, childId: CHILD, problemText: "q", unit: "たし算", subUnit: "くり上がり", correctAnswer: "1", explanationJson: "{}", difficultyLevel: 2, generatorRef: "たし算/くり上がり/L2/old", createdAt: now, updatedAt: now }).run();
    for (let index = 0; index < 5; index += 1) {
      await db.insert(schema.attempts).values({ id: `weak-${index}`, sessionId: SESSION, childId: CHILD, problemId, childAnswer: "0", answerType: "tap", isCorrect: 0, hintLevelUsed: 0, createdAt: new Date(NOW.getTime() - (10 - index) * 60_000).toISOString() }).run();
    }
    const set = await setOf();
    expect(set.items.some((item) => item.reason === "review" && item.unit === "たし算" && item.subUnit === "くり上がり")).toBe(true);
  });
});

describe("バンクの問題と、つくれなかった枠", () => {
  it("生成器のない小単元の枠は、問題バンクの問題を登録して出す(選択肢はバンクのもの)", async () => {
    const set = await setOf({ subject: "japanese" });
    const bankItems = [];
    for (const item of set.items) {
      const row = await db.select().from(schema.problems).where(eq(schema.problems.id, item.problemId)).get();
      if (row?.curriculumProblemId) bankItems.push({ item, row });
    }
    for (const { item, row } of bankItems) {
      const bank = getCurriculumProblemById(row.curriculumProblemId!)!;
      expect(item.problemText).toBe(bank.problemText);
      expect(item.choices).toEqual(bank.choices ?? null);
      expect(row.generatorRef).toBeNull();
    }
  });

  it("生成できなかった枠は、まだ解いていないバンクの問題で代わりにし、同じ問題は重ねない", async () => {
    const failAll = (items: Parameters<typeof generateBatch>[0]): BatchEntry[] =>
      generateBatch(items, () => {
        throw new RangeError("つくれない");
      });
    const set = await setOf({}, { generateBatch: failAll });
    expect(set.items.length).toBeGreaterThan(0);
    const ids = set.items.map((item) => item.problemId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of set.items) {
      const row = await db.select().from(schema.problems).where(eq(schema.problems.id, item.problemId)).get();
      expect(row?.curriculumProblemId, item.problemText).toBeTruthy();
    }
  });

  it("出す問題が 1 つもないとき(代わりのバンクもない)は empty。セットは作らない", async () => {
    const result = await createOrGetPracticeSet(db, request(), { generateBatch: () => [], planBatch: () => [] });
    expect(result).toEqual({ ok: false, reason: "empty" });
    expect(await allBatches()).toHaveLength(0);
  });
});

describe("古い問題の整理", () => {
  it("新しいセットを作るとき、解かれないまま 7 日をこえた自動生成の問題を片づける(解いた問題は残る)", async () => {
    const old = new Date(NOW.getTime() - 9 * 86_400_000).toISOString();
    const add = (id: string) =>
      db.insert(schema.problems).values({ id, childId: CHILD, problemText: id, unit: "たし算", subUnit: "くり上がり", correctAnswer: "1", explanationJson: "{}", generatorRef: `たし算/くり上がり/L2/${id}`, difficultyLevel: 2, createdAt: old, updatedAt: old }).run();
    await add("11111111-0000-4000-8000-00000000aaaa");
    await add("11111111-0000-4000-8000-00000000bbbb");
    await db.insert(schema.attempts).values({ id: "kept", sessionId: SESSION, childId: CHILD, problemId: "11111111-0000-4000-8000-00000000bbbb", childAnswer: "1", answerType: "tap", isCorrect: 1, hintLevelUsed: 0, createdAt: old }).run();
    await setOf();
    const ids = (await db.select({ id: schema.problems.id }).from(schema.problems).all()).map((row) => row.id);
    expect(ids).not.toContain("11111111-0000-4000-8000-00000000aaaa");
    expect(ids).toContain("11111111-0000-4000-8000-00000000bbbb");
  });

  it("整理に失敗しても、セットは作れる", async () => {
    const set = await setOf({}, { prune: () => Promise.reject(new Error("整理できない")) });
    expect(set.items).toHaveLength(5);
  });
});

describe("同時に作られたとき", () => {
  it("同じセット番号を先に作られたら、作りなおさず その先に作られたセットを返す(行は増えない)", async () => {
    const problemId = "88888888-8888-4888-8888-888888888888";
    await db.insert(schema.problems).values({ id: problemId, childId: CHILD, problemText: "先に作られた問題", unit: "たし算", subUnit: "くり上がり", correctAnswer: "1", explanationJson: "{}", createdAt: nowJstIso(), updatedAt: nowJstIso() }).run();
    const racing = new Proxy(db, {
      get(target, property, receiver) {
        if (property !== "batch") return Reflect.get(target, property, receiver);
        return async (statements: never) => {
          // 自分の書き込みの直前に、ほかのリクエストが同じ 1 セット目を作った
          await target.insert(schema.practiceBatches).values({ id: "winner", childId: CHILD, subject: "math", batchDate: "2026-10-29", seq: 1, createdAt: nowJstIso() }).run();
          await target.insert(schema.practiceBatchItems).values({ batchId: "winner", position: 0, problemId, reason: "practice" }).run();
          return Reflect.get(target, "batch", receiver).call(target, statements);
        };
      },
    }) as typeof db;

    const result = await createOrGetPracticeSet(racing, request());
    expect(result.ok && result.set.batchId).toBe("winner");
    expect(result.ok && result.set.items.map((item) => item.problemText)).toEqual(["先に作られた問題"]);
    expect(await allBatches()).toHaveLength(1);
    // 負けたほうの書き込みは取り消される(生成した問題の行が残らない)。バンクの登録は 何度やっても同じなので残ってよい
    const generated = await db.select({ id: schema.problems.id }).from(schema.problems).where(isNotNull(schema.problems.generatorRef)).all();
    expect(generated).toEqual([]);
  });
});
