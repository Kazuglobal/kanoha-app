import type { Difficulty, MistakeTypeId } from "@/lib/ai/schemas";

export interface RecommendationCandidate {
  id: string;
  /** 類題候補のとき、子どもが開く元問題の id。 */
  sourceProblemId?: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  isMastered: boolean;
  matchesRecentMistake: boolean;
  review?:
    | { scheduledFor: string; status: "pending" | "done" | "skipped" }
    | { scheduled_for: string; status: string };
  studyCount: number;
  unit: string;
  weaknessAccuracyRate: number | null;
}

export interface RecommendationOptions {
  maxItems?: number;
  maxMinutes?: number;
  today: string;
}

const reviewDate = (candidate: RecommendationCandidate): string | undefined => {
  if (!candidate.review) return undefined;
  return "scheduledFor" in candidate.review
    ? candidate.review.scheduledFor
    : candidate.review.scheduled_for;
};

const priority = (candidate: RecommendationCandidate, today: string): number => {
  if (
    candidate.review?.status === "pending" &&
    (reviewDate(candidate) ?? "") <= today
  ) {
    return 0;
  }
  if (!candidate.isMastered && candidate.weaknessAccuracyRate !== null) return 1;
  if (candidate.matchesRecentMistake) return 2;
  return 3;
};

const compareCandidates = (today: string) => (
  left: RecommendationCandidate,
  right: RecommendationCandidate,
) => {
  const priorityDifference = priority(left, today) - priority(right, today);
  if (priorityDifference !== 0) return priorityDifference;

  if (priority(left, today) === 0) {
    return (reviewDate(left) ?? "").localeCompare(reviewDate(right) ?? "");
  }
  if (priority(left, today) === 1) {
    return (left.weaknessAccuracyRate ?? 1) - (right.weaknessAccuracyRate ?? 1);
  }
  return left.studyCount - right.studyCount;
};

export const recommendToday = (
  candidates: readonly RecommendationCandidate[],
  { today, maxItems = 7, maxMinutes = 15 }: RecommendationOptions,
): RecommendationCandidate[] => {
  if (maxItems < 0 || maxMinutes < 0) throw new RangeError("limits must be non-negative");

  return [...candidates]
    .sort(compareCandidates(today))
    .reduce<RecommendationCandidate[]>((selected, candidate) => {
      const usedMinutes = selected.reduce((sum, item) => sum + item.estimatedMinutes, 0);
      if (
        selected.length >= maxItems ||
        candidate.estimatedMinutes < 0 ||
        usedMinutes + candidate.estimatedMinutes > maxMinutes
      ) {
        return selected;
      }
      return [...selected, candidate];
    }, []);
};

export const lowerDifficultyForRepeatedMistake = (
  difficulty: Difficulty,
  consecutiveMistakes: number,
): Difficulty => {
  if (consecutiveMistakes < 2) return difficulty;
  if (difficulty === "advanced") return "standard";
  return "basic";
};

export interface MistakeHistoryEntry {
  isCorrect: boolean;
  mistakeType: MistakeTypeId | null;
}

export interface MistakeStreak {
  count: number;
  mistakeType: MistakeTypeId | null;
}

/**
 * 直近(先頭が最新)の attempts から「同じ間違え方が連続した回数」を数える(doc.md §12.2)。
 * 正解、または間違え方が付いていない attempt で連続は途切れる。
 */
export const consecutiveMistakeStreak = (
  history: readonly MistakeHistoryEntry[],
): MistakeStreak => {
  const first = history[0];
  if (!first || first.isCorrect || !first.mistakeType) return { count: 0, mistakeType: null };
  const count = history.findIndex(
    (entry) => entry.isCorrect || entry.mistakeType !== first.mistakeType,
  );
  return { count: count === -1 ? history.length : count, mistakeType: first.mistakeType };
};

/** 類題生成に使う難易度: 同じ間違え方が2回以上続いていれば1段下げる。 */
export const difficultyForNextSimilarSet = (
  baseDifficulty: Difficulty,
  history: readonly MistakeHistoryEntry[],
): { difficulty: Difficulty; streak: MistakeStreak } => {
  const streak = consecutiveMistakeStreak(history);
  return { difficulty: lowerDifficultyForRepeatedMistake(baseDifficulty, streak.count), streak };
};
