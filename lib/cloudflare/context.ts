import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

export interface KanohaBindings {
  DB?: D1Database;
  STORAGE?: R2Bucket;
}

/**
 * Cloudflare Workers のバインディングを返す。
 * Node.js / テスト環境ではコンテキストが無いので null(呼び出し側でローカル実装へフォールバック)。
 */
export function getCloudflareBindings(): KanohaBindings | null {
  try {
    const ctx = getCloudflareContext();
    return (ctx?.env as KanohaBindings | undefined) ?? null;
  } catch {
    return null;
  }
}
