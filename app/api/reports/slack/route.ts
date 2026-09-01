import { z } from "zod";
import { sendSlackReport } from "@/lib/slack/sendReport";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { todayKeyJst } from "@/lib/utils/date";
import { checkRateLimit } from "@/lib/utils/rateLimit";
import { uuid } from "@/lib/utils/schemas";

const schema = z.object({ childId: uuid, reportDate: z.string().date().optional() });

function formatReport(report: Record<string, unknown>) {
  const accuracy = Number(report.accuracy_rate ?? 0);
  return [
    "【今日の学習レポート】",
    "",
    `正答率: ${Math.round(accuracy * 100)}%`,
    `まとめ: ${String(report.summary ?? "今日も学習に取り組みました。")}`,
    "次の学習も、無理のないペースで進めましょう。",
  ].join("\n");
}

export async function POST(request: Request) {
  const parsed = await parseJson(request, schema);
  if (!parsed.success) return apiError("Invalid report request");
  const auth = await requireOwnedChild(parsed.data.childId);
  if (auth.response) return auth.response;
  if (!checkRateLimit(`slack:${auth.user!.id}`, 5)) return apiError("Too many requests", 429);

  const reportDate = parsed.data.reportDate ?? todayKeyJst();
  const { data: existing, error: reportError } = await auth.supabase
    .from("parent_reports")
    .select("id, summary, accuracy_rate, slack_sent_at")
    .eq("child_id", parsed.data.childId)
    .eq("report_date", reportDate)
    .maybeSingle();
  if (reportError) return internalError();
  if (existing?.slack_sent_at) return apiSuccess({ sent: false, alreadySent: true });

  const newReport = {
    child_id: parsed.data.childId,
    report_date: reportDate,
    summary: "今日も学習に取り組みました。",
    accuracy_rate: 0,
    weak_units: [],
    growth_points: [],
    next_recommendations: [],
  };
  const { data: saved, error: saveError } = existing
    ? { data: existing, error: null }
    : await auth.supabase.from("parent_reports").upsert(newReport, {
      onConflict: "child_id,report_date",
    }).select("id, summary, accuracy_rate, slack_sent_at").single();
  if (saveError || !saved) return internalError();

  const { data: settings, error: settingsError } = await createAdminClient().rpc(
    "get_slack_delivery_settings",
    { target_child_id: parsed.data.childId },
  );
  const delivery = Array.isArray(settings) ? settings[0] : settings;
  if (settingsError || !delivery?.enable_slack || !delivery?.webhook_url) {
    return apiError("Slack delivery is not configured", 422);
  }

  const claimedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await auth.supabase.from("parent_reports")
    .update({ slack_sent_at: claimedAt })
    .eq("id", saved.id)
    .is("slack_sent_at", null)
    .select("id")
    .maybeSingle();
  if (claimError) return internalError();
  if (!claimed) return apiSuccess({ sent: false, alreadySent: true });

  try {
    await sendSlackReport(delivery.webhook_url, formatReport(saved));
  } catch {
    await auth.supabase.from("parent_reports").update({ slack_sent_at: null })
      .eq("id", saved.id)
      .eq("slack_sent_at", claimedAt);
    return apiError("Slack delivery failed", 502);
  }
  return apiSuccess({ sent: true, alreadySent: false });
}
