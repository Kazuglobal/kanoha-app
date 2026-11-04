import { drizzle } from "drizzle-orm/d1";
import type { D1Database } from "@cloudflare/workers-types";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { getCloudflareBindings } from "@/lib/cloudflare/context";
import * as schema from "./schema";

type SqliteModule = typeof import("node:sqlite");
type FsModule = typeof import("node:fs");
type PathModule = typeof import("node:path");

/**
 * Node 組み込みモジュールを実行時に解決する(静的 import すると Vite/Workers のバンドルに失敗するため)。
 */
const builtin = <T>(name: string): T =>
  (process as unknown as { getBuiltinModule: (id: string) => T }).getBuiltinModule(name);

const newMemoryDb = (): DatabaseSync =>
  new (builtin<SqliteModule>("node:sqlite").DatabaseSync)(":memory:");

/**
 * node:sqlite を使用したローカル/テスト用の D1 エミュレータ
 */
/**
 * ローカル用 in-memory D1 はプロセスで 1 つだけにする。
 * Next はページ(RSC)と Route Handler を別々にバンドルするため、モジュール変数だと
 * DB が 2 つに分かれ、API で作ったセッションや行がページから見えなくなる。
 */
const localStore = globalThis as typeof globalThis & { __kanohaLocalD1?: D1Database };

/** batch が 1 回も席をゆずらずに(割り込まれずに)文を流すための、同期の実行口。 */
const runSync = Symbol("runSync");

interface LocalStatement {
  bind(...params: unknown[]): LocalStatement;
  all(): Promise<{ results: unknown[]; success: true }>;
  run(): Promise<{ success: true; meta: { changes: number | bigint; last_row_id: number } }>;
  first(col?: string): Promise<unknown>;
  raw(): Promise<unknown[][]>;
  [runSync](): unknown[];
}

const createStatement = (dbSync: DatabaseSync, query: string, params: unknown[]): LocalStatement => {
  const args = params as SQLInputValue[];
  const rows = () => dbSync.prepare(query).all(...args);
  return {
    bind: (...next) => createStatement(dbSync, query, next),
    async all() {
      return { results: rows(), success: true as const };
    },
    async run() {
      const info = dbSync.prepare(query).run(...args);
      return { success: true as const, meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) } };
    },
    async first(col?: string) {
      const row = dbSync.prepare(query).get(...args) as Record<string, unknown> | undefined;
      if (!row) return null;
      return col ? row[col] : row;
    },
    async raw() {
      // 位置で返す(本物の D1 の raw と同じ)。オブジェクトで返すと、結合した表の同じ名前の列(unit など)が 1 つに潰れる。
      // setReturnArrays は Node 22.16 / 24 から。無い Node で黙って列を取りちがえるより、止めて知らせる。
      const stmt = dbSync.prepare(query);
      if (typeof stmt.setReturnArrays !== "function") {
        throw new Error("ローカルの D1 エミュレータには Node 22.16 以上が必要です(node:sqlite の setReturnArrays)。");
      }
      stmt.setReturnArrays(true);
      return stmt.all(...args) as unknown as unknown[][];
    },
    [runSync]: rows,
  };
};

export const createLocalD1 = (dbSync: DatabaseSync = newMemoryDb()): D1Database => {
  return {
    prepare: (query: string) => createStatement(dbSync, query, []),
    /**
     * 本物の D1 の batch と同じく、全部の文が成功するか、1 つでも失敗したら全部なかったことになる。
     * 途中で席をゆずる(await する)と、ほかのリクエストの文が取引の中に入りこむので、文はすべて同期で流す。
     */
    async batch(stmts: LocalStatement[]) {
      dbSync.exec("BEGIN");
      try {
        const results = stmts.map((stmt) => ({ results: stmt[runSync](), success: true }));
        dbSync.exec("COMMIT");
        return results;
      } catch (error) {
        dbSync.exec("ROLLBACK");
        throw error;
      }
    },
    async exec(query: string) {
      dbSync.exec(query);
      return { count: 1, duration: 0 };
    },
  } as unknown as D1Database;
};

/**
 * drizzle/migrations の SQL を journal 順にすべて適用する(ローカル/テスト用 in-memory DB)。
 * 失敗はスキーマ不整合を隠さないよう例外のまま投げる。
 */
const applyLocalMigrations = (db: DatabaseSync): void => {
  const fs = builtin<FsModule>("node:fs");
  const path = builtin<PathModule>("node:path");
  const dir = path.join(process.cwd(), "drizzle/migrations");
  const journalPath = path.join(dir, "meta/_journal.json");
  if (!fs.existsSync(journalPath)) return;
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as { entries: { tag: string }[] };
  for (const { tag } of journal.entries) {
    const sql = fs.readFileSync(path.join(dir, `${tag}.sql`), "utf8");
    db.exec(sql.replace(/--> statement-breakpoint/g, ""));
  }
};

/**
 * D1 データベースインスタンスの解決
 */
export const getD1Database = (): D1Database => {
  // 1. Cloudflare Workers ランタイムでの binding チェック
  const bindings = getCloudflareBindings();
  if (bindings?.DB) return bindings.DB;

  // 2. ローカル / テスト用エミュレータ
  if (!localStore.__kanohaLocalD1) {
    const db = newMemoryDb();
    applyLocalMigrations(db);
    localStore.__kanohaLocalD1 = createLocalD1(db);
  }
  return localStore.__kanohaLocalD1;
};

/**
 * Drizzle クライアントの取得
 */
export const getDb = (d1: D1Database = getD1Database()) => {
  return drizzle(d1, { schema });
};

export type Database = ReturnType<typeof getDb>;
export * from "./schema";
