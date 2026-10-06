import { eq, and, desc, asc, gte, lt, inArray } from "drizzle-orm";
import { mistakeTypeSchema } from "@/lib/ai/schemas";
import { isAnyMistakeType } from "@/lib/curriculum/mistakeTypes";
import type { Subject } from "@/lib/curriculum/subjects";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
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

const ESTIMATED_MINUTES = 3;
const DEFAULT_LIMIT_MINUTES = 60;
const LIMITS = {
  attempts: 300,
  problems: 100,
  reviews: 200,
  sessionAttempts: 500,
  similar: 50,
  weakness: 100,
} as const;

interface ProblemRow {
  id: string;
  problem_text: string;
  unit: string;
  sub_unit: string;
  difficulty: RecommendationCandidate["difficulty"];
  subject: string;
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
    (attempt) =>
      !attempt.is_correct &&
      (mistakeTypeSchema.safeParse(attempt.mistake_type).success ||
        isAnyMistakeType(attempt.mistake_type ?? "")),
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
 */
export async function loadSessionUsage(
  childId: string,
  now: Date,
  db = getDb(),
): Promise<{ data: SessionUsage[]; error: boolean }> {
  try {
    const range = jstDayRange(now);
    const sessions = await db
      .select({
        id: schema.learningSessions.id,
        started_at: schema.learningSessions.startedAt,
        ended_at: schema.learningSessions.endedAt,
        duration_seconds: schema.learningSessions.durationSeconds,
      })
      .from(schema.learningSessions)
      .where(
        and(
          eq(schema.learningSessions.childId, childId),
          gte(schema.learningSessions.startedAt, range.start),
          lt(schema.learningSessions.startedAt, range.end),
        ),
      )
      .all();

    const rows = (sessions ?? []) as SessionRow[];
    const openIds = openSessionIds(rows);
    if (openIds.length === 0) return { data: withLastAttempts(rows, new Map()), error: false };

    const attempts = await db
      .select({
        session_id: schema.attempts.sessionId,
        created_at: schema.attempts.createdAt,
      })
      .from(schema.attempts)
      .where(
        and(eq(schema.attempts.childId, childId), inArray(schema.attempts.sessionId, openIds)),
      )
      .orderBy(desc(schema.attempts.createdAt))
      .limit(LIMITS.sessionAttempts)
      .all();

    const lastAttempts = lastAttemptBySession((attempts ?? []) as SessionAttemptRow[]);
    return { data: withLastAttempts(rows, lastAttempts), error: false };
  } catch {
    return { data: [], error: true };
  }
}

async function loadSources(childId: string, now: Date, db = getDb()) {
  try {
    const [
      problemsRows,
      reviewsRows,
      weaknessRows,
      attemptsRows,
      settingsRow,
      sessionsResult,
      similarRows,
    ] = await Promise.all([
      db
        .select({
          id: schema.problems.id,
          problem_text: schema.problems.problemText,
          unit: schema.problems.unit,
          sub_unit: schema.problems.subUnit,
          difficulty: schema.problems.difficulty,
          subject: schema.problems.subject,
        })
        .from(schema.problems)
        .where(and(eq(schema.problems.childId, childId), eq(schema.problems.status, "active")))
        .orderBy(desc(schema.problems.createdAt))
        .limit(LIMITS.problems)
        .all(),
      db
        .select({
          problem_id: schema.reviewSchedule.problemId,
          scheduled_for: schema.reviewSchedule.scheduledFor,
          status: schema.reviewSchedule.status,
        })
        .from(schema.reviewSchedule)
        .where(
          and(eq(schema.reviewSchedule.childId, childId), eq(schema.reviewSchedule.status, "pending")),
        )
        .orderBy(asc(schema.reviewSchedule.scheduledFor))
        .limit(LIMITS.reviews)
        .all(),
      db
        .select({
          unit: schema.weaknessMap.unit,
          sub_unit: schema.weaknessMap.subUnit,
          accuracy_rate: schema.weaknessMap.accuracyRate,
          mastery_level: schema.weaknessMap.masteryLevel,
        })
        .from(schema.weaknessMap)
        .where(eq(schema.weaknessMap.childId, childId))
        .orderBy(asc(schema.weaknessMap.accuracyRate))
        .limit(LIMITS.weakness)
        .all(),
      db
        .select({
          problem_id: schema.attempts.problemId,
          similar_problem_id: schema.attempts.similarProblemId,
          mistake_type: schema.attempts.mistakeType,
          is_correct: schema.attempts.isCorrect,
        })
        .from(schema.attempts)
        .where(eq(schema.attempts.childId, childId))
        .orderBy(desc(schema.attempts.createdAt))
        .limit(LIMITS.attempts)
        .all(),
      db
        .select({
          daily_limit_minutes: schema.appSettings.dailyLimitMinutes,
        })
        .from(schema.appSettings)
        .where(eq(schema.appSettings.childId, childId))
        .get(),
      loadSessionUsage(childId, now, db),
      db
        .select({
          id: schema.generatedSimilarProblems.id,
          source_problem_id: schema.generatedSimilarProblems.sourceProblemId,
          unit: schema.generatedSimilarProblems.unit,
          sub_unit: schema.generatedSimilarProblems.subUnit,
          difficulty: schema.generatedSimilarProblems.difficulty,
        })
        .from(schema.generatedSimilarProblems)
        .where(eq(schema.generatedSimilarProblems.childId, childId))
        .orderBy(desc(schema.generatedSimilarProblems.createdAt))
        .limit(LIMITS.similar)
        .all(),
    ]);

    return {
      problems: problemsRows.map((p) => ({
        ...p,
        difficulty: p.difficulty as RecommendationCandidate["difficulty"],
        subject: p.subject ?? "math",
      })),
      reviews: reviewsRows as ReviewRow[],
      weakness: weaknessRows as WeaknessRow[],
      attempts: attemptsRows.map((a) => ({ ...a, is_correct: Boolean(a.is_correct) })),
      dailyLimitMinutes: settingsRow?.daily_limit_minutes ?? DEFAULT_LIMIT_MINUTES,
      sessions: sessionsResult.data,
      similar: similarRows.map((s) => ({
        ...s,
        difficulty: s.difficulty as RecommendationCandidate["difficulty"],
      })) as SimilarRow[],
      error: false,
    };
  } catch {
    return {
      problems: [],
      reviews: [],
      weakness: [],
      attempts: [],
      dailyLimitMinutes: DEFAULT_LIMIT_MINUTES,
      sessions: [],
      similar: [],
      error: true,
    };
  }
}

export async function getTodayRecommendations(
  childId: string,
  now = new Date(),
  db = getDb(),
  subject?: Subject,
) {
  const today = todayKeyJst(now);
  const data = await loadSources(childId, now, db);
  if (data.error) return { error: true as const, problems: [], limitReached: false, remainingMinutes: 0 };

  const filteredProblems = subject
    ? data.problems.filter((p) => p.subject === subject)
    : data.problems;
  // もし指定教科の問題がなければ全体から推薦
  const finalProblems = filteredProblems.length > 0 ? filteredProblems : data.problems;

  const { similar, attempts, reviews: reviewList, weakness: weaknessList, dailyLimitMinutes, sessions } = data;
  const problems = finalProblems;
  const reviews = new Map(reviewList.map((item) => [item.problem_id, item]));
  const weakness = new Map(weaknessList.map((item) => [`${item.unit}:${item.sub_unit}`, item]));
  const byId = new Map(problems.map((problem) => [problem.id, problem]));
  const similarById = new Map(similar.map((item) => [item.id, item]));

  const recentMistake = findRecentMistake(attempts, (attempt) =>
    (attempt.problem_id ? byId.get(attempt.problem_id) : similarById.get(attempt.similar_problem_id ?? ""))?.unit,
  );
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

  const limit = dailyLimitFromSessions(dailyLimitMinutes, sessions, now);
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
