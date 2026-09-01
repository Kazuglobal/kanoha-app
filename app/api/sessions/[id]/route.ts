import { z } from "zod";
import { clampDurationSeconds, sessionAttemptCounts } from "@/lib/review/loop";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { uuid } from "@/lib/utils/schemas";

/** 正解数・問題数はクライアントから受け取らず、サーバーが attempts から導出する。 */
const finishSchema = z.object({
  childId: uuid,
  durationSeconds: z.number().int().min(0).max(86_400),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!uuid.safeParse(id).success) return apiError("Invalid learning session");
  const parsed = await parseJson(request, finishSchema);
  if (!parsed.success) return apiError("Invalid learning session");
  const auth = await requireOwnedChild(parsed.data.childId);
  if (auth.response) return auth.response;

  const session = await auth.supabase.from("learning_sessions")
    .select("id, started_at, ended_at")
    .eq("id", id)
    .eq("child_id", parsed.data.childId)
    .maybeSingle();
  if (session.error) return internalError();
  if (!session.data || session.data.ended_at) return apiError("Learning session not found", 404);

  const counts = await sessionAttemptCounts(auth.supabase, parsed.data.childId, id);
  if (!counts) return internalError();
  const now = new Date();

  const { data, error } = await auth.supabase.from("learning_sessions")
    .update({
      ended_at: now.toISOString(),
      duration_seconds: clampDurationSeconds(parsed.data.durationSeconds, session.data.started_at, now),
      total_questions: counts.total,
      correct_count: counts.correct,
    })
    .eq("id", id)
    .eq("child_id", parsed.data.childId)
    .is("ended_at", null)
    .select("id, ended_at, duration_seconds, total_questions, correct_count")
    .maybeSingle();

  if (error) return internalError();
  return data ? apiSuccess(data) : apiError("Learning session not found", 404);
}
