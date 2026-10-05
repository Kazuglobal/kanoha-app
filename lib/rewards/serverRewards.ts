import { eq, sql } from "drizzle-orm";
import type { Database } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { nowJstIso } from "@/lib/utils/date";
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
