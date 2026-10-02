import { eq, and } from "drizzle-orm";
import { childProfileInput } from "@/lib/children/schemas";
import * as schema from "@/lib/db/schema";
import { apiError, apiSuccess, internalError, parseJson, requireUser } from "@/lib/utils/api";
import { checkRateLimitDb } from "@/lib/utils/rateLimit";
import { uuid } from "@/lib/utils/schemas";
import { nowJstIso } from "@/lib/utils/date";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!uuid.safeParse(id).success) return apiError("Invalid child profile");
  const parsed = await parseJson(request, childProfileInput);
  if (!parsed.success) return apiError("Invalid child profile");

  const auth = await requireUser();
  if (!auth.user) return apiError("Authentication required", 401);
  if (!(await checkRateLimitDb(auth.user.id, "children", 10))) {
    return apiError("Too many requests", 429);
  }

  try {
    const updated = await auth.db
      .update(schema.childProfiles)
      .set({
        nickname: parsed.data.nickname,
        grade: parsed.data.grade,
        readingMode: parsed.data.readingMode,
        updatedAt: nowJstIso(),
      })
      .where(and(eq(schema.childProfiles.id, id), eq(schema.childProfiles.userId, auth.user.id)))
      .returning({
        id: schema.childProfiles.id,
        nickname: schema.childProfiles.nickname,
        grade: schema.childProfiles.grade,
        reading_mode: schema.childProfiles.readingMode,
        created_at: schema.childProfiles.createdAt,
        updated_at: schema.childProfiles.updatedAt,
      })
      .get();

    return updated ? apiSuccess(updated) : apiError("Child profile not found", 404);
  } catch {
    return internalError();
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!uuid.safeParse(id).success) return apiError("Invalid child profile");

  const auth = await requireUser();
  if (!auth.user) return apiError("Authentication required", 401);
  if (!(await checkRateLimitDb(auth.user.id, "children", 10))) {
    return apiError("Too many requests", 429);
  }

  try {
    const deleted = await auth.db
      .delete(schema.childProfiles)
      .where(and(eq(schema.childProfiles.id, id), eq(schema.childProfiles.userId, auth.user.id)))
      .returning({ id: schema.childProfiles.id })
      .get();

    return deleted ? apiSuccess({ deleted: true }) : apiError("Child profile not found", 404);
  } catch {
    return internalError();
  }
}
