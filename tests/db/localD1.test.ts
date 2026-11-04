import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/d1";
import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { beforeEach, describe, expect, it } from "vitest";
import { createLocalD1 } from "@/lib/db";

const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  body: text("body").notNull(),
  rank: integer("rank").notNull().default(0),
});

describe("ローカル D1 エミュレータの batch(本物の D1 と同じく、全部成功するか、全部なかったことになる)", () => {
  let raw: DatabaseSync;
  let db: ReturnType<typeof drizzle>;

  beforeEach(() => {
    raw = new DatabaseSync(":memory:");
    raw.exec("CREATE TABLE notes (id TEXT PRIMARY KEY NOT NULL, body TEXT NOT NULL, rank INTEGER NOT NULL DEFAULT 0)");
    db = drizzle(createLocalD1(raw));
  });

  const count = (): number => Number((raw.prepare("SELECT COUNT(*) AS n FROM notes").get() as { n: number }).n);

  it("文を順番どおりに実行する(あとの文は前の文の結果を使える)", async () => {
    await db.batch([
      db.insert(notes).values({ id: "a", body: "first" }),
      db.update(notes).set({ body: "second" }).where(sql`${notes.id} = 'a'`),
      db.insert(notes).values({ id: "b", body: "other", rank: 2 }),
    ]);
    const rows = raw.prepare("SELECT id, body, rank FROM notes ORDER BY id").all();
    expect(rows).toEqual([
      { id: "a", body: "second", rank: 0 },
      { id: "b", body: "other", rank: 2 },
    ]);
  });

  it("途中の文が失敗したら、それまでの文もなかったことになる(原子的)", async () => {
    await db.insert(notes).values({ id: "dup", body: "already" });
    await expect(
      db.batch([db.insert(notes).values({ id: "new", body: "x" }), db.insert(notes).values({ id: "dup", body: "y" }), db.insert(notes).values({ id: "later", body: "z" })]),
    ).rejects.toThrow();
    expect(raw.prepare("SELECT id FROM notes ORDER BY id").all()).toEqual([{ id: "dup" }]);
  });

  it("失敗したあとも、次の batch がふつうに使える(開きっぱなしの取引が残らない)", async () => {
    await expect(db.batch([db.insert(notes).values({ id: "x", body: "1" }), db.insert(notes).values({ id: "x", body: "2" })])).rejects.toThrow();
    await db.batch([db.insert(notes).values({ id: "y", body: "ok" })]);
    expect(count()).toBe(1);
  });

  it("値を持たない文(条件なしの delete)も batch に入れられる", async () => {
    await db.insert(notes).values({ id: "a", body: "a" });
    await db.batch([db.delete(notes), db.insert(notes).values({ id: "b", body: "b" })]);
    expect(raw.prepare("SELECT id FROM notes").all()).toEqual([{ id: "b" }]);
  });

  it("結合した表に同じ名前の列があっても、列の位置で読める(本物の D1 の raw と同じ)", async () => {
    const left = sqliteTable("left_side", { unit: text("unit") });
    const right = sqliteTable("right_side", { unit: text("unit") });
    raw.exec("CREATE TABLE left_side (unit TEXT); CREATE TABLE right_side (unit TEXT); INSERT INTO left_side VALUES ('x'); INSERT INTO right_side VALUES ('y')");
    const rows = await db.select({ a: left.unit, b: right.unit }).from(left).leftJoin(right, sql`1 = 1`).all();
    expect(rows).toEqual([{ a: "x", b: "y" }]);
  });

  it("setReturnArrays が無い古い Node では、同じ名前の列を黙って取りちがえず エラーにする", async () => {
    const withoutSetReturnArrays = (target: DatabaseSync): DatabaseSync =>
      new Proxy(target, {
        get(source, property) {
          if (property !== "prepare") {
            const value = Reflect.get(source, property);
            return typeof value === "function" ? value.bind(source) : value;
          }
          return (query: string) =>
            new Proxy(source.prepare(query), {
              get(statement, member) {
                if (member === "setReturnArrays") return undefined;
                const value = Reflect.get(statement, member);
                return typeof value === "function" ? value.bind(statement) : value;
              },
            });
        },
      });
    const old = createLocalD1(withoutSetReturnArrays(raw));
    await expect(old.prepare("SELECT 1").bind().raw()).rejects.toThrow(/22\.16/);
  });

  it("結果は文の順に返る", async () => {
    const [first, second] = await db.batch([
      db.insert(notes).values({ id: "a", body: "a" }).returning({ id: notes.id }),
      db.select({ id: notes.id }).from(notes),
    ]);
    expect(first).toEqual([{ id: "a" }]);
    expect(second).toEqual([{ id: "a" }]);
  });
});
