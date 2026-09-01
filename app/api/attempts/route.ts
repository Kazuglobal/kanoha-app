import { z } from "zod";
import { MISTAKE_TYPE_IDS } from "@/lib/curriculum/mistakeTypes";
import {
  mistakeTypeFromExplanation,
  recomputeWeakness,
  transitionReview,
} from "@/lib/review/loop";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { ownedProblem, ownedSession, ownedSimilarProblemRecord } from "@/lib/utils/resources";
import { uuid } from "@/lib/utils/schemas";
import { answersMatch } from "@/lib/utils/answers";

const schema = z.object({
  childId: uuid,
  sessionId: uuid,
  problemId: uuid.optional(),
  similarProblemId: uuid.optional(),
  childAnswer: z.string().trim().min(1).max(500),
  answerType: z.enum(["tap", "text", "voice", "handwriting"]),
  isCorrect: z.boolean().optional(),
  hintLevelUsed: z.number().int().min(0).max(4).default(0),
  mistakeType: z.enum(MISTAKE_TYPE_IDS).nullable().optional(),
  aiFeedback: z.string().trim().max(1000).nullable().optional(),
}).refine((value) => Boolean(value.problemId) !== Boolean(value.similarProblemId), {
  message: "Exactly one problem reference is required",
});

// parseJson は z.ZodType<T> で入力型に単一化されるため input 型で受ける(hintLevelUsed の default は下で補う)。
type Input = z.input<typeof schema>;
type Auth = Awaited<ReturnType<typeof requireOwnedChild>>;

interface AttemptTarget {
  expectedAnswer: string;
  sourceProblemId: string;
  subUnit: string;
  unit: string;
  explanation: unknown;
}

export async function POST(request: Request) {
  const parsed = await parseJson(request, schema);
  if (!parsed.success) return apiError("Invalid attempt");
  const input = parsed.data;
  const auth = await requireOwnedChild(input.childId);
  if (auth.response) return auth.response;

  const [sessionOk, target] = await Promise.all([
    ownedSession(auth.supabase, input.childId, input.sessionId),
    loadTarget(auth, input),
  ]);
  if (!sessionOk || !target) return apiError("Learning resource not found", 404);
  const isCorrect = answersMatch(input.childAnswer, target.expectedAnswer);
  const mistakeType = resolveMistakeType(input, isCorrect, target.explanation);

  const { data, error } = await auth.supabase.from("attempts").insert({
    child_id: input.childId,
    session_id: input.sessionId,
    problem_id: input.problemId ?? null,
    similar_problem_id: input.similarProblemId ?? null,
    child_answer: input.childAnswer,
    answer_type: input.answerType,
    is_correct: isCorrect,
    hint_level_used: input.hintLevelUsed ?? 0,
    mistake_type: mistakeType,
    ai_feedback: input.aiFeedback ?? null,
  }).select("id, is_correct, created_at").single();
  if (error) return internalError();

  const weakness = await recomputeWeakness(auth.supabase, {
    childId: input.childId,
    unit: target.unit,
    subUnit: target.subUnit,
    isCorrect,
  });
  if (!weakness) return internalError();

  const review = input.problemId
    ? await transitionReview(auth.supabase, {
      childId: input.childId,
      problemId: input.problemId,
      unit: target.unit,
      subUnit: target.subUnit,
      isCorrect,
    })
    : { action: "none" as const };
  if (review.action === "error") return internalError();

  return apiSuccess({
    ...data,
    mistake_type: mistakeType,
    mastery_level: weakness.masteryLevel,
    accuracy_rate: weakness.accuracyRate,
    review,
  }, 201);
}

/** 元問題または類題(とその元問題の診断)を所有確認つきで読む。 */
async function loadTarget(auth: Auth, input: Input): Promise<AttemptTarget | null> {
  if (input.problemId) {
    const problem = await ownedProblem(auth.supabase, input.childId, input.problemId);
    return problem ? {
      expectedAnswer: String(problem.correct_answer),
      sourceProblemId: problem.id,
      subUnit: problem.sub_unit,
      unit: problem.unit,
      explanation: problem.explanation_json,
    } : null;
  }
  const similar = await ownedSimilarProblemRecord(auth.supabase, input.childId, input.similarProblemId!);
  if (!similar) return null;
  const source = await ownedProblem(auth.supabase, input.childId, similar.source_problem_id);
  return {
    expectedAnswer: String(similar.answer),
    sourceProblemId: similar.source_problem_id,
    subUnit: similar.sub_unit,
    unit: similar.unit,
    explanation: source?.explanation_json ?? null,
  };
}

/** 不正解でリクエストに mistakeType が無ければ、AI 診断(explanation_json.mistakeType)を引き継ぐ(A4)。 */
const resolveMistakeType = (input: Input, isCorrect: boolean, explanation: unknown) => {
  if (isCorrect) return null;
  if (input.mistakeType) return input.mistakeType;
  return mistakeTypeFromExplanation(explanation);
};
