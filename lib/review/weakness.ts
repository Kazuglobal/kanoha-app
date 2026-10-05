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

/** この正答率以上は「できている」扱い(習得判定と苦手判定で共通)。 */
export const MASTERY_ACCURACY_THRESHOLD = 0.8;

/** 親ダッシュボードの「苦手単元」: 習得前で、まちがいがあり、正答率が習得ラインに届かない単元。 */
export const isWeakUnit = (unit: {
  accuracyRate: number;
  masteryLevel: string;
  mistakeCount: number;
}): boolean =>
  unit.masteryLevel !== "mastered" &&
  unit.mistakeCount > 0 &&
  unit.accuracyRate < MASTERY_ACCURACY_THRESHOLD;

const masteryFor = (attemptCount: number, correctCount: number, accuracyRate: number): MasteryLevel =>
  attemptCount >= 5 && accuracyRate >= MASTERY_ACCURACY_THRESHOLD
    ? "mastered"
    : correctCount > 0
      ? "reviewing"
      : "learning";

/**
 * 1回の attempt を積み上げた単元統計。
 * mastery の規則は supabase/migrations/0009_learning_loop.sql の recompute_weakness と同一。
 * mastered は sticky: 1問の不正解では戻さない(降格は masteryAfterSimilarSet だけが行う)。
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
    masteryLevel: current?.masteryLevel === "mastered"
      ? "mastered"
      : masteryFor(attemptCount, correctCount, accuracyRate),
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
