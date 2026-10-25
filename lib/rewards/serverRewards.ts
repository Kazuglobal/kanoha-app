import { and, eq, gte, lt, max, sql } from "drizzle-orm";
import type { Database } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { jstDayRange, nowJstIso, todayKeyJst } from "@/lib/utils/date";
import { ANSWER_HINT_LEVEL } from "@/lib/utils/resources";
import type { EquippedAccessories } from "./catalog";
import {
  DEFAULT_REWARD_STATE,
  REWARD_CYCLE,
  YEN_PER_CYCLE,
  normalizeRewardState,
  parseEquippedJson,
  type RewardState,
} from "./rewardLogic";

/**
 * child_rewards の読み書き。所有確認は呼び出し側(requireOwnedChild)で済ませておくこと。
 */

export interface ChildRewards {
  reward: RewardState;
  equipped: EquippedAccessories;
  /** DB に行があるか(旧端末データの取り込みは行が無いときだけ許す) */
  stored: boolean;
}

const rewardColumns = {
  currentCycleCount: schema.childRewards.currentCycleCount,
  totalCorrectCount: schema.childRewards.totalCorrectCount,
  totalRewardYen: schema.childRewards.totalRewardYen,
  lastRewardEarnedAt: schema.childRewards.lastRewardEarnedAt,
  equippedAccessories: schema.childRewards.equippedAccessories,
};

type RewardRow = Pick<typeof schema.childRewards.$inferSelect, keyof typeof rewardColumns>;

const toChildRewards = (row: RewardRow | undefined): ChildRewards =>
  row
    ? { reward: normalizeRewardState(row), equipped: parseEquippedJson(row.equippedAccessories), stored: true }
    : { reward: DEFAULT_REWARD_STATE, equipped: parseEquippedJson(null), stored: false };

export async function loadChildRewards(db: Database, childId: string): Promise<ChildRewards> {
  const row = await db
    .select(rewardColumns)
    .from(schema.childRewards)
    .where(eq(schema.childRewards.childId, childId))
    .get();
  return toChildRewards(row);
}

/**
 * 1問正解を記録する。読み取り→書き込みの競合で数え落とさないよう、1 文の upsert で増やす。
 * SET 句の列参照は更新前の値を指す。
 */
export async function recordCorrectReward(db: Database, childId: string): Promise<RewardState> {
  const now = nowJstIso();
  const cycle = schema.childRewards.currentCycleCount;
  const reachesCycle = sql`${cycle} + 1 >= ${REWARD_CYCLE}`;
  const row = await db
    .insert(schema.childRewards)
    .values({ childId, currentCycleCount: 1, totalCorrectCount: 1, totalRewardYen: 0, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: schema.childRewards.childId,
      set: {
        currentCycleCount: sql`(${cycle} + 1) % ${REWARD_CYCLE}`,
        totalCorrectCount: sql`${schema.childRewards.totalCorrectCount} + 1`,
        totalRewardYen: sql`${schema.childRewards.totalRewardYen} + CASE WHEN ${reachesCycle} THEN ${YEN_PER_CYCLE} ELSE 0 END`,
        lastRewardEarnedAt: sql`CASE WHEN ${reachesCycle} THEN ${now} ELSE ${schema.childRewards.lastRewardEarnedAt} END`,
        updatedAt: now,
      },
    })
    .returning(rewardColumns)
    .get();
  return normalizeRewardState(row);
}

type ClaimKind = "english_talk" | "problem";

/**
 * 同じ対象のごほうびを 子ども×種類×対象×日(JST) につき1回だけ数える。
 * 請求の記録は主キーで原子的に取る(同時に来ても1回だけ)。数えられなかったときは記録を戻し、あとで数え直せるようにする。
 * すでに今日数えていれば null。
 */
async function claimOnceThenRecord(
  db: Database,
  childId: string,
  kind: ClaimKind,
  refId: string,
): Promise<RewardState | null> {
  const claimDate = todayKeyJst();
  const claimed = await db
    .insert(schema.rewardClaims)
    .values({ childId, kind, refId, claimDate, createdAt: nowJstIso() })
    .onConflictDoNothing()
    .returning({ childId: schema.rewardClaims.childId })
    .all();
  if (claimed.length === 0) return null;

  try {
    return await recordCorrectReward(db, childId);
  } catch (error) {
    await db
      .delete(schema.rewardClaims)
      .where(
        and(
          eq(schema.rewardClaims.childId, childId),
          eq(schema.rewardClaims.kind, kind),
          eq(schema.rewardClaims.refId, refId),
          eq(schema.rewardClaims.claimDate, claimDate),
        ),
      )
      .run()
      .catch(() => undefined);
    throw error;
  }
}

/** 英会話れんしゅうの1ターン正解(子ども×場面×ターン×日に1回)。 */
export const recordEnglishTalkClear = (
  db: Database,
  childId: string,
  sceneId: string,
  turnId: string,
): Promise<RewardState | null> => claimOnceThenRecord(db, childId, "english_talk", `${sceneId}:${turnId}`);

/** 今日(JST)、この子がこの問題で「答え」のヒントまで開いたか(どのセッションでも。やり直しで消えない)。 */
async function openedAnswerHintToday(
  db: Database,
  childId: string,
  problemId: string,
  hintLevelUsed: number,
): Promise<boolean> {
  if (hintLevelUsed >= ANSWER_HINT_LEVEL) return true;
  const { start, end } = jstDayRange();
  const row = await db
    .select({ level: max(schema.problemHintViews.maxLevel) })
    .from(schema.problemHintViews)
    .where(
      and(
        eq(schema.problemHintViews.childId, childId),
        eq(schema.problemHintViews.problemId, problemId),
        gte(schema.problemHintViews.updatedAt, start),
        lt(schema.problemHintViews.updatedAt, end),
      ),
    )
    .get();
  return Number(row?.level ?? 0) >= ANSWER_HINT_LEVEL;
}

/**
 * 元問題の正解をごほうびとして数える。
 * - 答えのヒント(最終段階)を見たあとの正解は対象外
 * - 同じ問題は1日(JST)に1回だけ。別の日の復習はあらためて対象になる
 * 対象外・すでに数えたときは null。
 */
export async function recordProblemReward(
  db: Database,
  childId: string,
  problemId: string,
  hintLevelUsed: number,
): Promise<RewardState | null> {
  if (await openedAnswerHintToday(db, childId, problemId, hintLevelUsed)) return null;
  return claimOnceThenRecord(db, childId, "problem", problemId);
}

export async function saveEquippedAccessories(
  db: Database,
  childId: string,
  equipped: EquippedAccessories,
): Promise<void> {
  const now = nowJstIso();
  const json = JSON.stringify(equipped);
  await db
    .insert(schema.childRewards)
    .values({ childId, equippedAccessories: json, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: schema.childRewards.childId, set: { equippedAccessories: json, updatedAt: now } })
    .run();
}

/**
 * 以前この端末の localStorage だけにあったごほうびを、1回だけ取り込む。
 * すでに行があれば何もしない(上書きで増やせないようにする)。
 */
export async function importLegacyRewards(
  db: Database,
  childId: string,
  reward: RewardState,
  equipped: EquippedAccessories,
): Promise<boolean> {
  const now = nowJstIso();
  const inserted = await db
    .insert(schema.childRewards)
    .values({
      childId,
      currentCycleCount: reward.currentCycleCount,
      totalCorrectCount: reward.totalCorrectCount,
      totalRewardYen: reward.totalRewardYen,
      lastRewardEarnedAt: reward.lastRewardEarnedAt ?? null,
      equippedAccessories: JSON.stringify(equipped),
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: schema.childRewards.childId })
    .returning({ childId: schema.childRewards.childId })
    .all();
  return inserted.length > 0;
}
