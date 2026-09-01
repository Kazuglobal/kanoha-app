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

export const updateWeakness = (
  current: WeaknessStats | null,
  attempt: WeaknessAttempt,
): WeaknessStats => {
  const attemptCount = (current?.attemptCount ?? 0) + 1;
  const correctCount = (current?.correctCount ?? 0) + (attempt.isCorrect ? 1 : 0);
  const mistakeCount = (current?.mistakeCount ?? 0) + (attempt.isCorrect ? 0 : 1);
  const accuracyRate = Math.round((correctCount / attemptCount) * 10_000) / 10_000;
  const masteryLevel: MasteryLevel =
    attemptCount >= 5 && accuracyRate >= 0.8
      ? "mastered"
      : correctCount > 0
        ? "reviewing"
        : "learning";

  return { accuracyRate, attemptCount, correctCount, masteryLevel, mistakeCount };
};
