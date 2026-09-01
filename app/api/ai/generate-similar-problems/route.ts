import { z } from "zod";
import { getAiProvider } from "@/lib/ai";
import { checkAiCost, costLimitsFromEnv } from "@/lib/ai/costGuard";
import { similarProblemDraftsSchema, unitSchema } from "@/lib/ai/schemas";
import type { SimilarProblemDraft, SimilarProblemRequest } from "@/lib/ai/schemas";
import { getDailyAiUsage, recordAiUsage } from "@/lib/ai/usage";
import { MISTAKE_TYPE_IDS } from "@/lib/curriculum/mistakeTypes";
import { recentUnitAttempts } from "@/lib/review/loop";
import { difficultyForNextSimilarSet } from "@/lib/review/recommend";
import { createAdminClient } from "@/lib/supabase/admin";
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
    return (await persistDrafts(auth, problem, drafts)).response;
  }
  return generateWithGemini(auth, problem, provider, input);
}

async function generateWithGemini(
  auth: Auth,
  problem: Problem,
  provider: ReturnType<typeof getAiProvider>,
  input: SimilarProblemRequest,
) {
  const admin = createAdminClient();
  const usage = await getDailyAiUsage(admin, auth.user!.id);
  const decision = checkAiCost(usage, { estimatedCostUsd: SIMILAR_COST_USD }, costLimitsFromEnv());
  if (!decision.allowed) {
    return apiError("AIの利用上限に達しました。しばらくしてからお試しください。", 429);
  }

  let drafts: readonly SimilarProblemDraft[];
  try {
    drafts = await provider.generateSimilarProblems(input);
  } catch {
    return apiError("れんしゅう問題の生成に失敗しました。もう一度お試しください。", 502);
  }

  const result = await persistDrafts(auth, problem, drafts);
  if (result.ok) await recordAiUsage(admin, auth.user!.id, SIMILAR_COST_USD);
  return result.response;
}

async function persistDrafts(auth: Auth, problem: Problem, drafts: readonly SimilarProblemDraft[]) {
  const validated = similarProblemDraftsSchema.safeParse(drafts);
  if (!validated.success) return withOk(internalError());

  const rows = validated.data.map((item) => ({
    source_problem_id: problem.id,
    child_id: problem.child_id,
    problem_text: item.problemText,
    answer: item.answer,
    explanation: item.explanation,
    unit: item.unit,
    sub_unit: item.subUnit,
    difficulty: item.difficulty,
  }));
  const { data, error } = await auth.supabase
    .from("generated_similar_problems")
    .insert(rows)
    .select("id, problem_text, answer, explanation, unit, sub_unit, difficulty");
  if (error) return withOk(internalError());
  return withOk(apiSuccess(data, 201));
}

const withOk = (response: Response) => ({ ok: response.status < 400, response });
