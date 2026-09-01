import { childProfileInput } from "@/lib/children/schemas";
import { apiError, apiSuccess, internalError, parseJson, requireUser } from "@/lib/utils/api";
import { uuid } from "@/lib/utils/schemas";

const profileColumns = "id, nickname, grade, reading_mode, created_at, updated_at";
type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!uuid.safeParse(id).success) return apiError("Invalid child profile");
  const parsed = await parseJson(request, childProfileInput);
  if (!parsed.success) return apiError("Invalid child profile");

  const auth = await requireUser();
  if (!auth.user) return apiError("Authentication required", 401);

  const { data, error } = await auth.supabase
    .from("child_profiles")
    .update({
      nickname: parsed.data.nickname,
      grade: parsed.data.grade,
      reading_mode: parsed.data.readingMode,
    })
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select(profileColumns)
    .maybeSingle();

  if (error) return internalError();
  return data ? apiSuccess(data) : apiError("Child profile not found", 404);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!uuid.safeParse(id).success) return apiError("Invalid child profile");

  const auth = await requireUser();
  if (!auth.user) return apiError("Authentication required", 401);

  const { data, error } = await auth.supabase
    .from("child_profiles")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("id")
    .maybeSingle();

  if (error) return internalError();
  return data ? apiSuccess({ deleted: true }) : apiError("Child profile not found", 404);
}

