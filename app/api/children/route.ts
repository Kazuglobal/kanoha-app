import { childProfileInput } from "@/lib/children/schemas";
import { apiError, apiSuccess, internalError, parseJson, requireUser } from "@/lib/utils/api";

const profileColumns = "id, nickname, grade, reading_mode, created_at, updated_at";

export async function GET() {
  const auth = await requireUser();
  if (!auth.user) return apiError("Authentication required", 401);

  const { data, error } = await auth.supabase
    .from("child_profiles")
    .select(profileColumns)
    .eq("user_id", auth.user.id)
    .order("created_at");

  return error ? internalError() : apiSuccess(data ?? []);
}

export async function POST(request: Request) {
  const parsed = await parseJson(request, childProfileInput);
  if (!parsed.success) return apiError("Invalid child profile");

  const auth = await requireUser();
  if (!auth.user) return apiError("Authentication required", 401);

  const { data, error } = await auth.supabase
    .from("child_profiles")
    .insert({
      user_id: auth.user.id,
      nickname: parsed.data.nickname,
      grade: parsed.data.grade,
      reading_mode: parsed.data.readingMode,
    })
    .select(profileColumns)
    .single();
  if (error || !data) return internalError();

  const { error: settingsError } = await auth.supabase.from("app_settings").insert({
    child_id: data.id,
  });
  if (settingsError) {
    await auth.supabase.from("child_profiles").delete().eq("id", data.id);
    return internalError();
  }

  return apiSuccess(data, 201);
}

