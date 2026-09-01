import type { createAdminClient } from "@/lib/supabase/admin";
import { todayKeyJst } from "@/lib/utils/date";
import type { AiDailyUsage } from "./costGuard";

type AdminClient = ReturnType<typeof createAdminClient>;

const today = () => todayKeyJst();

export async function getDailyAiUsage(admin: AdminClient, userId: string): Promise<AiDailyUsage> {
  const { data } = await admin
    .from("ai_usage_daily")
    .select("calls, cost_usd")
    .eq("user_id", userId)
    .eq("usage_date", today())
    .maybeSingle();

  return { calls: data?.calls ?? 0, costUsd: data?.cost_usd ?? 0 };
}

export async function recordAiUsage(admin: AdminClient, userId: string, costUsd: number) {
  const usage = await getDailyAiUsage(admin, userId);
  await admin.from("ai_usage_daily").upsert({
    user_id: userId,
    usage_date: today(),
    calls: usage.calls + 1,
    cost_usd: Math.round((usage.costUsd + costUsd) * 1_000_000) / 1_000_000,
    updated_at: new Date().toISOString(),
  });
}
