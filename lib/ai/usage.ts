import type { createClient } from "@/lib/supabase/server";

import type { AiCostLimits } from "./costGuard";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type AiUsageReservation =
  | { outcome: "allowed"; calls: number; costUsd: number }
  | { outcome: "denied"; calls: number; costUsd: number }
  | { outcome: "unavailable" };

/**
 * increment_ai_usage RPC(0011)で、プロバイダ呼び出しの「前」に当日(JST)の利用枠を
 * 原子的に予約する。上限超過は denied、RPC エラー・不正応答は unavailable(フェイルクローズ)。
 * プロバイダ側が失敗しても払い戻しはしない(読んだ分は使った扱い)。
 */
export async function reserveAiUsage(
  supabase: Supabase,
  userId: string,
  costUsd: number,
  limits: AiCostLimits,
): Promise<AiUsageReservation> {
  const { data, error } = await supabase.rpc("increment_ai_usage", {
    p_call_limit: limits.dailyCallLimit,
    p_cost: costUsd,
    p_cost_limit: limits.dailyCostLimitUsd,
    p_user: userId,
  });
  if (error) return { outcome: "unavailable" };

  const row = (Array.isArray(data) ? data[0] : data) as
    | { allowed?: unknown; calls?: unknown; cost_usd?: unknown }
    | null
    | undefined;
  if (!row || typeof row.allowed !== "boolean") return { outcome: "unavailable" };
  return {
    calls: Number(row.calls ?? 0),
    costUsd: Number(row.cost_usd ?? 0),
    outcome: row.allowed ? "allowed" : "denied",
  };
}
