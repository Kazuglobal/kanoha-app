import { z } from "zod";
import { getAiProvider } from "@/lib/ai";
import { costLimitsFromEnv } from "@/lib/ai/costGuard";
import { scrubPiiFromSimilarProblem } from "@/lib/ai/pii";
import { similarProblemDraftsSchema, unitSchema } from "@/lib/ai/schemas";
import type { SimilarProblemDraft, SimilarProblemRequest } from "@/lib/ai/schemas";
import { reserveAiUsage } from "@/lib/ai/usage";
import { MISTAKE_TYPE_IDS } from "@/lib/curriculum/mistakeTypes";
import { recentUnitAttempts } from "@/lib/review/loop";
import { buildChoices } from "@/lib/review/choices";
import { difficultyForNextSimilarSet } from "@/lib/review/recommend";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { checkRateLimit } from "@/lib/utils/rateLimit";
import { ownedProblem } from "@/lib/utils/resources";
import { difficulty, uuid } from "@/lib/utils/schemas";

const schema = z.object({
  childId: uuid,
  problemId: uuid,
  difficulty: difficulty.optional(),
  mistakeType: z.enum(MISTAKE_TYPE_IDS).optional(),
});

const SIMILAR_COST_USD = Number(process.env.AI_SIMILAR_COST_USD ?? 0.005);
/** 「同じ間違いが連続」を判定する直近 attempts の数(doc.md §12.2)。 */
const MISTAKE_HISTORY_SIZE = 5;

type Auth = Awaited<ReturnType<typeof requireOwnedChild>>;
type Problem = NonNullable<Awaited<ReturnType<typeof ownedProblem>>>;

export async function POST(request: Request) {
  const parsed = await parseJson(request, schema);
  if (!parsed.success) return apiError("Invalid similar problem request");
  const auth = await requireOwnedChild(parsed.data.childId);
  if (auth.response) return auth.response;
  if (!checkRateLimit(`similar:${auth.user!.id}`, 10)) return apiError("Too many requests", 429);
  const problem = await ownedProblem(auth.supabase, parsed.data.childId, parsed.data.problemId);
  if (!problem) return apiError("Problem not found", 404);

  const unit = unitSchema.safeParse(problem.unit);
  if (!unit.success) return internalError();
  const history = await recentUnitAttempts(auth.supabase, parsed.data.childId, unit.data, MISTAKE_HISTORY_SIZE);
  const { difficulty: adjusted, streak } = difficultyForNextSimilarSet(
    parsed.data.difficulty ?? problem.difficulty,
    history,
  );
  const input: SimilarProblemRequest = {
    difficulty: adjusted,
    mistakeType: parsed.data.mistakeType ?? streak.mistakeType ?? undefined,
    problemText: problem.problem_text,
    subUnit: problem.sub_unit,
    unit: unit.data,
  };

  const provider = getAiProvider();
  if (provider.name === "mock") {
    const drafts = await provider.generateSimilarProblems(input);
    return persistDrafts(auth, problem, drafts);
  }
  return generateWithGemini(auth, problem, provider, input);
}

async function generateWithGemini(
  auth: Auth,
  problem: Problem,
  provider: ReturnType<typeof getAiProvider>,
  input: SimilarProblemRequest,
) {
  // 予約はプロバイダ呼び出しの「前」。失敗しても払い戻さない(B10)。
  const reservation = await reserveAiUsage(auth.supabase, auth.user!.id, SIMILAR_COST_USD, costLimitsFromEnv());
  if (reservation.outcome === "unavailable") {
    return apiError("AIをいまは利用できません。しばらくしてからお試しください。", 503);
  }
  if (reservation.outcome === "denied") {
    return apiError("AIの利用上限に達しました。しばらくしてからお試しください。", 429);
  }

  let drafts: readonly SimilarProblemDraft[];
  try {
    drafts = await provider.generateSimilarProblems(input);
  } catch {
    return apiError("れんしゅう問題の生成に失敗しました。もう一度お試しください。", 502);
  }

  return persistDrafts(auth, problem, drafts);
}

/**
 * 4 択は生成時にサーバーが作って保存する(A2 / B13)。レスポンスに answer / explanation は含めない:
 * 正誤判定と解説は /api/attempts が返す。PII除去は Zod 検証後・insert 前(B12)。
 */
async function persistDrafts(auth: Auth, problem: Problem, drafts: readonly SimilarProblemDraft[]) {
  const validated = similarProblemDraftsSchema.safeParse(drafts);
  if (!validated.success) return internalError();

  const rows = validated.data.map(scrubPiiFromSimilarProblem).map((item, index) => ({
    source_problem_id: problem.id,
    child_id: problem.child_id,
    problem_text: item.problemText,
    answer: item.answer,
    explanation: item.explanation,
    unit: item.unit,
    sub_unit: item.subUnit,
    difficulty: item.difficulty,
    choices: buildChoices(item.answer, `${problem.id}:${index}`),
  }));
  const { data, error } = await auth.supabase
    .from("generated_similar_problems")
    .insert(rows)
    .select("id, problem_text, unit, sub_unit, difficulty, choices");
  if (error) return internalError();
  return apiSuccess(data, 201);
}
