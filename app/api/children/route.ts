import { childProfileInput } from "@/lib/children/schemas";
import { apiError, apiSuccess, internalError, parseJson, requireUser } from "@/lib/utils/api";
import { checkRateLimitDb } from "@/lib/utils/rateLimit";

const profileColumns = "id, nickname, grade, reading_mode, created_at, updated_at";
/** doc.md §14.2: 1ユーザーあたりの子どもプロフィール上限。 */
const MAX_CHILD_PROFILES = 8;

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
  if (!(await checkRateLimitDb(auth.supabase, auth.user.id, "children", 10))) return apiError("Too many requests", 429);

  const existing = await auth.supabase
    .from("child_profiles")
    .select("id")
    .eq("user_id", auth.user.id);
  if (existing.error) return internalError();
  if ((existing.data ?? []).length >= MAX_CHILD_PROFILES) {
    return apiError("Child profile limit reached", 400);
  }

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

