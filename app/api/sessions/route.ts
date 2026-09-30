import { eq } from "drizzle-orm";
import { z } from "zod";
import * as schema from "@/lib/db/schema";
import { loadSessionUsage } from "@/lib/review/today";
import { dailyLimitFromSessions } from "@/lib/sessions/dailyLimit";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { uuid } from "@/lib/utils/schemas";
import { checkRateLimitDb } from "@/lib/utils/rateLimit";
import { nowJstIso } from "@/lib/utils/date";
import type { Database } from "@/lib/db";

const startSchema = z.object({ childId: uuid });
const DEFAULT_LIMIT_MINUTES = 15;

async function loadDailyLimit(db: Database, childId: string, now = new Date()) {
  try {
    const [settings, sessions] = await Promise.all([
      db
        .select({ dailyLimitMinutes: schema.appSettings.dailyLimitMinutes })
        .from(schema.appSettings)
        .where(eq(schema.appSettings.childId, childId))
        .get(),
      loadSessionUsage(childId, now, db),
    ]);
    if (sessions.error) return null;
    return dailyLimitFromSessions(
      settings?.dailyLimitMinutes ?? DEFAULT_LIMIT_MINUTES,
      sessions.data,
      now,
    );
  } catch {
    return null;
  }
}

/** 類題の区切りで呼ばれる上限チェック(セッションは作らない)。 */
export async function GET(request: Request) {
  const childId = new URL(request.url).searchParams.get("childId") ?? "";
  if (!uuid.safeParse(childId).success) return apiError("Invalid learning session");
  const auth = await requireOwnedChild(childId);
  if (auth.response) return auth.response;

  const limit = await loadDailyLimit(auth.db, childId);
  return limit ? apiSuccess(limit) : internalError();
}

export async function POST(request: Request) {
  const parsed = await parseJson(request, startSchema);
  if (!parsed.success) return apiError("Invalid learning session");
  const auth = await requireOwnedChild(parsed.data.childId);
  if (auth.response) return auth.response;
  if (!(await checkRateLimitDb(auth.user!.id, "sessions", 30))) {
    return apiError("Too many requests", 429);
  }

  const limit = await loadDailyLimit(auth.db, parsed.data.childId);
  if (!limit) return internalError();
  if (limit.limitReached) return apiSuccess(limit);

  const sessionId = crypto.randomUUID();
  const now = nowJstIso();

  try {
    const data = await auth.db
      .insert(schema.learningSessions)
      .values({
        id: sessionId,
        childId: parsed.data.childId,
        startedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        id: schema.learningSessions.id,
        started_at: schema.learningSessions.startedAt,
      })
      .get();

    return apiSuccess({ ...data, ...limit }, 201);
  } catch {
    return internalError();
  }
}
