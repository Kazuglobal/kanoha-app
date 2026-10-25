import { and, eq, lt, sql } from "drizzle-orm";
import { getDb } from "./index";
import * as schema from "./schema";
import { todayKeyJst, nowJstIso } from "@/lib/utils/date";
import { type MasteryLevel } from "@/lib/review/weakness";

const COST_DECIMALS = 4;

/**
 * AI利用量のアトミック予約(ユーザーごと・日(JST)ごと)。
 * 「枠内なら加算」を1文の upsert で行うので、同時に来ても上限を超えて通さない。
 * 枠を超えるときは何も記録せず、そのときの利用量を返す。
 */
export const incrementAiUsage = async (
  userId: string,
  costUsd: number,
  callLimit: number,
  costLimit: number,
  db = getDb(),
): Promise<{ allowed: boolean; calls: number; costUsd: number }> => {
  const today = todayKeyJst();
  const usage = schema.aiDailyUsage;
  const current = async () => {
    const row = await db
      .select({ calls: usage.calls, costUsd: usage.costUsd })
      .from(usage)
      .where(and(eq(usage.userId, userId), eq(usage.usageDate, today)))
      .get();
    return { calls: row?.calls ?? 0, costUsd: row?.costUsd ?? 0 };
  };

  // 1回目から枠を超える(上限が0・1回の費用が上限より大きい)ときは、行も作らない
  if (callLimit < 1 || costUsd > costLimit) return { allowed: false, ...(await current()) };

  const now = nowJstIso();
  const nextCost = sql`round(${usage.costUsd} + ${costUsd}, ${sql.raw(String(COST_DECIMALS))})`;
  const row = await db
    .insert(usage)
    .values({ id: crypto.randomUUID(), userId, usageDate: today, calls: 1, costUsd, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [usage.userId, usage.usageDate],
      set: { calls: sql`${usage.calls} + 1`, costUsd: nextCost, updatedAt: now },
      setWhere: sql`${usage.calls} + 1 <= ${callLimit} AND ${nextCost} <= ${costLimit}`,
    })
    .returning({ calls: usage.calls, costUsd: usage.costUsd })
    .get();

  return row ? { allowed: true, calls: row.calls, costUsd: row.costUsd } : { allowed: false, ...(await current()) };
};

/**
 * 1日分の「予算」(整数の単位)を原子的に予約する。key ごとに合計を持ち、合計が limit に収まるときだけ加算する。
 * 呼び出し側が key に日付を含めて、日ごとに新しい予算にする。収まらないときは何も記録せず false。
 */
export const reserveDailyBudget = async (
  key: string,
  amount: number,
  limit: number,
  db = getDb(),
): Promise<boolean> => {
  if (!Number.isInteger(amount) || amount < 0 || amount > limit) return false;
  const budget = schema.rateLimits;
  const row = await db
    .insert(budget)
    .values({ id: crypto.randomUUID(), limiterKey: key, action: "budget", windowStart: new Date().toISOString(), callCount: amount })
    .onConflictDoUpdate({
      target: budget.limiterKey,
      set: { callCount: sql`${budget.callCount} + ${amount}` },
      setWhere: sql`${budget.callCount} + ${amount} <= ${limit}`,
    })
    .returning({ total: budget.callCount })
    .get();
  return row !== undefined;
};

/** 窓が終わってからこの時間(ミリ秒)を過ぎたレート制限の行は消してよい。 */
const STALE_RATE_LIMIT_MS = 2 * 86_400_000;
/** 掃除は毎回やらず、おおよそこの回数に1回だけ行う。 */
const PURGE_EVERY = 100;

export const purgeStaleRateLimits = async (db = getDb(), olderThanMs = STALE_RATE_LIMIT_MS): Promise<void> => {
  const boundary = new Date(Date.now() - olderThanMs).toISOString();
  await db.delete(schema.rateLimits).where(lt(schema.rateLimits.windowStart, boundary)).run();
};

/**
 * DBベースのレート制限。limiter_key ごとに1行を原子的に upsert して数える
 * (窓が終わっていれば 1 から数え直す)ので、同時に来ても上限を超えて通さない。
 */
export const checkDbRateLimit = async (
  key: string,
  limit: number,
  windowSeconds: number,
  db = getDb(),
): Promise<boolean> => {
  const limits = schema.rateLimits;
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const boundary = new Date(now - windowSeconds * 1000).toISOString();
  const expired = sql`${limits.windowStart} <= ${boundary}`;

  const row = await db
    .insert(limits)
    .values({ id: crypto.randomUUID(), limiterKey: key, action: "api", windowStart: nowIso, callCount: 1 })
    .onConflictDoUpdate({
      target: limits.limiterKey,
      set: {
        callCount: sql`CASE WHEN ${expired} THEN 1 ELSE ${limits.callCount} + 1 END`,
        windowStart: sql`CASE WHEN ${expired} THEN ${nowIso} ELSE ${limits.windowStart} END`,
      },
    })
    .returning({ callCount: limits.callCount })
    .get();

  if (Math.random() * PURGE_EVERY < 1) await purgeStaleRateLimits(db).catch(() => undefined);
  return row.callCount <= limit;
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
