import { checkDbRateLimit } from "@/lib/db/operations";

const buckets = new Map<string, { count: number; resetAt: number }>();

/**
 * プロセス内フォールバック(単一インスタンスのデモ/未設定環境向け)。
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
 * DB バックドのレート制限。
 */
export async function checkRateLimitDb(
  userId: string,
  action: string,
  limit: number,
  windowSeconds = 60,
): Promise<boolean> {
  try {
    return await checkDbRateLimit(`${userId}:${action}`, limit, windowSeconds);
  } catch {
    return false;
  }
}
