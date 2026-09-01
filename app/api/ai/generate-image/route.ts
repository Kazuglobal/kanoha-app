import { z } from "zod";
import { costLimitsFromEnv } from "@/lib/ai/costGuard";
import { generateVisualImage, ImageGenerationUnavailableError } from "@/lib/ai/image";
import { buildVisualImagePrompt } from "@/lib/ai/prompts";
import { reserveAiUsage } from "@/lib/ai/usage";
import { getGrade2MathUnit, isGrade2MathUnit } from "@/lib/curriculum/grade2Math";
import { apiError, apiSuccess, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { checkRateLimit } from "@/lib/utils/rateLimit";
import { ownedProblem } from "@/lib/utils/resources";
import { uuid } from "@/lib/utils/schemas";

const schema = z.object({
  childId: uuid,
  problemId: uuid,
  requestedByChild: z.literal(true),
});

const IMAGE_COST_USD = Number(process.env.AI_IMAGE_COST_USD ?? 0.04);

type Auth = Awaited<ReturnType<typeof requireOwnedChild>>;
type Problem = NonNullable<Awaited<ReturnType<typeof ownedProblem>>>;

/**
 * 図解(doc.md §19)。テンプレ優先: 単元マスタの visualTemplate → public/visuals/<t>.svg。
 * テンプレが無い場合のみ、子どもの要求(requestedByChild)+ 親の許可
 * (app_settings.enable_image_generation)+ コスト予約(increment_ai_usage)がそろえば
 * GPT Image で生成し、データURLで返す。生成画像は保存しない。
 */
export async function POST(request: Request) {
  const parsed = await parseJson(request, schema);
  if (!parsed.success) return apiError("Invalid image request");
  const auth = await requireOwnedChild(parsed.data.childId);
  if (auth.response) return auth.response;
  if (!checkRateLimit(`image:${auth.user!.id}`, 5)) return apiError("Too many requests", 429);
  const problem = await ownedProblem(auth.supabase, parsed.data.childId, parsed.data.problemId);
  if (!problem) return apiError("Problem not found", 404);

  const template = isGrade2MathUnit(problem.unit)
    ? getGrade2MathUnit(problem.unit)?.visualTemplate
    : undefined;
  if (template) return apiSuccess({ kind: "template", url: `/visuals/${template}.svg` });
  return generateWithAi(auth, problem);
}

async function generateWithAi(auth: Auth, problem: Problem) {
  const { data: settings } = await auth.supabase
    .from("app_settings")
    .select("enable_image_generation")
    .eq("child_id", problem.child_id)
    .maybeSingle();
  if (!settings?.enable_image_generation) {
    return apiError("えの せいせいは いま つかえないよ。おうちの ひとに そうだんしてね。", 403);
  }

  const reservation = await reserveAiUsage(auth.supabase, auth.user!.id, IMAGE_COST_USD, costLimitsFromEnv());
  if (reservation.outcome === "unavailable") {
    return apiError("えを いま じゅんびできないよ。あとで ためしてね。", 503);
  }
  if (reservation.outcome === "denied") {
    return apiError("きょうの えの じゅんびは おわったよ。また あした ためしてね。", 429);
  }

  try {
    const url = await generateVisualImage(buildVisualImagePrompt(problem.problem_text, problem.unit));
    return apiSuccess({ kind: "generated", url });
  } catch (error) {
    if (error instanceof ImageGenerationUnavailableError) {
      return apiError("えの きのうは いま じゅんびちゅうだよ。", 503);
    }
    return apiError("えを つくれなかったよ。もういちど ためしてね。", 502);
  }
}
