import { eq, and } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { deleteFromR2 } from "@/lib/storage/r2";
import { apiError, apiSuccess, internalError, requireOwnedChild, requireUser } from "@/lib/utils/api";
import { checkRateLimitDb } from "@/lib/utils/rateLimit";
import { uuid } from "@/lib/utils/schemas";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!uuid.safeParse(id).success) return apiError("Invalid material");

  const lookup = await findMaterial(id);
  if ("response" in lookup) return lookup.response;

  const auth = await requireOwnedChild(lookup.material.child_id);
  if (auth.response) return auth.response;
  if (!(await checkRateLimitDb(auth.user!.id, "materials", 10))) {
    return apiError("Too many requests", 429);
  }

  try {
    const deleted = await auth.db
      .delete(schema.uploadedMaterials)
      .where(
        and(
          eq(schema.uploadedMaterials.id, id),
          eq(schema.uploadedMaterials.childId, lookup.material.child_id),
        ),
      )
      .returning({ id: schema.uploadedMaterials.id })
      .get();

    if (!deleted) return apiError("Material not found", 404);

    let urls: string[] = [];
    try {
      urls = JSON.parse(lookup.material.file_urls);
    } catch {
      urls = [];
    }

    await Promise.all(urls.map(deleteFromR2)).catch(() => {});

    return apiSuccess({ deleted: true });
  } catch {
    return internalError();
  }
}

async function findMaterial(id: string) {
  const auth = await requireUser();
  if (!auth.user) return { response: apiError("Authentication required", 401) };

  try {
    const row = await auth.db
      .select({
        child_id: schema.uploadedMaterials.childId,
        file_urls: schema.uploadedMaterials.fileUrls,
      })
      .from(schema.uploadedMaterials)
      .where(eq(schema.uploadedMaterials.id, id))
      .get();

    if (!row) return { response: apiError("Material not found", 404) };
    return { material: row };
  } catch {
    return { response: internalError() };
  }
}
