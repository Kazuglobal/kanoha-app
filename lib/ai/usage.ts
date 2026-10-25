import type { AiCostLimits } from "./costGuard";
import { checkDbRateLimit, incrementAiUsage, reserveDailyBudget } from "@/lib/db/operations";
import { todayKeyJst } from "@/lib/utils/date";
import { envNumber } from "@/lib/utils/envNumber";
import { getDb, type Database } from "@/lib/db";

export type AiUsageReservation =
  | { outcome: "allowed"; calls: number; costUsd: number }
  | { outcome: "denied"; calls: number; costUsd: number }
  | { outcome: "unavailable" };

const DAY_SECONDS = 86_400;
const DEFAULT_GLOBAL_DAILY_CALL_LIMIT = 1000;

const DEFAULT_GLOBAL_DAILY_COST_LIMIT_USD = 10;
const MICRO_USD = 1_000_000;

/** アプリ全体の1日(JST)の費用上限(米ドル)。 */
const globalDailyCostLimitUsd = (): number =>
  envNumber("AI_GLOBAL_DAILY_COST_LIMIT_USD", DEFAULT_GLOBAL_DAILY_COST_LIMIT_USD);

/** アプリ全体の1日(JST)の呼び出し上限。アカウントを増やしても全体の総量は増えない。 */
const globalDailyCallLimit = (): number =>
  envNumber("AI_GLOBAL_DAILY_CALL_LIMIT", DEFAULT_GLOBAL_DAILY_CALL_LIMIT);

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

    // ユーザーごとの枠に収まるときだけ、アプリ全体の枠(回数 → 費用の順)を使う。拒否された呼び出しで全体の枠を減らさない。
    const today = todayKeyJst();
    const withinGlobal =
      res.allowed &&
      (await checkDbRateLimit(`global:ai-calls:${today}`, globalDailyCallLimit(), DAY_SECONDS, db)) &&
      (await reserveDailyBudget(
        `global:ai-cost:${today}`,
        Math.round(costUsd * MICRO_USD),
        Math.round(globalDailyCostLimitUsd() * MICRO_USD),
        db,
      ));

    return {
      calls: res.calls,
      costUsd: res.costUsd,
      outcome: res.allowed && withinGlobal ? "allowed" : "denied",
    };
  } catch {
    return { outcome: "unavailable" };
  }
}
