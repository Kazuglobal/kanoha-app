import { eq, and, desc, asc, inArray } from "drizzle-orm";
import { z } from "zod";
import * as schema from "@/lib/db/schema";
import { calculateReviewSchedule, toReviewStage } from "@/lib/review/schedule";
import { masteryAfterSimilarSet, type MasteryLevel } from "@/lib/review/weakness";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { checkRateLimitDb } from "@/lib/utils/rateLimit";
import { ownedProblem, ownedSession } from "@/lib/utils/resources";
import { uuid } from "@/lib/utils/schemas";
import { nowJstIso } from "@/lib/utils/date";
import type { Database } from "@/lib/db";

const schemaValidation = z.object({
  childId: uuid,
  problemId: uuid,
  sessionId: uuid,
});

const SIMILAR_SET_SIZE = 5;
const SIMILAR_LOOKUP_LIMIT = 50;

type Input = z.infer<typeof schemaValidation>;

interface ExistingReview {
  review_stage: number | null;
  status: string;
}

export async function POST(request: Request) {
  const parsed = await parseJson(request, schemaValidation);
  if (!parsed.success) return apiError("Invalid review schedule");
  const input = parsed.data;
  const auth = await requireOwnedChild(input.childId);
  if (auth.response) return auth.response;
  if (!(await checkRateLimitDb(auth.user!.id, "review-schedule", 30))) {
    return apiError("Too many requests", 429);
  }

  const [problem, sessionOk] = await Promise.all([
    ownedProblem(input.childId, input.problemId, auth.db),
    ownedSession(input.childId, input.sessionId, auth.db),
  ]);
  if (!problem || !sessionOk) return apiError("Learning resource not found", 404);

  const similarCorrectCount = await countSimilarCorrect(auth.db, input);
  if (similarCorrectCount === null) return internalError();

  const existing = await auth.db
    .select({
      review_stage: schema.reviewSchedule.reviewStage,
      status: schema.reviewSchedule.status,
    })
    .from(schema.reviewSchedule)
    .where(
      and(
        eq(schema.reviewSchedule.childId, input.childId),
        eq(schema.reviewSchedule.problemId, input.problemId),
      ),
    )
    .get();

  const current = existing ?? null;

  const eligible = await reviewEligible(auth.db, input, current);
  if (eligible === null) return internalError();

  const review = eligible
    ? await upsertReview(auth.db, input, problem, current, similarCorrectCount)
    : { scheduled: false as const };
  if (review === null) return internalError();

  const mastery = await applySimilarSetMastery(auth.db, input, problem, similarCorrectCount);
  if (mastery === null) return internalError();

  return apiSuccess({
    ...review,
    mastery_level: mastery,
    similar_correct_count: similarCorrectCount,
  });
}

async function countSimilarCorrect(db: Database, input: Input): Promise<number | null> {
  try {
    const similarRows = await db
      .select({ id: schema.generatedSimilarProblems.id })
      .from(schema.generatedSimilarProblems)
      .where(
        and(
          eq(schema.generatedSimilarProblems.childId, input.childId),
          eq(schema.generatedSimilarProblems.sourceProblemId, input.problemId),
        ),
      )
      .orderBy(desc(schema.generatedSimilarProblems.createdAt))
      .limit(SIMILAR_SET_SIZE)
      .all();

    const ids = similarRows.map((r) => r.id);
    if (ids.length === 0) return 0;

    const attemptsRows = await db
      .select({
        similar_problem_id: schema.attempts.similarProblemId,
        is_correct: schema.attempts.isCorrect,
      })
      .from(schema.attempts)
      .where(
        and(
          eq(schema.attempts.childId, input.childId),
          eq(schema.attempts.sessionId, input.sessionId),
          inArray(schema.attempts.similarProblemId, ids),
        ),
      )
      .orderBy(asc(schema.attempts.createdAt))
      .limit(SIMILAR_LOOKUP_LIMIT)
      .all();

    const first = attemptsRows.reduce<Map<string, boolean>>((acc, row) => {
      const pid = row.similar_problem_id!;
      return acc.has(pid) ? acc : new Map(acc).set(pid, Boolean(row.is_correct));
    }, new Map());

    return Math.min(SIMILAR_SET_SIZE, [...first.values()].filter(Boolean).length);
  } catch {
    return null;
  }
}

async function reviewEligible(
  db: Database,
  input: Input,
  current: ExistingReview | null,
): Promise<boolean | null> {
  if (current?.status === "pending") return true;
  try {
    const row = await db
      .select({ is_correct: schema.attempts.isCorrect })
      .from(schema.attempts)
      .where(
        and(
          eq(schema.attempts.childId, input.childId),
          eq(schema.attempts.problemId, input.problemId),
          eq(schema.attempts.sessionId, input.sessionId),
        ),
      )
      .orderBy(desc(schema.attempts.createdAt))
      .limit(1)
      .get();

    return row ? row.is_correct === 0 : false;
  } catch {
    return null;
  }
}

async function upsertReview(
  db: Database,
  input: Input,
  problem: { unit: string; subUnit: string },
  current: ExistingReview | null,
  similarCorrectCount: number,
) {
  const { scheduledFor, reviewStage } = calculateReviewSchedule({
    correctCount: similarCorrectCount,
    currentStage: toReviewStage(current?.review_stage),
    reviewedAt: new Date(),
  });
  const now = nowJstIso();

  try {
    const row = await db
      .insert(schema.reviewSchedule)
      .values({
        id: crypto.randomUUID(),
        childId: input.childId,
        problemId: input.problemId,
        unit: problem.unit,
        subUnit: problem.subUnit,
        scheduledFor,
        reviewStage,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [schema.reviewSchedule.childId, schema.reviewSchedule.problemId],
        set: {
          unit: problem.unit,
          subUnit: problem.subUnit,
          scheduledFor,
          reviewStage,
          status: "pending",
          updatedAt: now,
        },
      })
      .returning({
        id: schema.reviewSchedule.id,
        scheduled_for: schema.reviewSchedule.scheduledFor,
        review_stage: schema.reviewSchedule.reviewStage,
        status: schema.reviewSchedule.status,
      })
      .get();

    return { ...row, scheduled: true as const };
  } catch {
    return null;
  }
}

async function applySimilarSetMastery(
  db: Database,
  input: Input,
  problem: { unit: string; subUnit: string },
  similarCorrectCount: number,
): Promise<MasteryLevel | null> {
  const { unit, subUnit } = problem;
  try {
    const current = await db
      .select({
        id: schema.weaknessMap.id,
        accuracy_rate: schema.weaknessMap.accuracyRate,
        mistake_count: schema.weaknessMap.mistakeCount,
        mastery_level: schema.weaknessMap.masteryLevel,
      })
      .from(schema.weaknessMap)
      .where(
        and(
          eq(schema.weaknessMap.childId, input.childId),
          eq(schema.weaknessMap.unit, unit),
          eq(schema.weaknessMap.subUnit, subUnit),
        ),
      )
      .get();

    const currentLevel = (current?.mastery_level ?? "learning") as MasteryLevel;
    const next = masteryAfterSimilarSet(currentLevel, similarCorrectCount);
    if (next === currentLevel) return next;

    const now = nowJstIso();
    if (current) {
      await db
        .update(schema.weaknessMap)
        .set({
          masteryLevel: next,
          lastAttemptedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.weaknessMap.id, current.id))
        .run();
    } else {
      await db
        .insert(schema.weaknessMap)
        .values({
          id: crypto.randomUUID(),
          childId: input.childId,
          unit,
          subUnit,
          accuracyRate: 0,
          mistakeCount: 0,
          masteryLevel: next,
          lastAttemptedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    return next;
  } catch {
    return null;
  }
}
