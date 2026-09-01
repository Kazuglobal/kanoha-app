import { z } from "zod";
import { getAiProvider } from "@/lib/ai";
import { checkAiCost, costLimitsFromEnv } from "@/lib/ai/costGuard";
import { getDailyAiUsage, recordAiUsage } from "@/lib/ai/usage";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { checkRateLimit } from "@/lib/utils/rateLimit";
import { ownedProblem } from "@/lib/utils/resources";
import { uuid } from "@/lib/utils/schemas";

const schema = z.object({
  childId: uuid,
  problemId: uuid,
  image: z.object({
    data: z.string().min(1),
    mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  }),
});

const RECOGNIZE_COST_USD = Number(process.env.AI_RECOGNIZE_COST_USD ?? 0.005);

export async function POST(request: Request) {
  const parsed = await parseJson(request, schema);
  if (!parsed.success) return apiError("Invalid handwriting request");
  const auth = await requireOwnedChild(parsed.data.childId);
  if (auth.response) return auth.response;
  if (!checkRateLimit(`handwriting:${auth.user!.id}`, 10)) return apiError("Too many requests", 429);

  const problem = await ownedProblem(auth.supabase, parsed.data.childId, parsed.data.problemId);
  if (!problem) return apiError("Problem not found", 404);

  const provider = getAiProvider();
  if (provider.name === "mock") {
    const result = await provider.recognizeHandwriting([], problem.problem_text);
    return apiSuccess(result);
  }

  const admin = createAdminClient();
  const usage = await getDailyAiUsage(admin, auth.user!.id);
  const decision = checkAiCost(usage, { estimatedCostUsd: RECOGNIZE_COST_USD }, costLimitsFromEnv());
  if (!decision.allowed) {
    return apiError("AIの利用上限に達しました。すうじで にゅうりょくしてね。", 429);
  }

  try {
    const result = await provider.recognizeHandwriting(
      [{ data: parsed.data.image.data, mimeType: parsed.data.image.mimeType }],
      problem.problem_text,
    );
    await recordAiUsage(admin, auth.user!.id, RECOGNIZE_COST_USD);
    return apiSuccess(result);
  } catch {
    return apiError("てがきを よみとれなかったよ。すうじで にゅうりょくしてね。", 502);
  }
}
