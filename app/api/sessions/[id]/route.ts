import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";
import * as schema from "@/lib/db/schema";
import { clampDurationSeconds, sessionAttemptCounts } from "@/lib/review/loop";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { uuid } from "@/lib/utils/schemas";
import { checkRateLimitDb } from "@/lib/utils/rateLimit";
import { nowJstIso } from "@/lib/utils/date";

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
  if (!(await checkRateLimitDb(auth.user!.id, "sessions", 30))) {
    return apiError("Too many requests", 429);
  }

  try {
    const session = await auth.db
      .select({
        id: schema.learningSessions.id,
        started_at: schema.learningSessions.startedAt,
        ended_at: schema.learningSessions.endedAt,
      })
      .from(schema.learningSessions)
      .where(and(eq(schema.learningSessions.id, id), eq(schema.learningSessions.childId, parsed.data.childId)))
      .get();

    if (!session || session.ended_at) return apiError("Learning session not found", 404);

    const counts = await sessionAttemptCounts(parsed.data.childId, id, auth.db);
    if (!counts) return internalError();
    const now = new Date();
    const nowIso = nowJstIso(now);

    const updated = await auth.db
      .update(schema.learningSessions)
      .set({
        endedAt: nowIso,
        durationSeconds: clampDurationSeconds(parsed.data.durationSeconds, session.started_at, now),
        totalQuestions: counts.total,
        correctCount: counts.correct,
        updatedAt: nowIso,
      })
      .where(
        and(
          eq(schema.learningSessions.id, id),
          eq(schema.learningSessions.childId, parsed.data.childId),
          isNull(schema.learningSessions.endedAt),
        ),
      )
      .returning({
        id: schema.learningSessions.id,
        ended_at: schema.learningSessions.endedAt,
        duration_seconds: schema.learningSessions.durationSeconds,
        total_questions: schema.learningSessions.totalQuestions,
        correct_count: schema.learningSessions.correctCount,
      })
      .get();

    return updated ? apiSuccess(updated) : apiError("Learning session not found", 404);
  } catch {
    return internalError();
  }
}
