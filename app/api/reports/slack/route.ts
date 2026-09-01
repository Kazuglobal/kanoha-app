import { z } from "zod";
import { buildParentReport, formatReportMessage, type ParentReportContent } from "@/lib/reports/build";
import { buildDashboard, loadDashboardInput } from "@/lib/reports/dashboard";
import { sendSlackReport } from "@/lib/slack/sendReport";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { todayKeyJst } from "@/lib/utils/date";
import { checkRateLimitDb } from "@/lib/utils/rateLimit";
import { uuid } from "@/lib/utils/schemas";

const schema = z.object({ childId: uuid, reportDate: z.string().date().optional() });

type Supabase = Awaited<ReturnType<typeof requireOwnedChild>>["supabase"];

export async function POST(request: Request) {
  const parsed = await parseJson(request, schema);
  if (!parsed.success) return apiError("Invalid report request");
  const auth = await requireOwnedChild(parsed.data.childId);
  if (auth.response) return auth.response;
  if (!(await checkRateLimitDb(auth.supabase, auth.user!.id, "slack-report", 5))) {
    return apiError("Too many requests", 429);
  }
  const childId = parsed.data.childId;
  const reportDate = parsed.data.reportDate ?? todayKeyJst();

  const existing = await auth.supabase.from("parent_reports")
    .select("id, slack_sent_at")
    .eq("child_id", childId)
    .eq("report_date", reportDate)
    .maybeSingle();
  if (existing.error) return internalError();
  if (existing.data?.slack_sent_at) return apiSuccess({ sent: false, alreadySent: true });

  const input = await loadDashboardInput(auth.supabase, childId);
  if (!input) return internalError();
  const dashboard = buildDashboard(input);
  const report = buildParentReport(dashboard);
  const saved = await upsertReport(auth.supabase, childId, reportDate, report);
  if (!saved) return internalError();

  const delivery = await loadDelivery(childId);
  if (!delivery) return apiError("Slack delivery is not configured", 422);

  return deliverOnce(auth.supabase, saved.id, delivery.webhook_url, formatReportMessage(dashboard, report));
}

/** (child_id, report_date) で冪等に upsert。slack_sent_at はここでは触らない。 */
async function upsertReport(
  supabase: Supabase,
  childId: string,
  reportDate: string,
  report: ParentReportContent,
) {
  const { data, error } = await supabase.from("parent_reports").upsert({
    child_id: childId,
    report_date: reportDate,
    summary: report.summary,
    accuracy_rate: report.accuracy_rate,
    weak_units: report.weak_units,
    growth_points: report.growth_points,
    next_recommendations: report.next_recommendations,
  }, { onConflict: "child_id,report_date" }).select("id, slack_sent_at").single();
  return error || !data ? null : (data as { id: string; slack_sent_at: string | null });
}

/** Webhook は Vault RPC 経由(service_role のみ)。クライアントへは返さない。 */
async function loadDelivery(childId: string) {
  const { data, error } = await createAdminClient().rpc("get_slack_delivery_settings", {
    target_child_id: childId,
  });
  const delivery = Array.isArray(data) ? data[0] : data;
  if (error || !delivery?.enable_slack || !delivery?.webhook_url) return null;
  return delivery as { enable_slack: boolean; webhook_url: string };
}

/** slack_sent_at を先にクレームして二重送信を防ぐ。送信失敗(内部で1回リトライ)なら解放して 502。 */
async function deliverOnce(supabase: Supabase, reportId: string, webhookUrl: string, message: string) {
  const claimedAt = new Date().toISOString();
  const claimed = await supabase.from("parent_reports")
    .update({ slack_sent_at: claimedAt })
    .eq("id", reportId)
    .is("slack_sent_at", null)
    .select("id")
    .maybeSingle();
  if (claimed.error) return internalError();
  if (!claimed.data) return apiSuccess({ sent: false, alreadySent: true });

  try {
    await sendSlackReport(webhookUrl, message);
  } catch {
    await supabase.from("parent_reports").update({ slack_sent_at: null })
      .eq("id", reportId)
      .eq("slack_sent_at", claimedAt);
    return apiError("Slack delivery failed", 502);
  }
  return apiSuccess({ sent: true, alreadySent: false });
}
