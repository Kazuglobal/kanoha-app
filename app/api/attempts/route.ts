import { z } from "zod";
import { MISTAKE_TYPE_IDS } from "@/lib/curriculum/mistakeTypes";
import * as schema from "@/lib/db/schema";
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
import { checkRateLimitDb } from "@/lib/utils/rateLimit";
import { nowJstIso } from "@/lib/utils/date";
import { recordCorrectReward } from "@/lib/rewards/serverRewards";

/**
 * hint_level_used はクライアントから受け取らず problem_hint_views(サーバー記録)から読む(A2)。
 */
const schemaValidation = z
  .object({
    childId: uuid,
    sessionId: uuid,
    problemId: uuid.optional(),
    similarProblemId: uuid.optional(),
    childAnswer: z.string().trim().min(1).max(500),
    answerType: z.enum(["tap", "text", "voice", "handwriting"]),
    mistakeType: z.enum(MISTAKE_TYPE_IDS).nullable().optional(),
    aiFeedback: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((value) => Boolean(value.problemId) !== Boolean(value.similarProblemId), {
    message: "Exactly one problem reference is required",
  });

type Input = z.infer<typeof schemaValidation>;
type Auth = Awaited<ReturnType<typeof requireOwnedChild>>;

interface AttemptTarget {
  expectedAnswer: string;
  sourceProblemId: string;
  subUnit: string;
  unit: string;
  explanation: unknown;
  choices: readonly string[] | null;
  similarExplanation: string | null;
}

export async function POST(request: Request) {
  const parsed = await parseJson(request, schemaValidation);
  if (!parsed.success) return apiError("Invalid attempt");
  const input = parsed.data;
  const auth = await requireOwnedChild(input.childId);
  if (auth.response) return auth.response;
  if (!(await checkRateLimitDb(auth.user!.id, "attempts", 60))) {
    return apiError("Too many requests", 429);
  }

  const [sessionOk, target, hintLevel] = await Promise.all([
    ownedSession(input.childId, input.sessionId, auth.db),
    loadTarget(auth, input),
    input.problemId ? hintMaxLevel(input.childId, input.problemId, input.sessionId, auth.db) : 0,
  ]);
  if (!sessionOk || !target) return apiError("Learning resource not found", 404);
  if (hintLevel === null) return internalError();
  if (!tapAnswerAllowed(input, target)) return apiError("Invalid attempt");
  const isCorrect = answersMatch(input.childAnswer, target.expectedAnswer);
  const mistakeType = resolveMistakeType(input, isCorrect, target.explanation);

  const attemptId = crypto.randomUUID();
  const now = nowJstIso();

  try {
    const data = await auth.db
      .insert(schema.attempts)
      .values({
        id: attemptId,
        childId: input.childId,
        sessionId: input.sessionId,
        problemId: input.problemId ?? null,
        similarProblemId: input.similarProblemId ?? null,
        childAnswer: input.childAnswer,
        answerType: input.answerType,
        isCorrect: isCorrect ? 1 : 0,
        hintLevelUsed: hintLevel,
        mistakeType,
        aiFeedback: input.aiFeedback ?? null,
        createdAt: now,
      })
      .returning({
        id: schema.attempts.id,
        is_correct: schema.attempts.isCorrect,
        created_at: schema.attempts.createdAt,
      })
      .get();

    const weakness = await recomputeWeakness(
      {
        childId: input.childId,
        unit: target.unit,
        subUnit: target.subUnit,
      },
      auth.db,
    );
    if (!weakness) return internalError();

    const review = input.problemId
      ? await transitionReview(
          {
            childId: input.childId,
            problemId: input.problemId,
            unit: target.unit,
            subUnit: target.subUnit,
            isCorrect,
          },
          auth.db,
        )
      : { action: "none" as const };
    if (review.action === "error") return internalError();

    // ごほうびは元問題の正解だけで増える。記録はもう保存ずみなので、失敗しても回答は失敗扱いにしない。
    const reward =
      isCorrect && input.problemId
        ? await recordCorrectReward(auth.db, input.childId).catch(() => null)
        : null;

    return apiSuccess(
      {
        id: data.id,
        is_correct: Boolean(data.is_correct),
        created_at: data.created_at,
        hint_level_used: hintLevel,
        mistake_type: mistakeType,
        mastery_level: weakness.masteryLevel,
        accuracy_rate: weakness.accuracyRate,
        review,
        explanation: !isCorrect && target.similarExplanation ? target.similarExplanation : null,
        reward,
      },
      201,
    );
  } catch {
    return internalError();
  }
}

const tapAnswerAllowed = (input: Input, target: AttemptTarget): boolean =>
  input.answerType !== "tap" || !target.choices || target.choices.includes(input.childAnswer);

async function loadTarget(auth: Auth, input: Input): Promise<AttemptTarget | null> {
  if (input.problemId) {
    const problem = await ownedProblem(input.childId, input.problemId, auth.db);
    return problem
      ? {
          expectedAnswer: String(problem.correctAnswer),
          sourceProblemId: problem.id,
          subUnit: problem.subUnit,
          unit: problem.unit,
          explanation: problem.explanationJson,
          choices: null,
          similarExplanation: null,
        }
      : null;
  }
  const similar = await ownedSimilarProblemRecord(input.childId, input.similarProblemId!, auth.db);
  if (!similar) return null;
  const source = await ownedProblem(input.childId, similar.source_problem_id, auth.db);
  return {
    expectedAnswer: String(similar.answer),
    sourceProblemId: similar.source_problem_id,
    subUnit: similar.sub_unit,
    unit: similar.unit,
    explanation: source?.explanationJson ?? null,
    choices: readStoredChoices(similar.choices),
    similarExplanation: typeof similar.explanation === "string" ? similar.explanation : null,
  };
}

const resolveMistakeType = (input: Input, isCorrect: boolean, explanation: unknown) => {
  if (isCorrect) return null;
  if (input.mistakeType) return input.mistakeType;
  return mistakeTypeFromExplanation(explanation);
};
