import type { AiCostLimits } from "./costGuard";
import { checkDbRateLimit, incrementAiUsage } from "@/lib/db/operations";
import { todayKeyJst } from "@/lib/utils/date";
import { getDb, type Database } from "@/lib/db";

export type AiUsageReservation =
  | { outcome: "allowed"; calls: number; costUsd: number }
  | { outcome: "denied"; calls: number; costUsd: number }
  | { outcome: "unavailable" };

const DAY_SECONDS = 86_400;
const DEFAULT_GLOBAL_DAILY_CALL_LIMIT = 1000;

/** アプリ全体の1日(JST)の呼び出し上限。アカウントを増やしても全体の総量は増えない。 */
const globalDailyCallLimit = (): number => {
  const configured = Number(process.env.AI_GLOBAL_DAILY_CALL_LIMIT);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_GLOBAL_DAILY_CALL_LIMIT;
};

/**
 * プロバイダ呼び出しの「前」に当日(JST)の利用枠を原子的に予約する。
 */
export async function reserveAiUsage(
  userId: string,
  costUsd: number,
  limits: AiCostLimits,
  db: Database = getDb(),
): Promise<AiUsageReservation> {
  try {
    const res = await incrementAiUsage(
      userId,
      costUsd,
      limits.dailyCallLimit,
      limits.dailyCostLimitUsd,
      db,
    );

    // ユーザーごとの枠に収まるときだけ、アプリ全体の枠を使う(拒否された呼び出しで全体の枠を減らさない)
    const withinGlobal =
      res.allowed &&
      (await checkDbRateLimit(`global:ai-calls:${todayKeyJst()}`, globalDailyCallLimit(), DAY_SECONDS, db));

    return {
      calls: res.calls,
      costUsd: res.costUsd,
      outcome: res.allowed && withinGlobal ? "allowed" : "denied",
    };
  } catch {
    return { outcome: "unavailable" };
  }
}
