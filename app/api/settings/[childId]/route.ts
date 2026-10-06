import { eq } from "drizzle-orm";
import { z } from "zod";
import * as schema from "@/lib/db/schema";
import { appSettingsInput } from "@/lib/settings/schemas";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { uuid } from "@/lib/utils/schemas";
import { checkRateLimitDb } from "@/lib/utils/rateLimit";
import { nowJstIso } from "@/lib/utils/date";

const defaultSettings = {
  explanation_level: "easy",
  daily_limit_minutes: 60,
  enable_audio: true,
  enable_voice_answer: true,
  enable_image_generation: false,
};
const patchInput = appSettingsInput.extend({ enableImageGeneration: z.boolean() });
type RouteContext = { params: Promise<{ childId: string }> };

interface SettingsRow {
  child_id: string;
  explanation_level: string;
  daily_limit_minutes: number;
  enable_audio: boolean;
  enable_voice_answer: boolean;
  enable_image_generation: boolean;
  enable_slack: boolean;
  slack_webhook_url: string | null;
}

const maskedSettings = (settings: SettingsRow) => ({
  child_id: settings.child_id,
  explanation_level: settings.explanation_level,
  daily_limit_minutes: settings.daily_limit_minutes,
  enable_audio: settings.enable_audio,
  enable_voice_answer: settings.enable_voice_answer,
  enable_image_generation: settings.enable_image_generation,
  enable_slack: settings.enable_slack,
  slack_configured: Boolean(settings.slack_webhook_url),
});

export async function GET(_request: Request, context: RouteContext) {
  const { childId } = await context.params;
  if (!uuid.safeParse(childId).success) return apiError("Invalid child profile");
  const auth = await requireOwnedChild(childId);
  if (auth.response) return auth.response;

  try {
    const data = await auth.db
      .select({
        child_id: schema.appSettings.childId,
        explanation_level: schema.appSettings.explanationLevel,
        daily_limit_minutes: schema.appSettings.dailyLimitMinutes,
        enable_audio: schema.appSettings.enableAudio,
        enable_voice_answer: schema.appSettings.enableVoiceAnswer,
        enable_image_generation: schema.appSettings.enableImageGeneration,
        enable_slack: schema.appSettings.enableSlack,
        slack_webhook_url: schema.appSettings.slackWebhookUrl,
      })
      .from(schema.appSettings)
      .where(eq(schema.appSettings.childId, childId))
      .get();

    const settings: SettingsRow = data
      ? {
          child_id: data.child_id,
          explanation_level: data.explanation_level,
          daily_limit_minutes: data.daily_limit_minutes,
          enable_audio: Boolean(data.enable_audio),
          enable_voice_answer: Boolean(data.enable_voice_answer),
          enable_image_generation: Boolean(data.enable_image_generation),
          enable_slack: Boolean(data.enable_slack),
          slack_webhook_url: data.slack_webhook_url,
        }
      : {
          child_id: childId,
          ...defaultSettings,
          enable_slack: false,
          slack_webhook_url: null,
        };

    return apiSuccess(maskedSettings(settings));
  } catch {
    return internalError();
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { childId } = await context.params;
  if (!uuid.safeParse(childId).success) return apiError("Invalid child profile");
  const parsed = await parseJson(request, patchInput);
  if (!parsed.success) return apiError("Invalid settings");

  const auth = await requireOwnedChild(childId);
  if (auth.response) return auth.response;
  if (!(await checkRateLimitDb(auth.user!.id, "settings", 30))) {
    return apiError("Too many requests", 429);
  }

  const now = nowJstIso();

  try {
    const updated = await auth.db
      .insert(schema.appSettings)
      .values({
        id: crypto.randomUUID(),
        childId,
        explanationLevel: parsed.data.explanationLevel,
        dailyLimitMinutes: parsed.data.dailyLimitMinutes,
        enableAudio: parsed.data.enableAudio ? 1 : 0,
        enableVoiceAnswer: parsed.data.enableVoiceAnswer ? 1 : 0,
        enableImageGeneration: parsed.data.enableImageGeneration ? 1 : 0,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [schema.appSettings.childId],
        set: {
          explanationLevel: parsed.data.explanationLevel,
          dailyLimitMinutes: parsed.data.dailyLimitMinutes,
          enableAudio: parsed.data.enableAudio ? 1 : 0,
          enableVoiceAnswer: parsed.data.enableVoiceAnswer ? 1 : 0,
          enableImageGeneration: parsed.data.enableImageGeneration ? 1 : 0,
          updatedAt: now,
        },
      })
      .returning({
        child_id: schema.appSettings.childId,
        explanation_level: schema.appSettings.explanationLevel,
        daily_limit_minutes: schema.appSettings.dailyLimitMinutes,
        enable_audio: schema.appSettings.enableAudio,
        enable_voice_answer: schema.appSettings.enableVoiceAnswer,
        enable_image_generation: schema.appSettings.enableImageGeneration,
        enable_slack: schema.appSettings.enableSlack,
        slack_webhook_url: schema.appSettings.slackWebhookUrl,
      })
      .get();

    if (!updated) return internalError();

    const row: SettingsRow = {
      child_id: updated.child_id,
      explanation_level: updated.explanation_level,
      daily_limit_minutes: updated.daily_limit_minutes,
      enable_audio: Boolean(updated.enable_audio),
      enable_voice_answer: Boolean(updated.enable_voice_answer),
      enable_image_generation: Boolean(updated.enable_image_generation),
      enable_slack: Boolean(updated.enable_slack),
      slack_webhook_url: updated.slack_webhook_url,
    };

    return apiSuccess(maskedSettings(row));
  } catch {
    return internalError();
  }
}
