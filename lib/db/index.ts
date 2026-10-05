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

export const createLocalD1 = (dbSync: DatabaseSync = newMemoryDb()): D1Database => {
  return {
    prepare(query: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async all() {
              const stmt = dbSync.prepare(query);
              const rows = stmt.all(...(params as SQLInputValue[]));
              return { results: rows, success: true };
            },
            async run() {
              const stmt = dbSync.prepare(query);
              const info = stmt.run(...(params as SQLInputValue[]));
              return {
                success: true,
                meta: {
                  changes: info.changes,
                  last_row_id: Number(info.lastInsertRowid),
                },
              };
            },
            async first(col?: string) {
              const stmt = dbSync.prepare(query);
              const row = stmt.get(...(params as SQLInputValue[])) as Record<string, unknown> | undefined;
              if (!row) return null;
              return col ? row[col] : row;
            },
            async raw() {
              const stmt = dbSync.prepare(query);
              return stmt.all(...(params as SQLInputValue[])).map((r) => Object.values(r as Record<string, unknown>));
            },
          };
        },
      };
    },
    async batch(stmts: { all: () => Promise<unknown> }[]) {
      return Promise.all(stmts.map((s) => s.all()));
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
