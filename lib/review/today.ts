import type { createClient } from "@/lib/supabase/server";
import { recommendToday } from "@/lib/review/recommend";
import { todayKeyJst } from "@/lib/utils/date";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function getTodayRecommendations(supabase: Supabase, childId: string) {
  const today = todayKeyJst();
  const [problemsResult, reviewsResult, weaknessResult, attemptsResult, settingsResult] =
    await Promise.all([
      supabase.from("problems")
        .select("id, problem_text, unit, sub_unit, difficulty")
        .eq("child_id", childId).eq("status", "active").limit(100),
      supabase.from("review_schedule")
        .select("problem_id, scheduled_for, status").eq("child_id", childId),
      supabase.from("weakness_map")
        .select("unit, sub_unit, accuracy_rate, mastery_level").eq("child_id", childId),
      supabase.from("attempts")
        .select("problem_id, mistake_type").eq("child_id", childId).limit(500),
      supabase.from("app_settings")
        .select("daily_limit_minutes").eq("child_id", childId).maybeSingle(),
    ]);

  const failed = [problemsResult, reviewsResult, weaknessResult, attemptsResult]
    .some(({ error }) => error);
  if (failed) return { error: true as const, problems: [] };

  const problems = problemsResult.data ?? [];
  const reviews = new Map(reviewsResult.data?.map((item) => [item.problem_id, item]));
  const weakness = new Map(weaknessResult.data?.map((item) => [
    `${item.unit}:${item.sub_unit}`,
    item,
  ]));
  const attempts = attemptsResult.data ?? [];
  const candidates = problems.map((problem) => {
    const stats = weakness.get(`${problem.unit}:${problem.sub_unit}`);
    const problemAttempts = attempts.filter((attempt) => attempt.problem_id === problem.id);
    return {
      id: problem.id,
      difficulty: problem.difficulty,
      estimatedMinutes: 3,
      isMastered: stats?.mastery_level === "mastered",
      matchesRecentMistake: problemAttempts.some((attempt) => Boolean(attempt.mistake_type)),
      review: reviews.get(problem.id),
      studyCount: problemAttempts.length,
      unit: problem.unit,
      weaknessAccuracyRate: stats?.accuracy_rate ?? null,
    };
  });
  const selected = recommendToday(candidates, {
    today,
    maxMinutes: settingsResult.data?.daily_limit_minutes ?? 15,
  });
  const byId = new Map(problems.map((problem) => [problem.id, problem]));

  return {
    error: false as const,
    problems: selected.flatMap((candidate) => {
      const problem = byId.get(candidate.id);
      return problem ? [{ ...problem, estimatedMinutes: candidate.estimatedMinutes }] : [];
    }),
  };
}

