import { eq, sql } from "drizzle-orm";
import type { Database } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { nowJstIso } from "@/lib/utils/date";
import type { SceneStars } from "./score";

/**
 * 英会話(えいごで おはなし)の場面ごとの進み具合の読み書き(サーバー側)。所有確認は呼び出し側で済ませておくこと。
 * 保存するのは 場面・最高の★・クリアした回数・日時だけ(話した言葉は保存しない)。
 */

export interface SceneClear {
  readonly bestStars: SceneStars;
  readonly clearCount: number;
}

const asStars = (value: number): SceneStars => (value >= 3 ? 3 : value <= 1 ? 1 : 2);

/**
 * 場面のクリアを記録する。最高の★は下がらず、回数は 1 増える(読んで足して書くのでなく、1 文の upsert)。
 * runId は 1 回の挑戦の ID。返事が失われて同じ挑戦が再送されても(直前に記録した挑戦と同じ ID なら)回数は増やさない。
 */
export async function recordSceneClear(
  db: Database,
  childId: string,
  sceneId: string,
  stars: SceneStars,
  runId: string,
  now: Date = new Date(),
): Promise<SceneClear> {
  const table = schema.englishTalkProgress;
  const row = await db
    .insert(table)
    .values({ childId, sceneId, bestStars: stars, clearCount: 1, lastClearedAt: nowJstIso(now), lastRunId: runId })
    .onConflictDoUpdate({
      target: [table.childId, table.sceneId],
      set: {
        bestStars: sql`MAX(${table.bestStars}, ${stars})`,
        clearCount: sql`CASE WHEN ${table.lastRunId} = ${runId} THEN ${table.clearCount} ELSE ${table.clearCount} + 1 END`,
        lastClearedAt: nowJstIso(now),
        lastRunId: runId,
      },
    })
    .returning({ bestStars: table.bestStars, clearCount: table.clearCount })
    .get();
  return { bestStars: asStars(row.bestStars), clearCount: row.clearCount };
}

/** 子どもの場面ごとの進み具合(場面 id → 最高の★と回数)。 */
export async function loadTalkProgress(db: Database, childId: string): Promise<Readonly<Record<string, SceneClear>>> {
  const rows = await db
    .select({ sceneId: schema.englishTalkProgress.sceneId, bestStars: schema.englishTalkProgress.bestStars, clearCount: schema.englishTalkProgress.clearCount })
    .from(schema.englishTalkProgress)
    .where(eq(schema.englishTalkProgress.childId, childId))
    .all();
  return Object.fromEntries(rows.map((row) => [row.sceneId, { bestStars: asStars(row.bestStars), clearCount: row.clearCount }]));
}
