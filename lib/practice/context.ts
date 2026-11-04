import { and, asc, desc, eq } from "drizzle-orm";
import { isSubject, type Subject } from "@/lib/curriculum/subjects";
import type { Database } from "@/lib/db";
import * as schema from "@/lib/db/schema";

/** 問題画面に出す「あたらしい もんだい」のセットの中の位置と、つぎの問題。 */
export interface PracticeSetContext {
  readonly batchId: string;
  readonly subject: Subject;
  /** セットの何問目か(1 から) */
  readonly position: number;
  readonly total: number;
  readonly nextProblemId: string | null;
}

/**
 * その問題が入っているセットを探す。所有確認は呼び出し側で済ませておくこと(ここでも子どもの行だけを見る)。
 * - 自動で作った問題: 自分が入っている(いちばん新しい)セット。手がかり batchParam は同じ問題が複数のセットにあるときの選び分けに使う。
 * - 問題バンクの問題: 手がかり batchParam が、その子どものセットで その問題を含むときだけ。ステージマップから開いたときは null。
 */
export async function loadSetContext(
  db: Database,
  childId: string,
  problem: { readonly id: string; readonly generated: boolean },
  batchParam?: string | null,
): Promise<PracticeSetContext | null> {
  const homes = await db
    .select({ batchId: schema.practiceBatchItems.batchId, position: schema.practiceBatchItems.position, subject: schema.practiceBatches.subject })
    .from(schema.practiceBatchItems)
    .innerJoin(schema.practiceBatches, eq(schema.practiceBatchItems.batchId, schema.practiceBatches.id))
    .where(and(eq(schema.practiceBatchItems.problemId, problem.id), eq(schema.practiceBatches.childId, childId)))
    .orderBy(desc(schema.practiceBatches.batchDate), desc(schema.practiceBatches.seq))
    .all();
  const home = (batchParam ? homes.find((candidate) => candidate.batchId === batchParam) : undefined) ?? (problem.generated ? homes[0] : undefined);
  if (!home || !isSubject(home.subject)) return null;

  const siblings = await db
    .select({ problemId: schema.practiceBatchItems.problemId, position: schema.practiceBatchItems.position })
    .from(schema.practiceBatchItems)
    .where(eq(schema.practiceBatchItems.batchId, home.batchId))
    .orderBy(asc(schema.practiceBatchItems.position))
    .all();
  // 整理などで途中の問題が消えても、残っている問題の並びで数える(「4 / 3」にならない)
  const index = siblings.findIndex((sibling) => sibling.position === home.position);
  return {
    batchId: home.batchId,
    subject: home.subject,
    position: index + 1,
    total: siblings.length,
    nextProblemId: siblings[index + 1]?.problemId ?? null,
  };
}
