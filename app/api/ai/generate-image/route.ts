import { eq } from "drizzle-orm";
import { z } from "zod";
import { costLimitsFromEnv } from "@/lib/ai/costGuard";
import { generateVisualImage, ImageGenerationUnavailableError } from "@/lib/ai/image";
import { buildVisualImagePrompt } from "@/lib/ai/prompts";
import { reserveAiUsage } from "@/lib/ai/usage";
import { resolveVisualTemplate } from "@/lib/curriculum/grade2Math";
import * as schema from "@/lib/db/schema";
import { apiError, apiSuccess, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { checkRateLimit } from "@/lib/utils/rateLimit";
import { ownedProblem } from "@/lib/utils/resources";
import { uuid } from "@/lib/utils/schemas";

const schemaValidation = z.object({
  childId: uuid,
  problemId: uuid,
  requestedByChild: z.literal(true),
});

const IMAGE_COST_USD = Number(process.env.AI_IMAGE_COST_USD ?? 0.04);

type Auth = Awaited<ReturnType<typeof requireOwnedChild>>;
type Problem = NonNullable<Awaited<ReturnType<typeof ownedProblem>>>;

export async function POST(request: Request) {
  const parsed = await parseJson(request, schemaValidation);
  if (!parsed.success) return apiError("Invalid image request");
  const auth = await requireOwnedChild(parsed.data.childId);
  if (auth.response) return auth.response;
  if (!checkRateLimit(`image:${auth.user!.id}`, 5)) return apiError("Too many requests", 429);
  const problem = await ownedProblem(parsed.data.childId, parsed.data.problemId, auth.db);
  if (!problem) return apiError("Problem not found", 404);

  const template = resolveVisualTemplate(problem.unit);
  if (template) return apiSuccess({ kind: "template", url: `/visuals/${template}.svg` });
  return generateWithAi(auth, problem);
}

async function generateWithAi(auth: Auth, problem: Problem) {
  const settings = await auth.db
    .select({ enableImageGeneration: schema.appSettings.enableImageGeneration })
    .from(schema.appSettings)
    .where(eq(schema.appSettings.childId, problem.childId))
    .get();

  if (!settings?.enableImageGeneration) {
    return apiError("えの せいせいは いま つかえないよ。おうちの ひとに そうだんしてね。", 403);
  }

  const reservation = await reserveAiUsage(
    auth.user!.id,
    IMAGE_COST_USD,
    costLimitsFromEnv(),
    auth.db,
  );
  if (reservation.outcome === "unavailable") {
    return apiError("えを いま じゅんびできないよ。あとで ためしてね。", 503);
  }
  if (reservation.outcome === "denied") {
    return apiError("きょうの えの じゅんびは おわったよ。また あした ためしてね。", 429);
  }

  try {
    const dataUrl = await generateVisualImage(buildVisualImagePrompt(problem.problemText, problem.unit));
    return apiSuccess({ kind: "generated", url: dataUrl, dataUrl });
  } catch (error) {
    if (error instanceof ImageGenerationUnavailableError) {
      return apiError("えを いま じゅんびできないよ。あとで ためしてね。", 503);
    }
    return apiError("えの じゅんびに しっぱいしたよ。もういちど ためしてね。", 502);
  }
}

