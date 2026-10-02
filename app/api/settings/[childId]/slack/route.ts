import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { slackWebhookInput } from "@/lib/slack/schemas";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { uuid } from "@/lib/utils/schemas";
import { checkRateLimitDb } from "@/lib/utils/rateLimit";
import { nowJstIso } from "@/lib/utils/date";

type RouteContext = { params: Promise<{ childId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { childId } = await context.params;
  if (!uuid.safeParse(childId).success) return apiError("Invalid child profile");
  const parsed = await parseJson(request, slackWebhookInput);
  if (!parsed.success) return apiError("Invalid Slack webhook");
  const auth = await requireOwnedChild(childId);
  if (auth.response) return auth.response;
  if (!(await checkRateLimitDb(auth.user!.id, "settings", 20))) {
    return apiError("Too many requests", 429);
  }

  const now = nowJstIso();
  try {
    await auth.db
      .insert(schema.appSettings)
      .values({
        id: crypto.randomUUID(),
        childId,
        enableSlack: 1,
        slackWebhookUrl: parsed.data.webhookUrl,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [schema.appSettings.childId],
        set: {
          enableSlack: 1,
          slackWebhookUrl: parsed.data.webhookUrl,
          updatedAt: now,
        },
      })
      .run();

    return apiSuccess({ configured: true, enabled: true });
  } catch {
    return internalError();
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { childId } = await context.params;
  if (!uuid.safeParse(childId).success) return apiError("Invalid child profile");
  const auth = await requireOwnedChild(childId);
  if (auth.response) return auth.response;
  if (!(await checkRateLimitDb(auth.user!.id, "settings", 20))) {
    return apiError("Too many requests", 429);
  }

  const now = nowJstIso();
  try {
    await auth.db
      .update(schema.appSettings)
      .set({
        enableSlack: 0,
        slackWebhookUrl: null,
        updatedAt: now,
      })
      .where(eq(schema.appSettings.childId, childId))
      .run();

    return apiSuccess({ configured: false, enabled: false });
  } catch {
    return internalError();
  }
}
