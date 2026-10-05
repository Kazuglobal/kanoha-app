import { z } from "zod";
import { getAiProvider } from "@/lib/ai";
import { costLimitsFromEnv } from "@/lib/ai/costGuard";
import { scrubPiiFromSimilarProblem } from "@/lib/ai/pii";
import { similarProblemDraftsSchema, unitSchema } from "@/lib/ai/schemas";
import type { SimilarProblemDraft, SimilarProblemRequest } from "@/lib/ai/schemas";
import { reserveAiUsage } from "@/lib/ai/usage";
import { MISTAKE_TYPE_IDS } from "@/lib/curriculum/mistakeTypes";
import * as schema from "@/lib/db/schema";
import { recentUnitAttempts } from "@/lib/review/loop";
import { buildChoices } from "@/lib/review/choices";
import { difficultyForNextSimilarSet } from "@/lib/review/recommend";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { checkRateLimit } from "@/lib/utils/rateLimit";
import { ownedProblem } from "@/lib/utils/resources";
import { difficulty, uuid } from "@/lib/utils/schemas";
import { nowJstIso } from "@/lib/utils/date";

const schemaValidation = z.object({
  childId: uuid,
  problemId: uuid,
  difficulty: difficulty.optional(),
  mistakeType: z.enum(MISTAKE_TYPE_IDS).optional(),
});

const SIMILAR_COST_USD = Number(process.env.AI_SIMILAR_COST_USD ?? 0.005);
const MISTAKE_HISTORY_SIZE = 5;

type Auth = Awaited<ReturnType<typeof requireOwnedChild>>;
type Problem = NonNullable<Awaited<ReturnType<typeof ownedProblem>>>;

export async function POST(request: Request) {
  const parsed = await parseJson(request, schemaValidation);
  if (!parsed.success) return apiError("Invalid similar problem request");
  const auth = await requireOwnedChild(parsed.data.childId);
  if (auth.response) return auth.response;
  if (!checkRateLimit(`similar:${auth.user!.id}`, 10)) return apiError("Too many requests", 429);
  const problem = await ownedProblem(parsed.data.childId, parsed.data.problemId, auth.db);
  if (!problem) return apiError("Problem not found", 404);

  const unit = unitSchema.safeParse(problem.unit);
  if (!unit.success) return internalError();
  const history = await recentUnitAttempts(parsed.data.childId, unit.data, MISTAKE_HISTORY_SIZE, auth.db);
  const { difficulty: adjusted, streak } = difficultyForNextSimilarSet(
    parsed.data.difficulty ?? difficulty.safeParse(problem.difficulty).data ?? "standard",
    history,
  );
  const input: SimilarProblemRequest = {
    difficulty: adjusted,
    mistakeType: parsed.data.mistakeType ?? streak.mistakeType ?? undefined,
    problemText: problem.problemText,
    subUnit: problem.subUnit,
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
  const reservation = await reserveAiUsage(
    auth.user!.id,
    SIMILAR_COST_USD,
    costLimitsFromEnv(),
    auth.db,
  );
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

async function persistDrafts(auth: Auth, problem: Problem, drafts: readonly SimilarProblemDraft[]) {
  const validated = similarProblemDraftsSchema.safeParse(drafts);
  if (!validated.success) return internalError();

  const now = nowJstIso();
  const rows = validated.data.map(scrubPiiFromSimilarProblem).map((item, index) => ({
    id: crypto.randomUUID(),
    sourceProblemId: problem.id,
    childId: problem.childId,
    problemText: item.problemText,
    answer: item.answer,
    explanation: item.explanation,
    unit: item.unit,
    subUnit: item.subUnit,
    difficulty: item.difficulty,
    choices: JSON.stringify(buildChoices(item.answer, `${problem.id}:${index}`)),
    createdAt: now,
  }));

  try {
    const inserted = [];
    for (const r of rows) {
      const res = await auth.db
        .insert(schema.generatedSimilarProblems)
        .values(r)
        .returning({
          id: schema.generatedSimilarProblems.id,
          problem_text: schema.generatedSimilarProblems.problemText,
          unit: schema.generatedSimilarProblems.unit,
          sub_unit: schema.generatedSimilarProblems.subUnit,
          difficulty: schema.generatedSimilarProblems.difficulty,
          choices: schema.generatedSimilarProblems.choices,
        })
        .get();
      inserted.push({
        ...res,
        choices: res.choices ? JSON.parse(res.choices) : null,
      });
    }

    return apiSuccess(inserted, 201);
  } catch {
    return internalError();
  }
}
