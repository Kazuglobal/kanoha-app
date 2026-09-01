import { z } from "zod";
import { dailyLimitStatus, tokyoDayRange } from "@/lib/sessions/dailyLimit";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { uuid } from "@/lib/utils/schemas";

const startSchema = z.object({ childId: uuid });

export async function POST(request: Request) {
  const parsed = await parseJson(request, startSchema);
  if (!parsed.success) return apiError("Invalid learning session");
  const auth = await requireOwnedChild(parsed.data.childId);
  if (auth.response) return auth.response;

  const range = tokyoDayRange();
  const [settings, sessions] = await Promise.all([
    auth.supabase.from("app_settings")
      .select("daily_limit_minutes")
      .eq("child_id", parsed.data.childId)
      .maybeSingle(),
    auth.supabase.from("learning_sessions")
      .select("duration_seconds")
      .eq("child_id", parsed.data.childId)
      .not("ended_at", "is", null)
      .gte("started_at", range.start)
      .lt("started_at", range.end),
  ]);
  if (settings.error || sessions.error) return internalError();
  const limit = dailyLimitStatus(
    settings.data?.daily_limit_minutes ?? 15,
    (sessions.data ?? []).map(({ duration_seconds }) => duration_seconds),
  );
  if (limit.reached) return apiSuccess({ ...limit, limitReached: true });

  const { data, error } = await auth.supabase.from("learning_sessions").insert({
    child_id: parsed.data.childId,
  }).select("id, started_at").single();

  return error ? internalError() : apiSuccess({ ...data, ...limit, limitReached: false }, 201);
}
