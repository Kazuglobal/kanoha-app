import { and, eq } from "drizzle-orm";
import type { Database } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { nowJstIso } from "@/lib/utils/date";
import type { CurriculumProblem } from "./curriculumBank";

/**
 * 問題バンクの問題を、その子どもの problems 行として登録する(冪等)。
 * こうすることでステージマップの問題も、ヒント段階開示・正誤記録・苦手単元・復習予定・
 * 親レポートの学習ループにそのまま乗る。所有確認は呼び出し側で済ませておくこと。
 * @returns problems.id(UUID)
 */
export async function ensureCurriculumProblem(
  db: Database,
  childId: string,
  bank: CurriculumProblem,
): Promise<string> {
  const now = nowJstIso();
  await db
    .insert(schema.problems)
    .values({
      id: crypto.randomUUID(),
      childId,
      materialId: null,
      problemText: bank.problemText,
      subject: bank.subject,
      grade: 2,
      unit: bank.unit,
      subUnit: bank.subUnit,
      difficulty: "standard",
      correctAnswer: bank.correctAnswer,
      explanationJson: JSON.stringify(bank.hints),
      status: "active",
      curriculumProblemId: bank.id,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: [schema.problems.childId, schema.problems.curriculumProblemId] })
    .run();

  const row = await db
    .select({ id: schema.problems.id })
    .from(schema.problems)
    .where(and(eq(schema.problems.childId, childId), eq(schema.problems.curriculumProblemId, bank.id)))
    .get();
  if (!row) throw new Error("curriculum problem could not be registered");
  return row.id;
}
