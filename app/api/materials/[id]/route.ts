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
  if (!(await checkRateLimitDb(auth.supabase, auth.user!.id, "materials", 10))) return apiError("Too many requests", 429);

  // DB 行を先に消す(逆順だと Storage 成功後の DB 失敗で参照だけが残る)。
  const { data, error } = await auth.supabase
    .from("uploaded_materials")
    .delete()
    .eq("id", id)
    .eq("child_id", lookup.material.child_id)
    .select("id")
    .maybeSingle();

  if (error) return internalError();
  if (!data) return apiError("Material not found", 404);

  try {
    await auth.supabase.storage.from("materials").remove([...lookup.material.file_urls]);
  } catch {
    // DB 上は削除済みが正。オブジェクトの残骸は日次クリーンアップに任せる。
  }
  return apiSuccess({ deleted: true });
}

async function findMaterial(id: string) {
  const auth = await requireUser();
  if (!auth.user) return { response: apiError("Authentication required", 401) };

  const { data, error } = await auth.supabase
    .from("uploaded_materials")
    .select("child_id, file_urls")
    .eq("id", id)
    .maybeSingle();

  if (error) return { response: internalError() };
  if (!data) return { response: apiError("Material not found", 404) };
  return { material: data };
}
