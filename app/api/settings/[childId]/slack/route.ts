import { slackWebhookInput } from "@/lib/slack/schemas";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { uuid } from "@/lib/utils/schemas";

type RouteContext = { params: Promise<{ childId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { childId } = await context.params;
  if (!uuid.safeParse(childId).success) return apiError("Invalid child profile");
  const parsed = await parseJson(request, slackWebhookInput);
  if (!parsed.success) return apiError("Invalid Slack webhook");
  const auth = await requireOwnedChild(childId);
  if (auth.response) return auth.response;

  const { error } = await auth.supabase.rpc("set_slack_webhook", {
    target_child_id: childId,
    webhook_url: parsed.data.webhookUrl,
  });
  return error ? internalError() : apiSuccess({ configured: true, enabled: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { childId } = await context.params;
  if (!uuid.safeParse(childId).success) return apiError("Invalid child profile");
  const auth = await requireOwnedChild(childId);
  if (auth.response) return auth.response;

  const { error } = await auth.supabase.rpc("remove_slack_webhook", {
    target_child_id: childId,
  });
  return error ? internalError() : apiSuccess({ configured: false, enabled: false });
}
