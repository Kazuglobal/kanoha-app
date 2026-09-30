import { eq, desc } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { apiError, apiSuccess, internalError, requireOwnedChild } from "@/lib/utils/api";
import { uuid } from "@/lib/utils/schemas";

export async function GET(request: Request) {
  const childId = new URL(request.url).searchParams.get("childId") ?? "";
  if (!uuid.safeParse(childId).success) return apiError("Invalid child profile");

  const auth = await requireOwnedChild(childId);
  if (auth.response) return auth.response;

  try {
    const data = await auth.db
      .select({
        id: schema.uploadedMaterials.id,
        page_count: schema.uploadedMaterials.pageCount,
        source_type: schema.uploadedMaterials.sourceType,
        status: schema.uploadedMaterials.status,
        expires_at: schema.uploadedMaterials.expiresAt,
        created_at: schema.uploadedMaterials.createdAt,
      })
      .from(schema.uploadedMaterials)
      .where(eq(schema.uploadedMaterials.childId, childId))
      .orderBy(desc(schema.uploadedMaterials.createdAt))
      .all();

    return apiSuccess(data ?? []);
  } catch {
    return internalError();
  }
}
