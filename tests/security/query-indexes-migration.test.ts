import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";

const journal = JSON.parse(readFileSync("drizzle/migrations/meta/_journal.json", "utf8")) as { entries: { tag: string }[] };
const tag = journal.entries.find((entry) => entry.tag.startsWith("0007_"))?.tag ?? "0007_missing";
const migration = (() => {
  try {
    return readFileSync(`drizzle/migrations/${tag}.sql`, "utf8");
  } catch {
    return "";
  }
})();

describe("migration 0007(問題・記録を引く索引)の SQL", () => {
  it("存在し、索引を足すだけ(表の作り直し・DROP・列の追加はない)", () => {
    expect(tag).not.toBe("0007_missing");
    const statements = migration.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean);
    expect(statements.length).toBeGreaterThan(0);
    for (const statement of statements) expect(statement, statement).toMatch(/^CREATE INDEX `[a-z_]+` ON `[a-z_]+` \(/);
  });
});

describe("migration 0007 を適用したあとの索引", () => {
  const db = getDb();
  const indexesOf = async (table: string): Promise<string[]> =>
    (await db.all<{ name: string }>(sql.raw(`PRAGMA index_list(${table})`))).map((row) => row.name);
  const planOf = async (query: string): Promise<string> =>
    (await db.all<{ detail: string }>(sql.raw(`EXPLAIN QUERY PLAN ${query}`))).map((row) => row.detail).join(" | ");

  it("attempts(記録)に 子ども×時刻 と 子ども×問題 の索引がある", async () => {
    const names = await indexesOf("attempts");
    expect(names).toContain("attempts_child_created_idx");
    expect(names).toContain("attempts_child_problem_idx");
  });

  it("generated_similar_problems(類題)に 子ども×元の問題 の索引がある", async () => {
    expect(await indexesOf("generated_similar_problems")).toContain("generated_similar_child_source_idx");
  });

  it("子どもの記録を新しい順に引く・問題ごとの記録を引く・類題を引く問い合わせが、その索引を使う", async () => {
    expect(await planOf("SELECT id FROM attempts WHERE child_id = 'c' ORDER BY created_at DESC LIMIT 300")).toContain("attempts_child_created_idx");
    expect(await planOf("SELECT 1 FROM attempts WHERE child_id = 'c' AND problem_id = 'p'")).toContain("attempts_child_problem_idx");
    expect(await planOf("SELECT id FROM generated_similar_problems WHERE child_id = 'c' AND source_problem_id = 'p'")).toContain("generated_similar_child_source_idx");
  });
});
