import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getCurriculumProblemById, type CurriculumProblem } from "@/lib/curriculum/curriculumBank";
import { ensureCurriculumProblem } from "@/lib/curriculum/materialize";
import type { Subject } from "@/lib/curriculum/subjects";
import type { Database } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { generateBatch as defaultGenerateBatch, type BatchEntry } from "@/lib/generation/batch";
import { planBatch as defaultPlanBatch, type PlanReason } from "@/lib/generation/plan";
import type { GeneratedProblem } from "@/lib/generation/types";
import { loadPracticeInputs, type PracticeInputs } from "@/lib/learning/inputs";
import { BANK_LEVEL, difficultyFromLevel } from "@/lib/learning/level";
import { readStoredChoices } from "@/lib/review/choices";
import { pruneUntouchedGenerated } from "./prune";
import { nowJstIso, todayKeyJst } from "@/lib/utils/date";
import { practiceMaxSetsPerDay } from "@/lib/utils/flags";

/**
 * 「あたらしい もんだい」の 1 セットを作る・読む。所有確認は呼び出し側(requireOwnedChild)で済ませておくこと。
 * 子どもに返す形(PracticeSetView)には 答え・ヒント・生成の手がかり(generator_ref)を入れない。
 */

export interface PracticeItemView {
  readonly problemId: string;
  readonly position: number;
  readonly problemText: string;
  readonly unit: string;
  readonly subUnit: string;
  readonly level: number;
  readonly reason: PlanReason;
  readonly choices: readonly string[] | null;
  readonly listenText: string | null;
  /** この問題を、いちどでも正解したか(「つづきから」の場所を決めるのに使う) */
  readonly done: boolean;
}

export interface PracticeSetView {
  readonly batchId: string;
  /** その日の何セット目か(1 から) */
  readonly seq: number;
  /** 今日、あと何セット作れるか */
  readonly remainingSets: number;
  readonly items: readonly PracticeItemView[];
}

export type NewSetResult =
  | { readonly ok: true; readonly set: PracticeSetView }
  /** 今日の上限まで作った */
  | { readonly ok: false; readonly reason: "limit" }
  /** 出せる問題が 1 つもない・セットを作らない設定(上限 0)。カードは出さない */
  | { readonly ok: false; readonly reason: "empty" };

export interface NewSetRequest {
  readonly childId: string;
  readonly subject: Subject;
  /** true なら、今日のセットがあっても次のセットを作る。false なら、今日のセットがあればそれを返す。 */
  readonly more: boolean;
  readonly now?: Date;
}

/** 試験用に差しかえられる部品。 */
export interface NewSetDeps {
  readonly planBatch?: typeof defaultPlanBatch;
  readonly generateBatch?: typeof defaultGenerateBatch;
  readonly prune?: typeof pruneUntouchedGenerated;
}

type BatchRow = typeof schema.practiceBatches.$inferSelect;
type ProblemInsert = typeof schema.problems.$inferInsert;
type ItemView = Omit<PracticeItemView, "position" | "done">;

/** セットに入れる 1 問。row があれば これから problems に書く問題(バンクの問題は登録ずみなので row は無い)。 */
interface PendingItem {
  readonly problemId: string;
  readonly reason: PlanReason;
  readonly view: ItemView;
  readonly row?: ProblemInsert;
}

const PLAN_REASONS: readonly PlanReason[] = ["practice", "review", "stretch", "preview"];
const asReason = (value: string): PlanReason => PLAN_REASONS.find((reason) => reason === value) ?? "practice";

const batchWhere = (childId: string, subject: Subject, date: string) =>
  and(eq(schema.practiceBatches.childId, childId), eq(schema.practiceBatches.subject, subject), eq(schema.practiceBatches.batchDate, date));

const latestBatch = (db: Database, childId: string, subject: Subject, date: string) =>
  db.select().from(schema.practiceBatches).where(batchWhere(childId, subject, date)).orderBy(desc(schema.practiceBatches.seq)).limit(1).get();

const batchAt = (db: Database, childId: string, subject: Subject, date: string, seq: number) =>
  db.select().from(schema.practiceBatches).where(and(batchWhere(childId, subject, date), eq(schema.practiceBatches.seq, seq))).get();

const remaining = (cap: number, seq: number): number => Math.max(0, cap - seq);

/** 子どもが正解したことのある問題の id(渡した id のうち)。 */
async function solvedIds(db: Database, childId: string, problemIds: readonly string[]): Promise<Set<string>> {
  if (problemIds.length === 0) return new Set();
  const rows = await db
    .selectDistinct({ id: schema.attempts.problemId })
    .from(schema.attempts)
    .where(and(eq(schema.attempts.childId, childId), eq(schema.attempts.isCorrect, 1), inArray(schema.attempts.problemId, [...problemIds])))
    .all();
  return new Set(rows.flatMap(({ id }) => (id ? [id] : [])));
}

/** 保存してあるセットを、子どもに返す形で読む。 */
async function readSet(db: Database, batch: BatchRow, cap: number): Promise<PracticeSetView> {
  const rows = await db
    .select({
      position: schema.practiceBatchItems.position,
      reason: schema.practiceBatchItems.reason,
      problemId: schema.problems.id,
      problemText: schema.problems.problemText,
      unit: schema.problems.unit,
      subUnit: schema.problems.subUnit,
      choices: schema.problems.choices,
      listenText: schema.problems.listenText,
      level: schema.problems.difficultyLevel,
      curriculumProblemId: schema.problems.curriculumProblemId,
    })
    .from(schema.practiceBatchItems)
    .innerJoin(schema.problems, eq(schema.practiceBatchItems.problemId, schema.problems.id))
    .where(eq(schema.practiceBatchItems.batchId, batch.id))
    .orderBy(asc(schema.practiceBatchItems.position))
    .all();

  const solved = await solvedIds(db, batch.childId, rows.map((row) => row.problemId));
  const items = rows.map((row): PracticeItemView => {
    const bank = row.curriculumProblemId ? getCurriculumProblemById(row.curriculumProblemId) : undefined;
    return {
      problemId: row.problemId,
      position: row.position,
      problemText: row.problemText,
      unit: row.unit,
      subUnit: row.subUnit,
      level: row.level ?? BANK_LEVEL,
      reason: asReason(row.reason),
      choices: readStoredChoices(row.choices) ?? bank?.choices ?? null,
      listenText: row.listenText ?? bank?.listenText ?? null,
      done: solved.has(row.problemId),
    };
  });
  return { batchId: batch.id, seq: batch.seq, remainingSets: remaining(cap, batch.seq), items };
}

function generatedItem(childId: string, problem: GeneratedProblem, reason: PlanReason, nowIso: string): PendingItem {
  const problemId = crypto.randomUUID();
  return {
    problemId,
    reason,
    view: {
      problemId,
      problemText: problem.problemText,
      unit: problem.unit,
      subUnit: problem.subUnit,
      level: problem.level,
      reason,
      choices: problem.choices ?? null,
      listenText: problem.listenText ?? null,
    },
    row: {
      id: problemId,
      childId,
      materialId: null,
      problemText: problem.problemText,
      subject: problem.subject,
      grade: 2,
      unit: problem.unit,
      subUnit: problem.subUnit,
      difficulty: difficultyFromLevel(problem.level),
      correctAnswer: problem.correctAnswer,
      explanationJson: JSON.stringify(problem.hints),
      status: "active",
      curriculumProblemId: null,
      choices: problem.choices ? JSON.stringify(problem.choices) : null,
      listenText: problem.listenText ?? null,
      generatorRef: problem.ref,
      difficultyLevel: problem.level,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  };
}

async function bankItem(db: Database, childId: string, bank: CurriculumProblem, reason: PlanReason): Promise<PendingItem> {
  const problemId = await ensureCurriculumProblem(db, childId, bank);
  return {
    problemId,
    reason,
    view: {
      problemId,
      problemText: bank.problemText,
      unit: bank.unit,
      subUnit: bank.subUnit,
      level: BANK_LEVEL,
      reason,
      choices: bank.choices ?? null,
      listenText: bank.listenText ?? null,
    },
  };
}

/** 計画の各枠を、セットに入れる問題にする。つくれなかった枠は、まだ使っていないバンクの問題で代わりにする。 */
async function resolveEntries(
  db: Database,
  childId: string,
  entries: readonly BatchEntry[],
  bank: PracticeInputs["bank"],
  nowIso: string,
): Promise<PendingItem[]> {
  const usedBank = new Set(entries.flatMap((entry) => (entry.kind === "bank" ? [entry.item.bankId] : [])));
  const spare = bank.filter((candidate) => !usedBank.has(candidate.id));
  const items: PendingItem[] = [];
  for (const entry of entries) {
    if (entry.kind === "generated") {
      items.push(generatedItem(childId, entry.problem, entry.item.reason, nowIso));
      continue;
    }
    const wanted = entry.kind === "bank" ? entry.item.bankId : spare.shift()?.id;
    const problem = wanted ? getCurriculumProblemById(wanted) : undefined;
    if (problem) items.push(await bankItem(db, childId, problem, "practice"));
  }
  return items;
}

/** セット・問題・割り当てを 1 回の batch で書く(本物の D1 では原子的: 途中で失敗したら全部なかったことになる)。 */
async function writeSet(db: Database, batch: BatchRow, items: readonly PendingItem[]): Promise<void> {
  const problemRows = items.flatMap((item) => (item.row ? [item.row] : []));
  const itemRows = items.map((item, position) => ({ batchId: batch.id, position, problemId: item.problemId, reason: item.reason }));
  await db.batch([
    db.insert(schema.practiceBatches).values(batch),
    ...problemRows.map((row) => db.insert(schema.problems).values(row)),
    db.insert(schema.practiceBatchItems).values(itemRows),
  ]);
}

/**
 * 古くて解かれなかった自動生成の問題を整理する。おまけの掃除なので、失敗しても子どもの練習は止めない
 * (次のセットを作るときに また試す)。
 */
async function tidyUp(db: Database, childId: string, now: Date, prune: typeof pruneUntouchedGenerated): Promise<void> {
  await prune(db, childId, now).catch(() => 0);
}

/**
 * 今日の「あたらしい もんだい」のセットを返す。
 * - more=false: 今日のセットがあればそれを返す(リロードで増えない)。なければ 1 セット目を作る。
 * - more=true: 次のセットを作る。1 日(JST)の上限(既定 3)をこえたら limit。いまのセットが終わっていないうちは、新しく作らず そのセットを返す
 *   (古い画面から押されても、1 日のセットを使いきらない)。
 * 同じセット番号を同時に作ろうとしたら、先に書いたほうが勝ち、負けたほうは勝ったセットを返す。
 */
export async function createOrGetPracticeSet(db: Database, request: NewSetRequest, deps: NewSetDeps = {}): Promise<NewSetResult> {
  const { childId, subject, more } = request;
  const now = request.now ?? new Date();
  const date = todayKeyJst(now);
  const cap = practiceMaxSetsPerDay();

  const latest = await latestBatch(db, childId, subject, date);
  if (latest) {
    const current = await readSet(db, latest, cap);
    if (!more || current.items.some((item) => !item.done)) return { ok: true, set: current };
  }
  const seq = (latest?.seq ?? 0) + 1;
  if (seq > cap) return { ok: false, reason: cap === 0 ? "empty" : "limit" };

  const inputs = await loadPracticeInputs(db, childId, subject, now);
  const plan = (deps.planBatch ?? defaultPlanBatch)({ subject, ...inputs, seed: `${childId}:${date}:${subject}`, seq: seq - 1 });
  const entries = (deps.generateBatch ?? defaultGenerateBatch)(plan);
  const nowIso = nowJstIso(now);
  const items = await resolveEntries(db, childId, entries, inputs.bank, nowIso);
  if (items.length === 0) return { ok: false, reason: "empty" };

  const batch: BatchRow = { id: crypto.randomUUID(), childId, subject, batchDate: date, seq, createdAt: nowIso };
  try {
    await writeSet(db, batch, items);
  } catch (error) {
    const winner = await batchAt(db, childId, subject, date, seq);
    if (winner) return { ok: true, set: await readSet(db, winner, cap) };
    throw error;
  }
  await tidyUp(db, childId, now, deps.prune ?? pruneUntouchedGenerated);
  return {
    ok: true,
    // 作ったばかりのセットは、どれもまだ解いていない(バンクの問題も含め 「done」は セットを読みなおすときに数える)
    set: { batchId: batch.id, seq, remainingSets: remaining(cap, seq), items: items.map((item, position) => ({ position, ...item.view, done: false })) },
  };
}
