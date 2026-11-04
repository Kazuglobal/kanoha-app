import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { nowJstIso } from "@/lib/utils/date";

const journal = JSON.parse(readFileSync("drizzle/migrations/meta/_journal.json", "utf8")) as { entries: { tag: string }[] };
const tag = journal.entries.find((entry) => entry.tag.startsWith("0006_"))?.tag ?? "0006_missing";
const migration = (() => {
  try {
    return readFileSync(`drizzle/migrations/${tag}.sql`, "utf8");
  } catch {
    return "";
  }
})();

describe("migration 0006(自動生成の問題と出題セット)の SQL", () => {
  it("存在する", () => {
    expect(tag).not.toBe("0006_missing");
    expect(migration.length).toBeGreaterThan(0);
  });

  it("problems は列を足すだけ。作り直し(__new_problems)も DROP もない(attempts などの外部キーが壊れるため)", () => {
    expect(migration).not.toMatch(/__new_problems/);
    expect(migration).not.toMatch(/DROP TABLE/i);
    expect(migration).not.toMatch(/RENAME TO/i);
    const alters = migration.match(/ALTER TABLE `problems` ADD `[a-z_]+`/g) ?? [];
    expect(alters.sort()).toEqual([
      "ALTER TABLE `problems` ADD `choices`",
      "ALTER TABLE `problems` ADD `difficulty_level`",
      "ALTER TABLE `problems` ADD `generator_ref`",
      "ALTER TABLE `problems` ADD `listen_text`",
    ]);
  });

  it("足す列はすべて NULL 可(NOT NULL を足すと SQLite は ALTER できない・既存の行も壊れる)", () => {
    for (const statement of migration.split("--> statement-breakpoint").filter((part) => part.includes("ALTER TABLE `problems`"))) {
      expect(statement, statement).not.toMatch(/NOT NULL/i);
    }
  });
});

describe("migration 0006 を適用したあとのテーブル", () => {
  const db = getDb();
  const USER = "user-practice-migration";
  const CHILD = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
  const now = nowJstIso();

  beforeEach(async () => {
    await db.delete(schema.practiceBatches).run();
    await db.delete(schema.problems).run();
    await db.delete(schema.childProfiles).where(eq(schema.childProfiles.id, CHILD)).run();
    await db
      .insert(schema.users)
      .values({ id: USER, name: "parent", email: `${USER}@example.com`, createdAt: new Date(), updatedAt: new Date() })
      .onConflictDoNothing()
      .run();
    await db.insert(schema.childProfiles).values({ id: CHILD, userId: USER, nickname: "子", grade: 2, createdAt: now, updatedAt: now }).run();
  });

  const addProblem = async (id: string, extra: Partial<typeof schema.problems.$inferInsert> = {}) => {
    await db
      .insert(schema.problems)
      .values({ id, childId: CHILD, problemText: "1 + 1 = ?", unit: "たし算", subUnit: "くり上がり", correctAnswer: "2", explanationJson: "{}", createdAt: now, updatedAt: now, ...extra })
      .run();
  };

  const addBatch = async (id: string, seq: number) => {
    await db.insert(schema.practiceBatches).values({ id, childId: CHILD, subject: "math", batchDate: "2026-10-29", seq, createdAt: now }).run();
  };

  it("problems に 4 つの列ができ、いままでの行は列が NULL のまま読める", async () => {
    const columns = await db.all<{ name: string; notnull: number }>(sql`PRAGMA table_info(problems)`);
    for (const name of ["choices", "listen_text", "generator_ref", "difficulty_level"]) {
      expect(columns.find((column) => column.name === name), name).toMatchObject({ notnull: 0 });
    }
    await addProblem("11111111-1111-4111-8111-111111111111");
    const row = await db.select().from(schema.problems).where(eq(schema.problems.id, "11111111-1111-4111-8111-111111111111")).get();
    expect(row).toMatchObject({ choices: null, listenText: null, generatorRef: null, difficultyLevel: null });
  });

  it("生成した問題は choices(JSON)・listen_text・generator_ref・difficulty_level を持てる", async () => {
    await addProblem("22222222-2222-4222-8222-222222222222", {
      choices: JSON.stringify(["a", "b", "c", "d"]),
      listenText: "apple",
      generatorRef: "たし算/くり上がり/L2/seed",
      difficultyLevel: 3,
    });
    const row = await db.select().from(schema.problems).where(eq(schema.problems.id, "22222222-2222-4222-8222-222222222222")).get();
    expect(row).toMatchObject({ listenText: "apple", generatorRef: "たし算/くり上がり/L2/seed", difficultyLevel: 3 });
    expect(JSON.parse(row!.choices!)).toEqual(["a", "b", "c", "d"]);
  });

  it("同じ 子ども×教科×日×セット番号 のセットは 2 つ作れない(リロードや二重送信でセットが増えない)", async () => {
    await addBatch("b1", 1);
    await expect(addBatch("b2", 1)).rejects.toThrow();
    await addBatch("b3", 2);
  });

  it("セットの問題は 位置ごとに 1 つ。セットを消すと、問題の割り当てだけ消える(問題の行は残る)", async () => {
    await addProblem("33333333-3333-4333-8333-333333333333");
    await addBatch("b1", 1);
    await db.insert(schema.practiceBatchItems).values({ batchId: "b1", position: 0, problemId: "33333333-3333-4333-8333-333333333333", reason: "practice" }).run();
    await expect(
      db.insert(schema.practiceBatchItems).values({ batchId: "b1", position: 0, problemId: "33333333-3333-4333-8333-333333333333", reason: "review" }).run(),
    ).rejects.toThrow();

    await db.delete(schema.practiceBatches).where(eq(schema.practiceBatches.id, "b1")).run();
    expect(await db.select().from(schema.practiceBatchItems).all()).toEqual([]);
    expect(await db.select().from(schema.problems).where(eq(schema.problems.id, "33333333-3333-4333-8333-333333333333")).get()).toBeTruthy();
  });

  it("問題を消すと、そのセットの割り当ても消える。子どもを消すとセットも消える", async () => {
    await addProblem("44444444-4444-4444-8444-444444444444");
    await addBatch("b1", 1);
    await db.insert(schema.practiceBatchItems).values({ batchId: "b1", position: 0, problemId: "44444444-4444-4444-8444-444444444444", reason: "practice" }).run();
    await db.delete(schema.problems).where(eq(schema.problems.id, "44444444-4444-4444-8444-444444444444")).run();
    expect(await db.select().from(schema.practiceBatchItems).all()).toEqual([]);

    await db.delete(schema.childProfiles).where(eq(schema.childProfiles.id, CHILD)).run();
    expect(await db.select().from(schema.practiceBatches).all()).toEqual([]);
  });
});
