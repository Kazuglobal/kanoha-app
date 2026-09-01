import { z } from "zod";
import { dailyLimitFromSessions, tokyoDayRange, type SessionUsage } from "@/lib/sessions/dailyLimit";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { uuid } from "@/lib/utils/schemas";

const startSchema = z.object({ childId: uuid });
const DEFAULT_LIMIT_MINUTES = 15;

type Supabase = Awaited<ReturnType<typeof requireOwnedChild>>["supabase"];

/**
 * 当日(Asia/Tokyo)の利用時間。終了済みは duration_seconds、未終了は now - started_at で数える。
 * クライアントの申告値は使わない(B7)。
 */
async function loadDailyLimit(supabase: Supabase, childId: string, now = new Date()) {
  const range = tokyoDayRange(now);
  const [settings, sessions] = await Promise.all([
    supabase.from("app_settings")
      .select("daily_limit_minutes")
      .eq("child_id", childId)
      .maybeSingle(),
    supabase.from("learning_sessions")
      .select("started_at, ended_at, duration_seconds")
      .eq("child_id", childId)
      .gte("started_at", range.start)
      .lt("started_at", range.end),
  ]);
  if (settings.error || sessions.error) return null;
  return dailyLimitFromSessions(
    settings.data?.daily_limit_minutes ?? DEFAULT_LIMIT_MINUTES,
    (sessions.data ?? []) as SessionUsage[],
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

  const limit = await loadDailyLimit(auth.supabase, parsed.data.childId);
  if (!limit) return internalError();
  if (limit.limitReached) return apiSuccess(limit);

  const { data, error } = await auth.supabase.from("learning_sessions").insert({
    child_id: parsed.data.childId,
  }).select("id, started_at").single();

  return error ? internalError() : apiSuccess({ ...data, ...limit }, 201);
}
