import { eq, and, desc } from "drizzle-orm";
import { mistakeTypeSchema, type MistakeTypeId } from "@/lib/ai/schemas";
import { getDb } from "@/lib/db";
import { recomputeWeakness as dbRecomputeWeakness } from "@/lib/db/operations";
import * as schema from "@/lib/db/schema";
import type { MistakeHistoryEntry } from "@/lib/review/recommend";
import type { MasteryLevel, WeaknessStats } from "@/lib/review/weakness";
import { addDaysJst, nowJstIso, todayKeyJst } from "@/lib/utils/date";

export interface WeaknessRpcRow {
  attempt_count: number | string;
  correct_count: number | string;
  mistake_count: number;
  accuracy_rate: number | string;
  mastery_level: string;
}

const MASTERY_LEVELS: readonly MasteryLevel[] = ["learning", "reviewing", "mastered"];

const toMasteryLevel = (value: string): MasteryLevel =>
  (MASTERY_LEVELS as readonly string[]).includes(value) ? (value as MasteryLevel) : "learning";

export const weaknessStatsFromRow = (row: WeaknessRpcRow): WeaknessStats => ({
  accuracyRate: Number(row.accuracy_rate),
  attemptCount: Number(row.attempt_count),
  correctCount: Number(row.correct_count),
  masteryLevel: toMasteryLevel(row.mastery_level),
  mistakeCount: Number(row.mistake_count),
});

export interface UnitAttemptInput {
  childId: string;
  unit: string;
  subUnit: string;
}

/** 単元全体の正答率を SQL 側でアトミックに再計算・upsert し、その行を統計として返す。 */
export async function recomputeWeakness(
  input: UnitAttemptInput,
  db = getDb(),
): Promise<WeaknessStats | null> {
  try {
    const res = await dbRecomputeWeakness(input.childId, input.unit, input.subUnit, db);
    return {
      accuracyRate: res.accuracyRate,
      attemptCount: res.attemptCount,
      correctCount: res.correctCount,
      masteryLevel: res.masteryLevel,
      mistakeCount: res.mistakeCount,
    };
  } catch {
    return null;
  }
}

/** problems.explanation_json に保存された AI 診断の mistakeType(検証済みのもののみ)。 */
export const mistakeTypeFromExplanation = (explanation: unknown): MistakeTypeId | null => {
  let obj = explanation;
  if (typeof obj === "string") {
    try {
      obj = JSON.parse(obj);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  const parsed = mistakeTypeSchema.safeParse((obj as { mistakeType?: unknown }).mistakeType);
  return parsed.success ? parsed.data : null;
};

export interface ReviewTransitionInput {
  childId: string;
  problemId: string;
  unit: string;
  subUnit: string;
  isCorrect: boolean;
  now?: Date;
}

export type ReviewTransition =
  | { action: "created"; scheduledFor: string; reviewStage: 1 }
  | { action: "completed"; reviewId: string }
  | { action: "none" }
  | { action: "error" };

/**
 * doc.md §12.1: 最初の不正解で stage 1(1日後)の復習を登録する。
 * 期日を迎えた復習の問題に正解したら done にする(次の予定は /api/reviews/schedule が類題結果で決める)。
 */
export async function transitionReview(
  input: ReviewTransitionInput,
  db = getDb(),
): Promise<ReviewTransition> {
  const today = todayKeyJst(input.now ?? new Date());
  try {
    const existing = await db
      .select({
        id: schema.reviewSchedule.id,
        status: schema.reviewSchedule.status,
        scheduled_for: schema.reviewSchedule.scheduledFor,
        review_stage: schema.reviewSchedule.reviewStage,
      })
      .from(schema.reviewSchedule)
      .where(
        and(
          eq(schema.reviewSchedule.childId, input.childId),
          eq(schema.reviewSchedule.problemId, input.problemId),
        ),
      )
      .get();

    if (!input.isCorrect) {
      if (existing?.status === "pending") return { action: "none" };
      const scheduledFor = addDaysJst(today, 1);
      const now = nowJstIso();

      await db
        .insert(schema.reviewSchedule)
        .values({
          id: crypto.randomUUID(),
          childId: input.childId,
          problemId: input.problemId,
          unit: input.unit,
          subUnit: input.subUnit,
          scheduledFor,
          reviewStage: 1,
          status: "pending",
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [schema.reviewSchedule.childId, schema.reviewSchedule.problemId],
          set: {
            unit: input.unit,
            subUnit: input.subUnit,
            scheduledFor,
            reviewStage: 1,
            status: "pending",
            updatedAt: now,
          },
        })
        .run();

      return { action: "created", scheduledFor, reviewStage: 1 };
    }

    if (existing?.status === "pending" && String(existing.scheduled_for) <= today) {
      await db
        .update(schema.reviewSchedule)
        .set({ status: "done", updatedAt: nowJstIso() })
        .where(
          and(
            eq(schema.reviewSchedule.id, existing.id),
            eq(schema.reviewSchedule.childId, input.childId),
          ),
        )
        .run();

      return { action: "completed", reviewId: existing.id };
    }
    return { action: "none" };
  } catch {
    return { action: "error" };
  }
}

const RECENT_ATTEMPT_WINDOW = 50;

/**
 * 同じ単元に対する直近の attempts(新しい順)を、元問題・類題の両方から集める。
 */
export async function recentUnitAttempts(
  childId: string,
  unit: string,
  limit = 5,
  db = getDb(),
): Promise<MistakeHistoryEntry[]> {
  try {
    const [problemsRows, similarRows, attemptsRows] = await Promise.all([
      db
        .select({ id: schema.problems.id })
        .from(schema.problems)
        .where(and(eq(schema.problems.childId, childId), eq(schema.problems.unit, unit)))
        .limit(200)
        .all(),
      db
        .select({ id: schema.generatedSimilarProblems.id })
        .from(schema.generatedSimilarProblems)
        .where(
          and(
            eq(schema.generatedSimilarProblems.childId, childId),
            eq(schema.generatedSimilarProblems.unit, unit),
          ),
        )
        .limit(500)
        .all(),
      db
        .select({
          problem_id: schema.attempts.problemId,
          similar_problem_id: schema.attempts.similarProblemId,
          mistake_type: schema.attempts.mistakeType,
          is_correct: schema.attempts.isCorrect,
        })
        .from(schema.attempts)
        .where(eq(schema.attempts.childId, childId))
        .orderBy(desc(schema.attempts.createdAt))
        .limit(RECENT_ATTEMPT_WINDOW)
        .all(),
    ]);

    const problemIds = new Set(problemsRows.map((r) => r.id));
    const similarIds = new Set(similarRows.map((r) => r.id));

    return (attemptsRows ?? [])
      .filter(
        (a) =>
          (a.problem_id && problemIds.has(a.problem_id)) ||
          (a.similar_problem_id && similarIds.has(a.similar_problem_id)),
      )
      .slice(0, limit)
      .map((a) => ({
        isCorrect: Boolean(a.is_correct),
        mistakeType: mistakeTypeSchema.safeParse(a.mistake_type).success
          ? (a.mistake_type as MistakeTypeId)
          : null,
      }));
  } catch {
    return [];
  }
}

/** クライアント申告の秒数を、サーバー計測(now - started_at)以下に丸める(B7)。 */
export const clampDurationSeconds = (
  clientSeconds: number,
  startedAt: string,
  now: Date,
): number => {
  const elapsed = Math.floor((now.getTime() - new Date(startedAt).getTime()) / 1000);
  if (Number.isNaN(elapsed)) return 0;
  return Math.max(0, Math.min(clientSeconds, elapsed));
};

/** learning_sessions の結果はクライアント値を信用せず、そのセッションの attempts から導出する。 */
export async function sessionAttemptCounts(
  childId: string,
  sessionId: string,
  db = getDb(),
): Promise<{ total: number; correct: number } | null> {
  try {
    const rows = await db
      .select({ is_correct: schema.attempts.isCorrect })
      .from(schema.attempts)
      .where(and(eq(schema.attempts.childId, childId), eq(schema.attempts.sessionId, sessionId)))
      .limit(200)
      .all();

    return {
      total: rows.length,
      correct: rows.filter((attempt) => Boolean(attempt.is_correct)).length,
    };
  } catch {
    return null;
  }
}
