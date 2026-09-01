export type MasteryLevel = "learning" | "reviewing" | "mastered";

export interface WeaknessStats {
  accuracyRate: number;
  attemptCount: number;
  correctCount: number;
  masteryLevel: MasteryLevel;
  mistakeCount: number;
}

export interface WeaknessAttempt {
  isCorrect: boolean;
}

/** 類題セットで習得扱いになる正解数(doc.md §9: 4問以上正解)。 */
export const SIMILAR_SET_MASTERY_THRESHOLD = 4;

const masteryFor = (attemptCount: number, correctCount: number, accuracyRate: number): MasteryLevel =>
  attemptCount >= 5 && accuracyRate >= 0.8
    ? "mastered"
    : correctCount > 0
      ? "reviewing"
      : "learning";

/**
 * 1回の attempt を積み上げた単元統計。
 * mastery の規則は supabase/migrations/0009_learning_loop.sql の recompute_weakness と同一。
 */
export const updateWeakness = (
  current: WeaknessStats | null,
  attempt: WeaknessAttempt,
): WeaknessStats => {
  const attemptCount = (current?.attemptCount ?? 0) + 1;
  const correctCount = (current?.correctCount ?? 0) + (attempt.isCorrect ? 1 : 0);
  const mistakeCount = (current?.mistakeCount ?? 0) + (attempt.isCorrect ? 0 : 1);
  const accuracyRate = Math.round((correctCount / attemptCount) * 10_000) / 10_000;

  return {
    accuracyRate,
    attemptCount,
    correctCount,
    masteryLevel: masteryFor(attemptCount, correctCount, accuracyRate),
    mistakeCount,
  };
};

/**
 * 類題5問の結果で単元の習得度を決める(doc.md §9)。
 * 4/5 以上で mastered。それ未満なら mastered から reviewing に戻し、それ以外は据え置き。
 */
export const masteryAfterSimilarSet = (
  current: MasteryLevel,
  similarCorrectCount: number,
): MasteryLevel => {
  if (!Number.isInteger(similarCorrectCount) || similarCorrectCount < 0 || similarCorrectCount > 5) {
    throw new RangeError("similarCorrectCount must be an integer from 0 to 5");
  }
  if (similarCorrectCount >= SIMILAR_SET_MASTERY_THRESHOLD) return "mastered";
  return current === "mastered" ? "reviewing" : current;
};
