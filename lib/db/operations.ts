import { eq, and, sql, desc } from "drizzle-orm";
import { getDb } from "./index";
import * as schema from "./schema";
import { todayKeyJst, nowJstIso } from "@/lib/utils/date";
import { updateWeakness, type MasteryLevel } from "@/lib/review/weakness";

/**
 * AI利用量のアトミック予約 (旧 increment_ai_usage RPC)
 */
export const incrementAiUsage = async (
  userId: string,
  costUsd: number,
  callLimit: number,
  costLimit: number,
  db = getDb(),
): Promise<{ allowed: boolean; calls: number; costUsd: number }> => {
  const today = todayKeyJst();
  const existing = await db
    .select()
    .from(schema.aiDailyUsage)
    .where(eq(schema.aiDailyUsage.usageDate, today))
    .get();

  const currentCalls = existing?.calls ?? 0;
  const currentCost = existing?.costUsd ?? 0;

  const nextCalls = currentCalls + 1;
  const nextCost = Math.round((currentCost + costUsd) * 10_000) / 10_000;

  if (nextCalls > callLimit || nextCost > costLimit) {
    return {
      allowed: false,
      calls: currentCalls,
      costUsd: currentCost,
    };
  }

  const now = nowJstIso();
  if (existing) {
    await db
      .update(schema.aiDailyUsage)
      .set({
        calls: nextCalls,
        costUsd: nextCost,
        updatedAt: now,
      })
      .where(eq(schema.aiDailyUsage.id, existing.id))
      .run();
  } else {
    await db
      .insert(schema.aiDailyUsage)
      .values({
        id: crypto.randomUUID(),
        usageDate: today,
        calls: nextCalls,
        costUsd: nextCost,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }

  return {
    allowed: true,
    calls: nextCalls,
    costUsd: nextCost,
  };
};

/**
 * DBベースのレート制限 (旧 check_rate_limit RPC)
 */
export const checkDbRateLimit = async (
  key: string,
  limit: number,
  windowSeconds: number,
  db = getDb(),
): Promise<boolean> => {
  const now = Date.now();
  const windowBoundary = new Date(now - windowSeconds * 1000).toISOString();

  const existing = await db
    .select()
    .from(schema.rateLimits)
    .where(eq(schema.rateLimits.limiterKey, key))
    .get();

  const nowIso = new Date(now).toISOString();

  if (!existing || existing.windowStart <= windowBoundary) {
    // リセットまたは初回
    if (existing) {
      await db
        .update(schema.rateLimits)
        .set({
          callCount: 1,
          windowStart: nowIso,
        })
        .where(eq(schema.rateLimits.id, existing.id))
        .run();
    } else {
      await db
        .insert(schema.rateLimits)
        .values({
          id: crypto.randomUUID(),
          limiterKey: key,
          action: "api",
          windowStart: nowIso,
          callCount: 1,
        })
        .run();
    }
    return 1 <= limit;
  }

  const nextCount = existing.callCount + 1;
  await db
    .update(schema.rateLimits)
    .set({
      callCount: nextCount,
    })
    .where(eq(schema.rateLimits.id, existing.id))
    .run();

  return nextCount <= limit;
};

/**
 * 苦手単元マップの再集計 (旧 recompute_weakness RPC)
 */
export const recomputeWeakness = async (
  childId: string,
  targetUnit: string,
  targetSubUnit: string,
  db = getDb(),
): Promise<{
  attemptCount: number;
  correctCount: number;
  mistakeCount: number;
  accuracyRate: number;
  masteryLevel: MasteryLevel;
}> => {
  // 当該単元に属する attempts を収集
  const rawAttempts = await db
    .select({
      isCorrect: schema.attempts.isCorrect,
      createdAt: schema.attempts.createdAt,
      problemUnit: schema.problems.unit,
      problemSubUnit: schema.problems.subUnit,
      similarUnit: schema.generatedSimilarProblems.unit,
      similarSubUnit: schema.generatedSimilarProblems.subUnit,
    })
    .from(schema.attempts)
    .leftJoin(schema.problems, eq(schema.attempts.problemId, schema.problems.id))
    .leftJoin(
      schema.generatedSimilarProblems,
      eq(schema.attempts.similarProblemId, schema.generatedSimilarProblems.id),
    )
    .where(eq(schema.attempts.childId, childId))
    .all();

  const matched = rawAttempts.filter((a) => {
    const unit = a.problemUnit || a.similarUnit;
    const subUnit = a.problemSubUnit || a.similarSubUnit;
    return unit === targetUnit && subUnit === targetSubUnit;
  });

  const attemptCount = matched.length;
  const correctCount = matched.filter((a) => a.isCorrect === 1).length;
  const mistakeCount = attemptCount - correctCount;
  const accuracyRate =
    attemptCount > 0 ? Math.round((correctCount / attemptCount) * 10_000) / 10_000 : 0;

  // 既存の mastery を取得（sticky判定用）
  const existingMap = await db
    .select()
    .from(schema.weaknessMap)
    .where(
      and(
        eq(schema.weaknessMap.childId, childId),
        eq(schema.weaknessMap.unit, targetUnit),
        eq(schema.weaknessMap.subUnit, targetSubUnit),
      ),
    )
    .get();

  let masteryLevel: MasteryLevel = "learning";
  if (existingMap?.masteryLevel === "mastered") {
    masteryLevel = "mastered";
  } else if (attemptCount >= 5 && accuracyRate >= 0.8) {
    masteryLevel = "mastered";
  } else if (correctCount > 0) {
    masteryLevel = "reviewing";
  }

  const lastAttemptedAt = matched.length > 0 ? matched[matched.length - 1].createdAt : null;
  const now = nowJstIso();

  if (existingMap) {
    await db
      .update(schema.weaknessMap)
      .set({
        accuracyRate,
        mistakeCount,
        lastAttemptedAt,
        masteryLevel,
        updatedAt: now,
      })
      .where(eq(schema.weaknessMap.id, existingMap.id))
      .run();
  } else {
    await db
      .insert(schema.weaknessMap)
      .values({
        id: crypto.randomUUID(),
        childId,
        unit: targetUnit,
        subUnit: targetSubUnit,
        accuracyRate,
        mistakeCount,
        lastAttemptedAt,
        masteryLevel,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }

  return {
    attemptCount,
    correctCount,
    mistakeCount,
    accuracyRate,
    masteryLevel,
  };
};
