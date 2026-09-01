import { apiError, apiSuccess, internalError, requireOwnedChild } from "@/lib/utils/api";
import { uuid } from "@/lib/utils/schemas";

const materialColumns = "id, page_count, source_type, status, expires_at, created_at";

export async function GET(request: Request) {
  const childId = new URL(request.url).searchParams.get("childId") ?? "";
  if (!uuid.safeParse(childId).success) return apiError("Invalid child profile");

  const auth = await requireOwnedChild(childId);
  if (auth.response) return auth.response;

  const { data, error } = await auth.supabase
    .from("uploaded_materials")
    .select(materialColumns)
    .eq("child_id", childId)
    .order("created_at", { ascending: false });

  return error ? internalError() : apiSuccess(data ?? []);
}
