import { drizzle } from "drizzle-orm/d1";
import type { D1Database } from "@cloudflare/workers-types";
import { DatabaseSync } from "node:sqlite";
import * as schema from "./schema";

/**
 * node:sqlite を使用したローカル/テスト用の D1 エミュレータ
 */
let localDbSync: DatabaseSync | null = null;
let localD1Instance: D1Database | null = null;

export const createLocalD1 = (dbSync = new DatabaseSync(":memory:")): D1Database => {
  return {
    prepare(query: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async all() {
              const stmt = dbSync.prepare(query);
              const rows = stmt.all(...(params as any[]));
              return { results: rows, success: true };
            },
            async run() {
              const stmt = dbSync.prepare(query);
              const info = stmt.run(...(params as any[]));
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
              const row = stmt.get(...(params as any[])) as Record<string, unknown> | undefined;
              if (!row) return null;
              return col ? row[col] : row;
            },
            async raw() {
              const stmt = dbSync.prepare(query);
              return stmt.all(...(params as any[])).map((r) => Object.values(r as Record<string, unknown>));
            },
          } as any;
        },
      } as any;
    },
    async batch(stmts: any[]) {
      return Promise.all(stmts.map((s) => s.all()));
    },
    async exec(query: string) {
      dbSync.exec(query);
      return { count: 1, duration: 0 };
    },
  } as unknown as D1Database;
};

/**
 * D1 データベースインスタンスの解決
 */
export const getD1Database = (): D1Database => {
  // 1. Cloudflare Workers ランタイムでの binding チェック
  try {
    const { getCloudflareContext } = require("@opennextjs/cloudflare");
    const ctx = getCloudflareContext();
    if (ctx?.env?.DB) {
      return ctx.env.DB as D1Database;
    }
  } catch {
    // Node.js / テスト環境
  }

  // 2. ローカル / テスト用エミュレータ
  if (!localD1Instance) {
    localDbSync = new DatabaseSync(":memory:");
    try {
      const fs = require("node:fs");
      const path = require("node:path");
      const sqlPath = path.join(process.cwd(), "drizzle/migrations/0000_fast_stephen_strange.sql");
      if (fs.existsSync(sqlPath)) {
        const sql = fs.readFileSync(sqlPath, "utf8");
        // SQLite exec does not support comments starting with --> if parsed strictly, so strip statement breakpoints
        const cleanSql = sql.replace(/--> statement-breakpoint/g, "");
        localDbSync.exec(cleanSql);
      }
    } catch (err) {
      console.warn("Failed to auto-apply migrations to in-memory SQLite:", err);
    }
    localD1Instance = createLocalD1(localDbSync);
  }
  return localD1Instance;
};

/**
 * Drizzle クライアントの取得
 */
export const getDb = (d1: D1Database = getD1Database()) => {
  return drizzle(d1, { schema });
};

export type Database = ReturnType<typeof getDb>;
export * from "./schema";
