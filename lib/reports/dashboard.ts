import { eq, desc, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
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

const uniqueIds = (attempts: readonly DashboardAttempt[], key: "problem_id" | "similar_problem_id") =>
  Array.from(new Set(attempts.map((a) => a[key]).filter((id): id is string => Boolean(id))));

async function loadReferencedProblems(attempts: readonly DashboardAttempt[], db = getDb()) {
  const problemIds = uniqueIds(attempts, "problem_id");
  const similarIds = uniqueIds(attempts, "similar_problem_id");

  const [problemsRows, similarRows] = await Promise.all([
    problemIds.length > 0
      ? db
          .select({
            id: schema.problems.id,
            problem_text: schema.problems.problemText,
            unit: schema.problems.unit,
          })
          .from(schema.problems)
          .where(inArray(schema.problems.id, problemIds))
          .all()
      : Promise.resolve([]),
    similarIds.length > 0
      ? db
          .select({
            id: schema.generatedSimilarProblems.id,
            problem_text: schema.generatedSimilarProblems.problemText,
            unit: schema.generatedSimilarProblems.unit,
          })
          .from(schema.generatedSimilarProblems)
          .where(inArray(schema.generatedSimilarProblems.id, similarIds))
          .all()
      : Promise.resolve([]),
  ]);

  return {
    problems: problemsRows,
    similarProblems: similarRows,
  };
}

/** 親ダッシュボードと日次レポート(reports/slack)で共有する読み込み。 */
export async function loadDashboardInput(
  childId: string,
  db = getDb(),
): Promise<DashboardInput | null> {
  try {
    const [sessionsRows, attemptsRows, weaknessesRows, reviewsRows] = await Promise.all([
      db
        .select({
          started_at: schema.learningSessions.startedAt,
          duration_seconds: schema.learningSessions.durationSeconds,
        })
        .from(schema.learningSessions)
        .where(eq(schema.learningSessions.childId, childId))
        .orderBy(desc(schema.learningSessions.startedAt))
        .limit(90)
        .all(),
      db
        .select({
          created_at: schema.attempts.createdAt,
          hint_level_used: schema.attempts.hintLevelUsed,
          is_correct: schema.attempts.isCorrect,
          mistake_type: schema.attempts.mistakeType,
          problem_id: schema.attempts.problemId,
          similar_problem_id: schema.attempts.similarProblemId,
        })
        .from(schema.attempts)
        .where(eq(schema.attempts.childId, childId))
        .orderBy(desc(schema.attempts.createdAt))
        .limit(500)
        .all(),
      db
        .select({
          unit: schema.weaknessMap.unit,
          sub_unit: schema.weaknessMap.subUnit,
          accuracy_rate: schema.weaknessMap.accuracyRate,
          mistake_count: schema.weaknessMap.mistakeCount,
          mastery_level: schema.weaknessMap.masteryLevel,
        })
        .from(schema.weaknessMap)
        .where(eq(schema.weaknessMap.childId, childId))
        .all(),
      db
        .select({
          problem_id: schema.reviewSchedule.problemId,
          unit: schema.reviewSchedule.unit,
          sub_unit: schema.reviewSchedule.subUnit,
          scheduled_for: schema.reviewSchedule.scheduledFor,
          status: schema.reviewSchedule.status,
        })
        .from(schema.reviewSchedule)
        .where(eq(schema.reviewSchedule.childId, childId))
        .all(),
    ]);

    const mappedAttempts: DashboardAttempt[] = (attemptsRows ?? []).map((a) => ({
      ...a,
      is_correct: Boolean(a.is_correct),
    }));

    const referenced = await loadReferencedProblems(mappedAttempts, db);

    return {
      attempts: mappedAttempts,
      problems: referenced.problems,
      reviews: reviewsRows ?? [],
      sessions: sessionsRows ?? [],
      similarProblems: referenced.similarProblems,
      weaknesses: weaknessesRows ?? [],
    };
  } catch {
    return null;
  }
}
