import type { Difficulty } from "@/lib/ai/schemas";

export interface RecommendationCandidate {
  id: string;
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
