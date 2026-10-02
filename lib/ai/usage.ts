import type { AiCostLimits } from "./costGuard";
import { incrementAiUsage } from "@/lib/db/operations";
import { getDb, type Database } from "@/lib/db";

export type AiUsageReservation =
  | { outcome: "allowed"; calls: number; costUsd: number }
  | { outcome: "denied"; calls: number; costUsd: number }
  | { outcome: "unavailable" };

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

    return {
      calls: res.calls,
      costUsd: res.costUsd,
      outcome: res.allowed ? "allowed" : "denied",
    };
  } catch {
    return { outcome: "unavailable" };
  }
}
