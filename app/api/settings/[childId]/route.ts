import { appSettingsInput } from "@/lib/settings/schemas";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { uuid } from "@/lib/utils/schemas";

const settingsColumns = "child_id, explanation_level, daily_limit_minutes, enable_audio, enable_voice_answer, enable_slack, slack_webhook_secret_id";
const defaultSettings = {
  explanation_level: "easy",
  daily_limit_minutes: 15,
  enable_audio: true,
  enable_voice_answer: true,
  enable_slack: false,
};
type RouteContext = { params: Promise<{ childId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { childId } = await context.params;
  if (!uuid.safeParse(childId).success) return apiError("Invalid child profile");
  const auth = await requireOwnedChild(childId);
  if (auth.response) return auth.response;

  const { data, error } = await auth.supabase
    .from("app_settings")
    .select(settingsColumns)
    .eq("child_id", childId)
    .maybeSingle();

  if (error) return internalError();
  const settings = data ?? { child_id: childId, ...defaultSettings, slack_webhook_secret_id: null };
  return apiSuccess({
    child_id: settings.child_id,
    explanation_level: settings.explanation_level,
    daily_limit_minutes: settings.daily_limit_minutes,
    enable_audio: settings.enable_audio,
    enable_voice_answer: settings.enable_voice_answer,
    enable_slack: settings.enable_slack,
    slack_configured: Boolean(settings.slack_webhook_secret_id),
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { childId } = await context.params;
  if (!uuid.safeParse(childId).success) return apiError("Invalid child profile");
  const parsed = await parseJson(request, appSettingsInput);
  if (!parsed.success) return apiError("Invalid app settings");
  const auth = await requireOwnedChild(childId);
  if (auth.response) return auth.response;

  const { data, error } = await auth.supabase
    .from("app_settings")
    .upsert({
      child_id: childId,
      explanation_level: parsed.data.explanationLevel,
      daily_limit_minutes: parsed.data.dailyLimitMinutes,
      enable_audio: parsed.data.enableAudio,
      enable_voice_answer: parsed.data.enableVoiceAnswer,
    }, { onConflict: "child_id" })
    .select(settingsColumns)
    .single();

  return error || !data ? internalError() : apiSuccess(data);
}
