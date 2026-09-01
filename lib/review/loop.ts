import type { createClient } from "@/lib/supabase/server";
import { mistakeTypeSchema, type MistakeTypeId } from "@/lib/ai/schemas";
import type { MistakeHistoryEntry } from "@/lib/review/recommend";
import { updateWeakness, type WeaknessStats } from "@/lib/review/weakness";
import { addDaysJst, todayKeyJst } from "@/lib/utils/date";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** recompute_weakness RPC(supabase/migrations/0009_learning_loop.sql)の戻り行。 */
export interface WeaknessRpcRow {
  attempt_count: number | string;
  correct_count: number | string;
  mistake_count: number;
  accuracy_rate: number | string;
  mastery_level: string;
}

export interface UnitAttemptInput {
  childId: string;
  unit: string;
  subUnit: string;
  isCorrect: boolean;
}

/**
 * RPC が再計算した「この attempt を含む」件数から、直前の統計を復元して
 * lib/review/weakness.ts の updateWeakness に通す(mastery の規則を TS 側の正で判断する)。
 */
export const weaknessStatsAfterAttempt = (
  row: WeaknessRpcRow,
  isCorrect: boolean,
): WeaknessStats => {
  const attemptCount = Number(row.attempt_count);
  const correctCount = Number(row.correct_count);
  const previousAttempts = attemptCount - 1;
  const previousCorrect = correctCount - (isCorrect ? 1 : 0);
  const previous: WeaknessStats | null = previousAttempts <= 0 ? null : {
    accuracyRate: Math.round((previousCorrect / previousAttempts) * 10_000) / 10_000,
    attemptCount: previousAttempts,
    correctCount: previousCorrect,
    masteryLevel: "learning",
    mistakeCount: previousAttempts - previousCorrect,
  };
  return updateWeakness(previous, { isCorrect });
};

/** 単元全体の正答率を SQL 側でアトミックに再計算・upsert し、TS 側で統計を導出する。 */
export async function recomputeWeakness(
  supabase: Supabase,
  input: UnitAttemptInput,
): Promise<WeaknessStats | null> {
  const { data, error } = await supabase.rpc("recompute_weakness", {
    target_child_id: input.childId,
    target_unit: input.unit,
    target_sub_unit: input.subUnit,
  });
  if (error) return null;
  const row = (Array.isArray(data) ? data[0] : data) as WeaknessRpcRow | null | undefined;
  return row ? weaknessStatsAfterAttempt(row, input.isCorrect) : null;
}

/** problems.explanation_json に保存された AI 診断の mistakeType(検証済みのもののみ)。 */
export const mistakeTypeFromExplanation = (explanation: unknown): MistakeTypeId | null => {
  if (!explanation || typeof explanation !== "object") return null;
  const parsed = mistakeTypeSchema.safeParse((explanation as { mistakeType?: unknown }).mistakeType);
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
  supabase: Supabase,
  input: ReviewTransitionInput,
): Promise<ReviewTransition> {
  const today = todayKeyJst(input.now ?? new Date());
  const { data: existing, error } = await supabase.from("review_schedule")
    .select("id, status, scheduled_for, review_stage")
    .eq("child_id", input.childId)
    .eq("problem_id", input.problemId)
    .maybeSingle();
  if (error) return { action: "error" };

  if (!input.isCorrect) {
    if (existing?.status === "pending") return { action: "none" };
    const scheduledFor = addDaysJst(today, 1);
    const { error: upsertError } = await supabase.from("review_schedule").upsert({
      child_id: input.childId,
      problem_id: input.problemId,
      unit: input.unit,
      sub_unit: input.subUnit,
      scheduled_for: scheduledFor,
      review_stage: 1,
      status: "pending",
    }, { onConflict: "child_id,problem_id" });
    return upsertError ? { action: "error" } : { action: "created", scheduledFor, reviewStage: 1 };
  }

  if (existing?.status === "pending" && String(existing.scheduled_for) <= today) {
    const { error: updateError } = await supabase.from("review_schedule")
      .update({ status: "done" })
      .eq("id", existing.id)
      .eq("child_id", input.childId);
    return updateError ? { action: "error" } : { action: "completed", reviewId: existing.id };
  }
  return { action: "none" };
}

const RECENT_ATTEMPT_WINDOW = 50;
const ids = (rows: readonly { id: string }[] | null | undefined) => new Set((rows ?? []).map((row) => row.id));

/**
 * 同じ単元に対する直近の attempts(新しい順)を、元問題・類題の両方から集める。
 * lowerDifficultyForRepeatedMistake の入力(doc.md §12.2「同じ間違いが連続」)。
 */
export async function recentUnitAttempts(
  supabase: Supabase,
  childId: string,
  unit: string,
  limit = 5,
): Promise<MistakeHistoryEntry[]> {
  const [problems, similar, attempts] = await Promise.all([
    supabase.from("problems").select("id").eq("child_id", childId).eq("unit", unit).limit(200),
    supabase.from("generated_similar_problems").select("id")
      .eq("child_id", childId).eq("unit", unit).limit(500),
    supabase.from("attempts").select("problem_id, similar_problem_id, mistake_type, is_correct")
      .eq("child_id", childId).order("created_at", { ascending: false }).limit(RECENT_ATTEMPT_WINDOW),
  ]);
  if (problems.error || similar.error || attempts.error) return [];
  const problemIds = ids(problems.data);
  const similarIds = ids(similar.data);

  return (attempts.data ?? [])
    .filter((attempt) => problemIds.has(attempt.problem_id) || similarIds.has(attempt.similar_problem_id))
    .slice(0, limit)
    .map((attempt) => ({
      isCorrect: Boolean(attempt.is_correct),
      mistakeType: mistakeTypeSchema.safeParse(attempt.mistake_type).success
        ? (attempt.mistake_type as MistakeTypeId)
        : null,
    }));
}

/** クライアント申告の秒数を、サーバー計測(now - started_at)以下に丸める(B7)。 */
export const clampDurationSeconds = (clientSeconds: number, startedAt: string, now: Date): number => {
  const elapsed = Math.floor((now.getTime() - new Date(startedAt).getTime()) / 1000);
  if (Number.isNaN(elapsed)) return 0;
  return Math.max(0, Math.min(clientSeconds, elapsed));
};

/** learning_sessions の結果はクライアント値を信用せず、そのセッションの attempts から導出する。 */
export async function sessionAttemptCounts(
  supabase: Supabase,
  childId: string,
  sessionId: string,
): Promise<{ total: number; correct: number } | null> {
  const { data, error } = await supabase.from("attempts")
    .select("is_correct")
    .eq("child_id", childId)
    .eq("session_id", sessionId)
    .limit(200);
  if (error) return null;
  const rows = data ?? [];
  return {
    total: rows.length,
    correct: rows.filter((attempt) => Boolean(attempt.is_correct)).length,
  };
}
