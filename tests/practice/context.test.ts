import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { loadSetContext } from "@/lib/practice/context";
import { nowJstIso } from "@/lib/utils/date";

const USER = "user-set-context";
const CHILD = "f2f2f2f2-1111-4111-8111-f2f2f2f2f2f2";
const OTHER_CHILD = "f2f2f2f2-2222-4222-8222-f2f2f2f2f2f2";

const db = getDb();
const idOf = (n: number): string => `0000000${n}-0000-4000-8000-000000000000`;

async function addProblem(id: string, childId = CHILD, generated = true): Promise<void> {
  const now = nowJstIso();
  await db
    .insert(schema.problems)
    .values({ id, childId, problemText: `q-${id}`, unit: "たし算", subUnit: "くり上がり", correctAnswer: "1", explanationJson: "{}", generatorRef: generated ? `たし算/くり上がり/L2/${id}` : null, curriculumProblemId: generated ? null : `bank-${id}`, createdAt: now, updatedAt: now })
    .run();
}

async function addBatch(id: string, childId: string, ids: string[], opts: { date?: string; seq?: number; subject?: string } = {}): Promise<void> {
  await db.insert(schema.practiceBatches).values({ id, childId, subject: opts.subject ?? "math", batchDate: opts.date ?? "2026-10-29", seq: opts.seq ?? 1, createdAt: nowJstIso() }).run();
  for (const [position, problemId] of ids.entries()) await db.insert(schema.practiceBatchItems).values({ batchId: id, position, problemId, reason: "practice" }).run();
}

beforeEach(async () => {
  const now = nowJstIso();
  await db.delete(schema.practiceBatches).run();
  await db.delete(schema.problems).run();
  await db.delete(schema.childProfiles).where(eq(schema.childProfiles.userId, USER)).run();
  await db.insert(schema.users).values({ id: USER, name: "parent", email: `${USER}@example.com`, createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing().run();
  for (const id of [CHILD, OTHER_CHILD]) await db.insert(schema.childProfiles).values({ id, userId: USER, nickname: "子", grade: 2, createdAt: now, updatedAt: now }).run();
});

describe("loadSetContext: 問題画面に出す「セットの何問目か」と つぎの問題", () => {
  it("生成した問題は、手がかりなしでも 自分のセットから 位置・問題数・つぎの問題が分かる", async () => {
    for (const n of [1, 2, 3]) await addProblem(idOf(n));
    await addBatch("b1", CHILD, [idOf(1), idOf(2), idOf(3)]);
    expect(await loadSetContext(db, CHILD, { id: idOf(1), generated: true })).toEqual({ batchId: "b1", subject: "math", position: 1, total: 3, nextProblemId: idOf(2) });
    expect(await loadSetContext(db, CHILD, { id: idOf(2), generated: true })).toMatchObject({ position: 2, nextProblemId: idOf(3) });
  });

  it("セットの最後の問題は つぎの問題が null", async () => {
    for (const n of [1, 2]) await addProblem(idOf(n));
    await addBatch("b1", CHILD, [idOf(1), idOf(2)]);
    expect(await loadSetContext(db, CHILD, { id: idOf(2), generated: true })).toMatchObject({ position: 2, total: 2, nextProblemId: null });
  });

  it("問題バンクの問題は、セットの手がかり(batch)を付けたときだけ セットとして扱う", async () => {
    await addProblem(idOf(1), CHILD, false);
    await addProblem(idOf(2));
    await addBatch("b1", CHILD, [idOf(1), idOf(2)]);
    expect(await loadSetContext(db, CHILD, { id: idOf(1), generated: false })).toBeNull();
    expect(await loadSetContext(db, CHILD, { id: idOf(1), generated: false }, "b1")).toMatchObject({ batchId: "b1", position: 1, nextProblemId: idOf(2) });
  });

  it("他の子どものセット・その問題を含まないセットの手がかりは使わない", async () => {
    await addProblem(idOf(1), CHILD, false);
    await addProblem(idOf(2), OTHER_CHILD);
    await addBatch("mine", CHILD, [idOf(1)]);
    await addBatch("theirs", OTHER_CHILD, [idOf(2)]);
    expect(await loadSetContext(db, CHILD, { id: idOf(1), generated: false }, "theirs")).toBeNull();
    expect(await loadSetContext(db, CHILD, { id: idOf(1), generated: false }, "unknown")).toBeNull();
    expect(await loadSetContext(db, OTHER_CHILD, { id: idOf(2), generated: true }, "mine")).toMatchObject({ batchId: "theirs" });
  });

  it("生成した問題が別のセットを指す手がかりを付けられても、自分のセットを使う", async () => {
    await addProblem(idOf(1));
    await addProblem(idOf(2));
    await addBatch("a", CHILD, [idOf(1)], { seq: 1 });
    await addBatch("b", CHILD, [idOf(2)], { seq: 2 });
    expect(await loadSetContext(db, CHILD, { id: idOf(1), generated: true }, "b")).toMatchObject({ batchId: "a" });
  });

  it("バンクの問題が複数の日のセットに入っているときは、手がかりのセットを使う", async () => {
    await addProblem(idOf(1), CHILD, false);
    await addProblem(idOf(2));
    await addProblem(idOf(3));
    await addBatch("old", CHILD, [idOf(1), idOf(2)], { date: "2026-10-28" });
    await addBatch("new", CHILD, [idOf(3), idOf(1)], { date: "2026-10-29" });
    expect(await loadSetContext(db, CHILD, { id: idOf(1), generated: false }, "old")).toMatchObject({ batchId: "old", position: 1, nextProblemId: idOf(2) });
    expect(await loadSetContext(db, CHILD, { id: idOf(1), generated: false }, "new")).toMatchObject({ batchId: "new", position: 2, nextProblemId: null });
  });

  it("整理などで途中の問題が消えても、何問目か・全部で何問かは 残っている問題で数える(4 / 3 にならない)", async () => {
    for (const n of [1, 2, 3, 4]) await addProblem(idOf(n));
    await addBatch("b1", CHILD, [idOf(1), idOf(2), idOf(3), idOf(4)]);
    await db.delete(schema.problems).where(eq(schema.problems.id, idOf(1))).run();
    await db.delete(schema.problems).where(eq(schema.problems.id, idOf(2))).run();
    expect(await loadSetContext(db, CHILD, { id: idOf(3), generated: true })).toMatchObject({ position: 1, total: 2, nextProblemId: idOf(4) });
    expect(await loadSetContext(db, CHILD, { id: idOf(4), generated: true })).toMatchObject({ position: 2, total: 2, nextProblemId: null });
  });

  it("セットに入っていない問題・知らない教科のセットは null", async () => {
    await addProblem(idOf(1));
    expect(await loadSetContext(db, CHILD, { id: idOf(1), generated: true })).toBeNull();
    await addBatch("odd", CHILD, [idOf(1)], { subject: "science" });
    expect(await loadSetContext(db, CHILD, { id: idOf(1), generated: true })).toBeNull();
  });
});
