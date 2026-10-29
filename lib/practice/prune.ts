import { and, eq, isNotNull, lt, notExists, sql } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Database } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { todayKeyJst } from "@/lib/utils/date";

/** 解かれないまま、この日数をこえた自動生成の問題を整理する。 */
export const UNTOUCHED_RETENTION_DAYS = 7;
const DAY_MS = 86_400_000;

/**
 * 解かれないまま古くなった自動生成の問題(セットで作ったが 一度も開かれなかった問題)を消して、表が育ちすぎないようにする。
 * 消すのは、自動で作った問題(generator_ref あり)で、7 日より古く、
 * 解いた記録・復習の予定・ヒントを開いた記録・類題のどれも無いものだけ。ほかは 1 つも消さない。
 * 問題がなくなった古いセットも片づける。消した問題の数を返す。所有確認は呼び出し側で済ませておくこと。
 */
export async function pruneUntouchedGenerated(db: Database, childId: string, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - UNTOUCHED_RETENTION_DAYS * DAY_MS);
  const unreferenced = (table: SQLiteTable, column: SQLiteColumn) =>
    notExists(db.select({ one: sql`1` }).from(table).where(eq(column, schema.problems.id)));

  const deleted = await db
    .delete(schema.problems)
    .where(
      and(
        eq(schema.problems.childId, childId),
        isNotNull(schema.problems.generatorRef),
        lt(schema.problems.createdAt, cutoff.toISOString()),
        unreferenced(schema.attempts, schema.attempts.problemId),
        unreferenced(schema.reviewSchedule, schema.reviewSchedule.problemId),
        unreferenced(schema.problemHintViews, schema.problemHintViews.problemId),
        unreferenced(schema.generatedSimilarProblems, schema.generatedSimilarProblems.sourceProblemId),
      ),
    )
    .returning({ id: schema.problems.id })
    .all();

  await db
    .delete(schema.practiceBatches)
    .where(
      and(
        eq(schema.practiceBatches.childId, childId),
        lt(schema.practiceBatches.batchDate, todayKeyJst(cutoff)),
        notExists(db.select({ one: sql`1` }).from(schema.practiceBatchItems).where(eq(schema.practiceBatchItems.batchId, schema.practiceBatches.id))),
      ),
    )
    .run();

  return deleted.length;
}
