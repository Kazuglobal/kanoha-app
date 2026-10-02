import { eq } from "drizzle-orm";
import { childProfileInput } from "@/lib/children/schemas";
import * as schema from "@/lib/db/schema";
import { apiError, apiSuccess, internalError, parseJson, requireUser } from "@/lib/utils/api";
import { checkRateLimitDb } from "@/lib/utils/rateLimit";
import { nowJstIso } from "@/lib/utils/date";

/** doc.md §14.2: 1ユーザーあたりの子どもプロフィール上限。 */
const MAX_CHILD_PROFILES = 8;

export async function GET() {
  const auth = await requireUser();
  if (!auth.user) return apiError("Authentication required", 401);

  try {
    const data = await auth.db
      .select({
        id: schema.childProfiles.id,
        nickname: schema.childProfiles.nickname,
        grade: schema.childProfiles.grade,
        reading_mode: schema.childProfiles.readingMode,
        created_at: schema.childProfiles.createdAt,
        updated_at: schema.childProfiles.updatedAt,
      })
      .from(schema.childProfiles)
      .where(eq(schema.childProfiles.userId, auth.user.id))
      .orderBy(schema.childProfiles.createdAt)
      .all();

    return apiSuccess(data ?? []);
  } catch {
    return internalError();
  }
}

export async function POST(request: Request) {
  const parsed = await parseJson(request, childProfileInput);
  if (!parsed.success) return apiError("Invalid child profile");

  const auth = await requireUser();
  if (!auth.user) return apiError("Authentication required", 401);
  if (!(await checkRateLimitDb(auth.user.id, "children", 10))) {
    return apiError("Too many requests", 429);
  }

  try {
    const existing = await auth.db
      .select({ id: schema.childProfiles.id })
      .from(schema.childProfiles)
      .where(eq(schema.childProfiles.userId, auth.user.id))
      .all();

    if ((existing ?? []).length >= MAX_CHILD_PROFILES) {
      return apiError("Child profile limit reached", 400);
    }

    const now = nowJstIso();
    const childId = crypto.randomUUID();

    const created = await auth.db
      .insert(schema.childProfiles)
      .values({
        id: childId,
        userId: auth.user.id,
        nickname: parsed.data.nickname,
        grade: parsed.data.grade,
        readingMode: parsed.data.readingMode,
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        id: schema.childProfiles.id,
        nickname: schema.childProfiles.nickname,
        grade: schema.childProfiles.grade,
        reading_mode: schema.childProfiles.readingMode,
        created_at: schema.childProfiles.createdAt,
        updated_at: schema.childProfiles.updatedAt,
      })
      .get();

    await auth.db
      .insert(schema.appSettings)
      .values({
        id: crypto.randomUUID(),
        childId,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    return apiSuccess(created, 201);
  } catch {
    return internalError();
  }
}
