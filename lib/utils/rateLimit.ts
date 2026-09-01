import type { SupabaseClient } from "@supabase/supabase-js";

const buckets = new Map<string, { count: number; resetAt: number }>();

/**
 * プロセス内フォールバック(単一インスタンスのデモ/未設定環境向け)。
 * mutating ルートは DB バックドの checkRateLimitDb を使う(B10)。
 */
export function checkRateLimit(key: string, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  buckets.set(key, { ...current, count: current.count + 1 });
  return true;
}

/**
 * DB バックドのレート制限(0012 の check_rate_limit RPC、アトミック upsert)。
 * キーは `${userId}:${action}`。RPC 側で auth.uid() プレフィックスを強制する。
 * RPC エラー時は fail-closed(false = 429)。
 */
export async function checkRateLimitDb(
  supabase: SupabaseClient,
  userId: string,
  action: string,
  limit: number,
  windowSeconds = 60,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_key: `${userId}:${action}`,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  return !error && data === true;
}
