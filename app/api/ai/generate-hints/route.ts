import { z } from "zod";
import { getAiProvider } from "@/lib/ai";
import { costLimitsFromEnv } from "@/lib/ai/costGuard";
import { scrubPiiFromHints } from "@/lib/ai/pii";
import { buildHintsPrompt } from "@/lib/ai/prompts";
import { hintsSchema, type Hints } from "@/lib/ai/schemas";
import { reserveAiUsage } from "@/lib/ai/usage";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { checkRateLimit } from "@/lib/utils/rateLimit";
import {
  HINT_LEVELS,
  hintMaxLevel,
  ownedProblem,
  ownedSession,
} from "@/lib/utils/resources";
import { explanationLevel, uuid } from "@/lib/utils/schemas";

const schema = z.object({ childId: uuid, problemId: uuid, sessionId: uuid, explanationLevel });

const KEY_BY_LEVEL = { 1: "hint1", 2: "hint2", 3: "solution", 4: "answer" } as const;

const HINTS_COST_USD = Number(process.env.AI_HINTS_COST_USD ?? 0.002);

type Auth = Awaited<ReturnType<typeof requireOwnedChild>>;

/**
 * 「もっとかんたんに」(doc.md §6.1)。explanationLevel でヒントを再生成する(W4)。
 * 返すのは、そのセッションで子どもが既に開いた段階(problem_hint_views.max_level)までに限る。
 * 未開示のヒント・答えは含めない(A2)。再生成結果は保存しない。
 */
export async function POST(request: Request) {
  const parsed = await parseJson(request, schema);
  if (!parsed.success) return apiError("Invalid hint request");
  const { childId, problemId, sessionId } = parsed.data;
  const auth = await requireOwnedChild(childId);
  if (auth.response) return auth.response;
  if (!checkRateLimit(`hints:${auth.user!.id}`)) return apiError("Too many requests", 429);

  const [problem, sessionOk] = await Promise.all([
    ownedProblem(auth.supabase, childId, problemId),
    ownedSession(auth.supabase, childId, sessionId),
  ]);
  if (!problem || !sessionOk) return apiError("Learning resource not found", 404);
  const maxLevel = await hintMaxLevel(auth.supabase, childId, problemId, sessionId);
  if (maxLevel === null) return internalError();

  const regenerated = await regenerateHints(auth, problem.problem_text, parsed.data.explanationLevel);
  if ("response" in regenerated) return regenerated.response;

  const revealed = Object.fromEntries(
    HINT_LEVELS.filter((level) => level <= maxLevel)
      .map((level) => [KEY_BY_LEVEL[level], regenerated.hints[KEY_BY_LEVEL[level]]]),
  );
  return apiSuccess({
    ...revealed,
    praise: regenerated.hints.praise,
    explanationLevel: parsed.data.explanationLevel,
    maxLevel,
  });
}

/** コストガードを通してから再生成する。結果は Zod 検証 + PII除去し、保存はしない。 */
async function regenerateHints(
  auth: Auth,
  problemText: string,
  level: "very_easy" | "easy" | "standard",
): Promise<{ hints: Hints } | { response: Response }> {
  const provider = getAiProvider();
  if (provider.name !== "mock") {
    const reservation = await reserveAiUsage(auth.supabase, auth.user!.id, HINTS_COST_USD, costLimitsFromEnv());
    if (reservation.outcome === "unavailable") {
      return { response: apiError("AIをいまは利用できません。しばらくしてからお試しください。", 503) };
    }
    if (reservation.outcome === "denied") {
      return { response: apiError("AIの利用上限に達しました。しばらくしてからお試しください。", 429) };
    }
  }
  try {
    const raw = await provider.generateHints(buildHintsPrompt(problemText, level));
    const validated = hintsSchema.safeParse(raw);
    if (!validated.success) {
      return { response: apiError("ヒントを かんたんに できなかったよ。もういちど ためしてね。", 502) };
    }
    return { hints: scrubPiiFromHints(validated.data) };
  } catch {
    return { response: apiError("ヒントを かんたんに できなかったよ。もういちど ためしてね。", 502) };
  }
}
