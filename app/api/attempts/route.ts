import { z } from "zod";
import { MISTAKE_TYPE_IDS } from "@/lib/curriculum/mistakeTypes";
import { readStoredChoices } from "@/lib/review/choices";
import {
  mistakeTypeFromExplanation,
  recomputeWeakness,
  transitionReview,
} from "@/lib/review/loop";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild } from "@/lib/utils/api";
import {
  hintMaxLevel,
  ownedProblem,
  ownedSession,
  ownedSimilarProblemRecord,
} from "@/lib/utils/resources";
import { uuid } from "@/lib/utils/schemas";
import { answersMatch } from "@/lib/utils/answers";

/**
 * hint_level_used はクライアントから受け取らず problem_hint_views(サーバー記録)から読む(A2)。
 * 未知のキー(旧 hintLevelUsed など)は無視される。
 */
const schema = z.object({
  childId: uuid,
  sessionId: uuid,
  problemId: uuid.optional(),
  similarProblemId: uuid.optional(),
  childAnswer: z.string().trim().min(1).max(500),
  answerType: z.enum(["tap", "text", "voice", "handwriting"]),
  mistakeType: z.enum(MISTAKE_TYPE_IDS).nullable().optional(),
  aiFeedback: z.string().trim().max(1000).nullable().optional(),
}).refine((value) => Boolean(value.problemId) !== Boolean(value.similarProblemId), {
  message: "Exactly one problem reference is required",
});

type Input = z.infer<typeof schema>;
type Auth = Awaited<ReturnType<typeof requireOwnedChild>>;

interface AttemptTarget {
  expectedAnswer: string;
  sourceProblemId: string;
  subUnit: string;
  unit: string;
  explanation: unknown;
  /** 類題の保存済み 4 択(null = 文字入力)。元問題は null。 */
  choices: readonly string[] | null;
  /** 類題の解説。不正解のときだけ返す(元問題は何も返さない)。 */
  similarExplanation: string | null;
}

export async function POST(request: Request) {
  const parsed = await parseJson(request, schema);
  if (!parsed.success) return apiError("Invalid attempt");
  const input = parsed.data;
  const auth = await requireOwnedChild(input.childId);
  if (auth.response) return auth.response;

  const [sessionOk, target, hintLevel] = await Promise.all([
    ownedSession(auth.supabase, input.childId, input.sessionId),
    loadTarget(auth, input),
    input.problemId ? hintMaxLevel(auth.supabase, input.childId, input.problemId, input.sessionId) : 0,
  ]);
  if (!sessionOk || !target) return apiError("Learning resource not found", 404);
  if (hintLevel === null) return internalError();
  if (!tapAnswerAllowed(input, target)) return apiError("Invalid attempt");
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
    hint_level_used: hintLevel,
    mistake_type: mistakeType,
    ai_feedback: input.aiFeedback ?? null,
  }).select("id, is_correct, created_at").single();
  if (error) return internalError();

  const weakness = await recomputeWeakness(auth.supabase, {
    childId: input.childId,
    unit: target.unit,
    subUnit: target.subUnit,
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
    hint_level_used: hintLevel,
    mistake_type: mistakeType,
    mastery_level: weakness.masteryLevel,
    accuracy_rate: weakness.accuracyRate,
    review,
    explanation: !isCorrect && target.similarExplanation ? target.similarExplanation : null,
  }, 201);
}

/** タップ回答は保存済みの 4 択のどれかでなければならない(選択肢はサーバーが作る)。 */
const tapAnswerAllowed = (input: Input, target: AttemptTarget): boolean =>
  input.answerType !== "tap" || !target.choices || target.choices.includes(input.childAnswer);

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
      choices: null,
      similarExplanation: null,
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
    choices: readStoredChoices(similar.choices),
    similarExplanation: typeof similar.explanation === "string" ? similar.explanation : null,
  };
}

/** 不正解でリクエストに mistakeType が無ければ、AI 診断(explanation_json.mistakeType)を引き継ぐ(A4)。 */
const resolveMistakeType = (input: Input, isCorrect: boolean, explanation: unknown) => {
  if (isCorrect) return null;
  if (input.mistakeType) return input.mistakeType;
  return mistakeTypeFromExplanation(explanation);
};
