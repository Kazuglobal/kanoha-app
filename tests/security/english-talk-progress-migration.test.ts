import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { nowJstIso } from "@/lib/utils/date";

const journal = JSON.parse(readFileSync("drizzle/migrations/meta/_journal.json", "utf8")) as { entries: { tag: string }[] };
const tag = journal.entries.find((entry) => entry.tag.startsWith("0008_"))?.tag ?? "0008_missing";
const migration = (() => {
  try {
    return readFileSync(`drizzle/migrations/${tag}.sql`, "utf8");
  } catch {
    return "";
  }
})();

describe("migration 0008(英会話の進み具合)の SQL", () => {
  it("存在し、表を 1 つ作るだけ(既存の表は変えない)", () => {
    expect(tag).not.toBe("0008_missing");
    expect(migration).toMatch(/CREATE TABLE `english_talk_progress`/);
    expect(migration).not.toMatch(/DROP TABLE|ALTER TABLE|__new_/i);
    expect(migration.match(/CREATE TABLE/g)).toHaveLength(1);
  });

  it("話した言葉は 保存しない(場面・星・回数・日時だけ)", () => {
    const columns = [...migration.matchAll(/^\t`([a-z_]+)` /gm)].map((match) => match[1]).sort();
    expect(columns).toEqual(["best_stars", "child_id", "clear_count", "last_cleared_at", "last_run_id", "scene_id"]);
  });

  it("★の範囲の検査(CHECK)は 列名に表名を付けない(あとで表を作りなおす移行でも、新しい表の列として読める)", () => {
    expect(migration).toMatch(/CHECK\(best_stars BETWEEN 1 AND 3\)/);
    expect(migration).not.toMatch(/CHECK\([^)]*"english_talk_progress"\./);
  });
});

describe("migration 0008 を適用したあとの english_talk_progress", () => {
  const db = getDb();
  const USER = "user-talk-progress-migration";
  const CHILD = "a4a4a4a4-1111-4111-8111-a4a4a4a4a4a4";
  const now = nowJstIso();

  beforeEach(async () => {
    await db.delete(schema.englishTalkProgress).run();
    await db.delete(schema.childProfiles).where(eq(schema.childProfiles.id, CHILD)).run();
    await db.insert(schema.users).values({ id: USER, name: "parent", email: `${USER}@example.com`, createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing().run();
    await db.insert(schema.childProfiles).values({ id: CHILD, userId: USER, nickname: "子", grade: 2, createdAt: now, updatedAt: now }).run();
  });

  it("子ども×場面で 1 行(主キー)。同じ組は 2 行作れない", async () => {
    await db.insert(schema.englishTalkProgress).values({ childId: CHILD, sceneId: "park", bestStars: 2, clearCount: 1, lastClearedAt: now }).run();
    await expect(db.insert(schema.englishTalkProgress).values({ childId: CHILD, sceneId: "park", bestStars: 3, clearCount: 1, lastClearedAt: now }).run()).rejects.toThrow();
    await db.insert(schema.englishTalkProgress).values({ childId: CHILD, sceneId: "zoo", bestStars: 1, clearCount: 1, lastClearedAt: now }).run();
  });

  it("子どもを消すと、その子の進み具合も消える", async () => {
    await db.insert(schema.englishTalkProgress).values({ childId: CHILD, sceneId: "park", bestStars: 2, clearCount: 1, lastClearedAt: now }).run();
    await db.delete(schema.childProfiles).where(eq(schema.childProfiles.id, CHILD)).run();
    expect(await db.select().from(schema.englishTalkProgress).all()).toEqual([]);
  });

  it("星は 1〜3 だけ(範囲の外は CHECK で止める)", async () => {
    const insert = (bestStars: number) => db.insert(schema.englishTalkProgress).values({ childId: CHILD, sceneId: `s${bestStars}`, bestStars, clearCount: 1, lastClearedAt: now }).run();
    await expect(insert(0)).rejects.toThrow();
    await expect(insert(4)).rejects.toThrow();
    await insert(1);
    await insert(3);
    const table = await db.all<{ sql: string }>(sql`SELECT sql FROM sqlite_master WHERE name = 'english_talk_progress'`);
    expect(table[0].sql).toMatch(/CHECK/i);
  });
});
