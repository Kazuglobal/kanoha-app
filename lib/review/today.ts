import type { createClient } from "@/lib/supabase/server";
import { mistakeTypeSchema } from "@/lib/ai/schemas";
import { recommendToday, type RecommendationCandidate } from "@/lib/review/recommend";
import {
  dailyLimitFromSessions,
  lastAttemptBySession,
  openSessionIds,
  withLastAttempts,
  type SessionRow,
  type SessionUsage,
} from "@/lib/sessions/dailyLimit";
import { jstDayRange, todayKeyJst } from "@/lib/utils/date";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const ESTIMATED_MINUTES = 3;
const DEFAULT_LIMIT_MINUTES = 15;
const LIMITS = {
  attempts: 300, problems: 100, reviews: 200, sessionAttempts: 500, similar: 50, weakness: 100,
} as const;

interface ProblemRow {
  id: string;
  problem_text: string;
  unit: string;
  sub_unit: string;
  difficulty: RecommendationCandidate["difficulty"];
}

interface SimilarRow {
  id: string;
  source_problem_id: string;
  unit: string;
  sub_unit: string;
  difficulty: RecommendationCandidate["difficulty"];
}

interface AttemptRow {
  problem_id: string | null;
  similar_problem_id: string | null;
  mistake_type: string | null;
  is_correct: boolean;
}

interface WeaknessRow {
  unit: string;
  sub_unit: string;
  accuracy_rate: number;
  mastery_level: string;
}

interface ReviewRow {
  problem_id: string;
  scheduled_for: string;
  status: string;
}

/** 直近の attempts(新しい順)から、最後に付いた間違え方とその単元を求める(doc.md §12.3 項目3)。 */
export const findRecentMistake = (
  attempts: readonly AttemptRow[],
  unitOf: (attempt: AttemptRow) => string | undefined,
): { mistakeType: string; unit: string } | null => {
  const recent = attempts.find(
    (attempt) => !attempt.is_correct && mistakeTypeSchema.safeParse(attempt.mistake_type).success,
  );
  const unit = recent ? unitOf(recent) : undefined;
  return recent && unit ? { mistakeType: recent.mistake_type as string, unit } : null;
};

interface SessionAttemptRow {
  session_id: string;
  created_at: string;
}

/**
 * 当日(Asia/Tokyo)の learning_sessions に、未終了セッションの最終 attempt 時刻を付けて返す。
 * 放置された未終了セッションを猶予つきで打ち切るための入力(lib/sessions/dailyLimit.ts)。
 * /api/sessions と今日のおすすめの共通経路。
 */
export async function loadSessionUsage(
  supabase: Supabase,
  childId: string,
  now: Date,
): Promise<{ data: SessionUsage[]; error: boolean }> {
  const range = jstDayRange(now);
  const sessions = await supabase.from("learning_sessions")
    .select("id, started_at, ended_at, duration_seconds")
    .eq("child_id", childId).gte("started_at", range.start).lt("started_at", range.end);
  if (sessions.error) return { data: [], error: true };
  const rows = (sessions.data ?? []) as SessionRow[];
  const openIds = openSessionIds(rows);
  if (openIds.length === 0) return { data: withLastAttempts(rows, new Map()), error: false };

  const attempts = await supabase.from("attempts").select("session_id, created_at")
    .eq("child_id", childId).in("session_id", openIds)
    .order("created_at", { ascending: false }).limit(LIMITS.sessionAttempts);
  if (attempts.error) return { data: [], error: true };
  const lastAttempts = lastAttemptBySession((attempts.data ?? []) as SessionAttemptRow[]);
  return { data: withLastAttempts(rows, lastAttempts), error: false };
}

async function loadSources(supabase: Supabase, childId: string, now: Date) {
  return Promise.all([
    supabase.from("problems").select("id, problem_text, unit, sub_unit, difficulty")
      .eq("child_id", childId).eq("status", "active")
      .order("created_at", { ascending: false }).limit(LIMITS.problems),
    supabase.from("review_schedule").select("problem_id, scheduled_for, status")
      .eq("child_id", childId).eq("status", "pending")
      .order("scheduled_for", { ascending: true }).limit(LIMITS.reviews),
    supabase.from("weakness_map").select("unit, sub_unit, accuracy_rate, mastery_level")
      .eq("child_id", childId).order("accuracy_rate", { ascending: true }).limit(LIMITS.weakness),
    supabase.from("attempts").select("problem_id, similar_problem_id, mistake_type, is_correct")
      .eq("child_id", childId).order("created_at", { ascending: false }).limit(LIMITS.attempts),
    supabase.from("app_settings").select("daily_limit_minutes").eq("child_id", childId).maybeSingle(),
    loadSessionUsage(supabase, childId, now),
    supabase.from("generated_similar_problems").select("id, source_problem_id, unit, sub_unit, difficulty")
      .eq("child_id", childId).order("created_at", { ascending: false }).limit(LIMITS.similar),
  ]);
}

export async function getTodayRecommendations(supabase: Supabase, childId: string, now = new Date()) {
  const today = todayKeyJst(now);
  const [problemsResult, reviewsResult, weaknessResult, attemptsResult, settingsResult, sessionsResult, similarResult] =
    await loadSources(supabase, childId, now);
  const failed = [problemsResult, reviewsResult, weaknessResult, attemptsResult, sessionsResult, similarResult]
    .some(({ error }) => error);
  if (failed) return { error: true as const, problems: [], limitReached: false, remainingMinutes: 0 };

  const problems = (problemsResult.data ?? []) as ProblemRow[];
  const similar = (similarResult.data ?? []) as SimilarRow[];
  const attempts = (attemptsResult.data ?? []) as AttemptRow[];
  const reviews = new Map(((reviewsResult.data ?? []) as ReviewRow[]).map((item) => [item.problem_id, item]));
  const weakness = new Map(((weaknessResult.data ?? []) as WeaknessRow[])
    .map((item) => [`${item.unit}:${item.sub_unit}`, item]));
  const byId = new Map(problems.map((problem) => [problem.id, problem]));
  const similarById = new Map(similar.map((item) => [item.id, item]));

  const recentMistake = findRecentMistake(attempts, (attempt) =>
    (attempt.problem_id ? byId.get(attempt.problem_id) : similarById.get(attempt.similar_problem_id ?? ""))?.unit);
  const attemptsFor = (key: "problem_id" | "similar_problem_id", id: string) =>
    attempts.filter((attempt) => attempt[key] === id);
  const stats = (unit: string, subUnit: string) => weakness.get(`${unit}:${subUnit}`);

  const problemCandidates: RecommendationCandidate[] = problems.map((problem) => ({
    id: problem.id,
    difficulty: problem.difficulty,
    estimatedMinutes: ESTIMATED_MINUTES,
    isMastered: stats(problem.unit, problem.sub_unit)?.mastery_level === "mastered",
    matchesRecentMistake: recentMistake?.unit === problem.unit,
    review: reviews.get(problem.id),
    studyCount: attemptsFor("problem_id", problem.id).length,
    unit: problem.unit,
    weaknessAccuracyRate: stats(problem.unit, problem.sub_unit)?.accuracy_rate ?? null,
  }));
  const similarCandidates: RecommendationCandidate[] = similar
    .filter((item) => recentMistake?.unit === item.unit && byId.has(item.source_problem_id))
    .map((item) => ({
      id: item.id,
      sourceProblemId: item.source_problem_id,
      difficulty: item.difficulty,
      estimatedMinutes: ESTIMATED_MINUTES,
      isMastered: stats(item.unit, item.sub_unit)?.mastery_level === "mastered",
      matchesRecentMistake: true,
      studyCount: attemptsFor("similar_problem_id", item.id).length,
      unit: item.unit,
      weaknessAccuracyRate: stats(item.unit, item.sub_unit)?.accuracy_rate ?? null,
    }));

  const limit = dailyLimitFromSessions(
    settingsResult.data?.daily_limit_minutes ?? DEFAULT_LIMIT_MINUTES,
    sessionsResult.data,
    now,
  );
  const selected = recommendToday([...problemCandidates, ...similarCandidates], {
    today,
    maxMinutes: limit.remainingMinutes,
  });

  return {
    error: false as const,
    limitReached: limit.limitReached,
    remainingMinutes: limit.remainingMinutes,
    problems: dedupeByProblem(selected, byId),
  };
}

/** 類題候補は子どもが開ける元問題に解決し、同じ問題は最初の1件だけ残す。 */
const dedupeByProblem = (
  selected: readonly RecommendationCandidate[],
  byId: ReadonlyMap<string, ProblemRow>,
) =>
  selected.reduce<(ProblemRow & { estimatedMinutes: number })[]>((list, candidate) => {
    const problem = byId.get(candidate.sourceProblemId ?? candidate.id);
    if (!problem || list.some((item) => item.id === problem.id)) return list;
    return [...list, { ...problem, estimatedMinutes: candidate.estimatedMinutes }];
  }, []);
