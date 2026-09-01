import { z } from "zod";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { uuid } from "@/lib/utils/schemas";

const finishSchema = z.object({
  childId: uuid,
  totalQuestions: z.number().int().min(0).max(100),
  correctCount: z.number().int().min(0).max(100),
  durationSeconds: z.number().int().min(0).max(86_400),
}).refine((value) => value.correctCount <= value.totalQuestions);

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!uuid.safeParse(id).success) return apiError("Invalid learning session");
  const parsed = await parseJson(request, finishSchema);
  if (!parsed.success) return apiError("Invalid learning session");
  const auth = await requireOwnedChild(parsed.data.childId);
  if (auth.response) return auth.response;

  const { data, error } = await auth.supabase.from("learning_sessions")
    .update({
      ended_at: new Date().toISOString(),
      duration_seconds: parsed.data.durationSeconds,
      total_questions: parsed.data.totalQuestions,
      correct_count: parsed.data.correctCount,
    })
    .eq("id", id)
    .eq("child_id", parsed.data.childId)
    .is("ended_at", null)
    .select("id, ended_at, duration_seconds, total_questions, correct_count")
    .maybeSingle();

  if (error) return internalError();
  return data ? apiSuccess(data) : apiError("Learning session not found", 404);
}

