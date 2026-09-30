import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";
import * as schema from "@/lib/db/schema";
import { buildParentReport, formatReportMessage, type ParentReportContent } from "@/lib/reports/build";
import { buildDashboard, loadDashboardInput } from "@/lib/reports/dashboard";
import { sendSlackReport } from "@/lib/slack/sendReport";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { nowJstIso, todayKeyJst } from "@/lib/utils/date";
import { checkRateLimitDb } from "@/lib/utils/rateLimit";
import { uuid } from "@/lib/utils/schemas";
import type { Database } from "@/lib/db";

const schemaValidation = z.object({ childId: uuid, reportDate: z.string().date().optional() });

export async function POST(request: Request) {
  const parsed = await parseJson(request, schemaValidation);
  if (!parsed.success) return apiError("Invalid report request");
  const auth = await requireOwnedChild(parsed.data.childId);
  if (auth.response) return auth.response;
  if (!(await checkRateLimitDb(auth.user!.id, "slack-report", 5))) {
    return apiError("Too many requests", 429);
  }
  const childId = parsed.data.childId;
  const reportDate = parsed.data.reportDate ?? todayKeyJst();

  try {
    const existing = await auth.db
      .select({
        id: schema.parentReports.id,
        slack_sent_at: schema.parentReports.slackSentAt,
      })
      .from(schema.parentReports)
      .where(
        and(eq(schema.parentReports.childId, childId), eq(schema.parentReports.reportDate, reportDate)),
      )
      .get();

    if (existing?.slack_sent_at) return apiSuccess({ sent: false, alreadySent: true });

    const input = await loadDashboardInput(childId, auth.db);
    if (!input) return internalError();
    const dashboard = buildDashboard(input);
    const report = buildParentReport(dashboard);
    const saved = await upsertReport(auth.db, childId, reportDate, report);
    if (!saved) return internalError();

    const delivery = await loadDelivery(auth.db, childId);
    if (!delivery) return apiError("Slack delivery is not configured", 422);

    return deliverOnce(auth.db, saved.id, delivery.webhook_url, formatReportMessage(dashboard, report));
  } catch {
    return internalError();
  }
}

async function upsertReport(
  db: Database,
  childId: string,
  reportDate: string,
  report: ParentReportContent,
) {
  const now = nowJstIso();
  try {
    const row = await db
      .insert(schema.parentReports)
      .values({
        id: crypto.randomUUID(),
        childId,
        reportDate,
        summary: report.summary,
        accuracyRate: report.accuracy_rate,
        weakUnits: JSON.stringify(report.weak_units),
        growthPoints: JSON.stringify(report.growth_points),
        nextRecommendations: JSON.stringify(report.next_recommendations),
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [schema.parentReports.childId, schema.parentReports.reportDate],
        set: {
          summary: report.summary,
          accuracyRate: report.accuracy_rate,
          weakUnits: JSON.stringify(report.weak_units),
          growthPoints: JSON.stringify(report.growth_points),
          nextRecommendations: JSON.stringify(report.next_recommendations),
          updatedAt: now,
        },
      })
      .returning({
        id: schema.parentReports.id,
        slack_sent_at: schema.parentReports.slackSentAt,
      })
      .get();

    return row ?? null;
  } catch {
    return null;
  }
}

async function loadDelivery(db: Database, childId: string) {
  try {
    const row = await db
      .select({
        enableSlack: schema.appSettings.enableSlack,
        slackWebhookUrl: schema.appSettings.slackWebhookUrl,
      })
      .from(schema.appSettings)
      .where(eq(schema.appSettings.childId, childId))
      .get();

    if (!row?.enableSlack || !row?.slackWebhookUrl) return null;
    return { enable_slack: Boolean(row.enableSlack), webhook_url: row.slackWebhookUrl };
  } catch {
    return null;
  }
}

async function deliverOnce(db: Database, reportId: string, webhookUrl: string, message: string) {
  const claimedAt = nowJstIso();
  try {
    const claimed = await db
      .update(schema.parentReports)
      .set({ slackSentAt: claimedAt, updatedAt: claimedAt })
      .where(and(eq(schema.parentReports.id, reportId), isNull(schema.parentReports.slackSentAt)))
      .returning({ id: schema.parentReports.id })
      .get();

    if (!claimed) return apiSuccess({ sent: false, alreadySent: true });

    try {
      await sendSlackReport(webhookUrl, message);
    } catch {
      await db
        .update(schema.parentReports)
        .set({ slackSentAt: null, updatedAt: nowJstIso() })
        .where(
          and(eq(schema.parentReports.id, reportId), eq(schema.parentReports.slackSentAt, claimedAt)),
        )
        .run();
      return apiError("Slack delivery failed", 502);
    }
    return apiSuccess({ sent: true, alreadySent: false });
  } catch {
    return internalError();
  }
}
