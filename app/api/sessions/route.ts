import { z } from "zod";
import { loadSessionUsage } from "@/lib/review/today";
import { dailyLimitFromSessions } from "@/lib/sessions/dailyLimit";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { uuid } from "@/lib/utils/schemas";
import { checkRateLimitDb } from "@/lib/utils/rateLimit";

const startSchema = z.object({ childId: uuid });
const DEFAULT_LIMIT_MINUTES = 15;

type Supabase = Awaited<ReturnType<typeof requireOwnedChild>>["supabase"];

/**
 * 当日(Asia/Tokyo)の利用時間。終了済みは duration_seconds、未終了は
 * 最終 attempt(無ければ開始)+ 猶予までの経過時間で数える(lib/sessions/dailyLimit.ts)。
 * クライアントの申告値は使わない(B7)。
 */
async function loadDailyLimit(supabase: Supabase, childId: string, now = new Date()) {
  const [settings, sessions] = await Promise.all([
    supabase.from("app_settings")
      .select("daily_limit_minutes")
      .eq("child_id", childId)
      .maybeSingle(),
    loadSessionUsage(supabase, childId, now),
  ]);
  if (settings.error || sessions.error) return null;
  return dailyLimitFromSessions(
    settings.data?.daily_limit_minutes ?? DEFAULT_LIMIT_MINUTES,
    sessions.data,
    now,
  );
}

/** 類題の区切りで呼ばれる上限チェック(セッションは作らない)。 */
export async function GET(request: Request) {
  const childId = new URL(request.url).searchParams.get("childId") ?? "";
  if (!uuid.safeParse(childId).success) return apiError("Invalid learning session");
  const auth = await requireOwnedChild(childId);
  if (auth.response) return auth.response;

  const limit = await loadDailyLimit(auth.supabase, childId);
  return limit ? apiSuccess(limit) : internalError();
}

export async function POST(request: Request) {
  const parsed = await parseJson(request, startSchema);
  if (!parsed.success) return apiError("Invalid learning session");
  const auth = await requireOwnedChild(parsed.data.childId);
  if (auth.response) return auth.response;
  if (!(await checkRateLimitDb(auth.supabase, auth.user!.id, "sessions", 30))) return apiError("Too many requests", 429);

  const limit = await loadDailyLimit(auth.supabase, parsed.data.childId);
  if (!limit) return internalError();
  if (limit.limitReached) return apiSuccess(limit);

  const { data, error } = await auth.supabase.from("learning_sessions").insert({
    child_id: parsed.data.childId,
  }).select("id, started_at").single();

  return error ? internalError() : apiSuccess({ ...data, ...limit }, 201);
}
