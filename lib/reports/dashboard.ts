import type { SupabaseClient } from "@supabase/supabase-js";
import { jstDayRange, toJstDateKey } from "@/lib/utils/date";

export interface DashboardSession {
  started_at: string;
  duration_seconds: number;
}

export interface DashboardAttempt {
  created_at: string;
  hint_level_used: number;
  is_correct: boolean;
  mistake_type: string | null;
  problem_id: string | null;
  similar_problem_id: string | null;
}

export interface DashboardProblem {
  id: string;
  problem_text: string;
  unit: string;
}

export interface DashboardWeakness {
  accuracy_rate: number;
  mastery_level: string;
  mistake_count: number;
  sub_unit: string;
  unit: string;
}

export interface DashboardReview {
  problem_id: string;
  scheduled_for: string;
  status: string;
  sub_unit: string;
  unit: string;
}

export interface DashboardInput {
  attempts: readonly DashboardAttempt[];
  now?: Date;
  problems: readonly DashboardProblem[];
  reviews: readonly DashboardReview[];
  sessions: readonly DashboardSession[];
  similarProblems: readonly DashboardProblem[];
  weaknesses: readonly DashboardWeakness[];
}

const mistakeLabels: Record<string, string> = {
  calculation_error: "計算まちがい",
  place_value_error: "位の取り違え",
  carry_error: "くり上がり",
  borrow_error: "くり下がり",
  operation_choice_error: "式の選び方",
  unit_conversion_error: "単位の変換",
  reading_comprehension_error: "問題文の読み取り",
  multiplication_fact_error: "九九",
  time_error: "時こくと時間",
  geometry_error: "図形",
  careless_error: "見直し",
  unanswered: "未回答",
  other: "その他",
};

const dateKey = (date: Date) => toJstDateKey(date);

const startOfDay = (date: Date) => new Date(jstDayRange(date).start);

export function buildDashboard(input: DashboardInput) {
  const now = input.now ?? new Date();
  const today = dateKey(now);
  const weekStart = new Date(startOfDay(now).getTime() - 6 * 86_400_000);
  const problemById = new Map([
    ...input.problems.map((problem) => [problem.id, problem] as const),
    ...input.similarProblems.map((problem) => [problem.id, problem] as const),
  ]);
  const todayAttempts = input.attempts.filter((attempt) => dateKey(new Date(attempt.created_at)) === today);
  const correctToday = todayAttempts.filter(({ is_correct }) => is_correct).length;
  const todaySessions = input.sessions.filter((session) => dateKey(new Date(session.started_at)) === today);
  const recentAttempts = input.attempts.filter((attempt) => new Date(attempt.created_at) >= weekStart);
  const previousAttempts = input.attempts.filter((attempt) => {
    const created = new Date(attempt.created_at);
    return created < weekStart && created >= new Date(weekStart.getTime() - 7 * 86_400_000);
  });
  const accuracy = (attempts: readonly DashboardAttempt[]) =>
    attempts.length ? attempts.filter(({ is_correct }) => is_correct).length / attempts.length : 0;

  const mistakeCounts = todayAttempts.reduce<Record<string, number>>((counts, attempt) => {
    if (!attempt.mistake_type) return counts;
    return { ...counts, [attempt.mistake_type]: (counts[attempt.mistake_type] ?? 0) + 1 };
  }, {});
  const commonMistake = Object.entries(mistakeCounts).sort((left, right) => right[1] - left[1])[0]?.[0];
  const dueReview = [...input.reviews]
    .filter(({ status }) => status === "pending")
    .sort((left, right) => left.scheduled_for.localeCompare(right.scheduled_for))[0];

  return {
    accuracyRate: todayAttempts.length ? correctToday / todayAttempts.length : 0,
    commonMistake: commonMistake ? mistakeLabels[commonMistake] ?? commonMistake : "まだ傾向はありません",
    dueReview: dueReview ? {
      date: dueReview.scheduled_for,
      label: [dueReview.unit, dueReview.sub_unit].filter(Boolean).join(" · "),
    } : null,
    growth: {
      currentAccuracy: accuracy(recentAttempts),
      masteredUnits: input.weaknesses.filter(({ mastery_level }) => mastery_level === "mastered").length,
      previousAccuracy: accuracy(previousAttempts),
    },
    streakDays: calculateStreak(input.sessions, now),
    studyMinutes: Math.round(todaySessions.reduce((sum, session) => sum + session.duration_seconds, 0) / 60),
    todayAttempts: todayAttempts.map((attempt) => {
      const resource = problemById.get(attempt.problem_id ?? attempt.similar_problem_id ?? "");
      return {
        hintLevel: attempt.hint_level_used,
        isCorrect: attempt.is_correct,
        question: resource?.problem_text ?? "学習した問題",
        unit: resource?.unit ?? "",
      };
    }),
    todayQuestionCount: todayAttempts.length,
    weaknesses: [...input.weaknesses]
      .filter(({ mastery_level }) => mastery_level !== "mastered")
      .sort((left, right) => left.accuracy_rate - right.accuracy_rate)
      .slice(0, 3),
  };
}

function calculateStreak(sessions: readonly DashboardSession[], now: Date) {
  const activeDays = new Set(sessions.map((session) => dateKey(new Date(session.started_at))));
  let cursor = startOfDay(now);
  if (!activeDays.has(dateKey(cursor))) cursor = new Date(cursor.getTime() - 86_400_000);

  let streak = 0;
  while (activeDays.has(dateKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 86_400_000);
  }
  return streak;
}

const uniqueIds = (
  attempts: readonly DashboardAttempt[],
  key: "problem_id" | "similar_problem_id",
): readonly string[] =>
  [...new Set(attempts.flatMap((attempt) => (attempt[key] ? [attempt[key] as string] : [])))];

async function loadReferencedProblems(supabase: SupabaseClient, attempts: readonly DashboardAttempt[]) {
  const problemIds = uniqueIds(attempts, "problem_id");
  const similarIds = uniqueIds(attempts, "similar_problem_id");
  const empty = { data: [] as DashboardProblem[], error: null };
  const [problems, similar] = await Promise.all([
    problemIds.length
      ? supabase.from("problems").select("id, problem_text, unit").in("id", problemIds)
      : Promise.resolve(empty),
    similarIds.length
      ? supabase.from("generated_similar_problems").select("id, problem_text, unit").in("id", similarIds)
      : Promise.resolve(empty),
  ]);
  if (problems.error || similar.error) return null;
  return { problems: problems.data ?? [], similarProblems: similar.data ?? [] };
}

/** 親ダッシュボードと日次レポート(reports/slack)で共有する読み込み。 */
export async function loadDashboardInput(
  supabase: SupabaseClient,
  childId: string,
): Promise<DashboardInput | null> {
  const [sessions, attempts, weaknesses, reviews] = await Promise.all([
    supabase.from("learning_sessions")
      .select("started_at, duration_seconds")
      .eq("child_id", childId).order("started_at", { ascending: false }).limit(90),
    supabase.from("attempts")
      .select("created_at, hint_level_used, is_correct, mistake_type, problem_id, similar_problem_id")
      .eq("child_id", childId).order("created_at", { ascending: false }).limit(500),
    supabase.from("weakness_map")
      .select("unit, sub_unit, accuracy_rate, mistake_count, mastery_level")
      .eq("child_id", childId),
    supabase.from("review_schedule")
      .select("problem_id, unit, sub_unit, scheduled_for, status")
      .eq("child_id", childId),
  ]);
  if (sessions.error || attempts.error || weaknesses.error || reviews.error) return null;
  const referenced = await loadReferencedProblems(supabase, attempts.data ?? []);
  if (!referenced) return null;
  return {
    attempts: attempts.data ?? [],
    problems: referenced.problems,
    reviews: reviews.data ?? [],
    sessions: sessions.data ?? [],
    similarProblems: referenced.similarProblems,
    weaknesses: weaknesses.data ?? [],
  };
}
