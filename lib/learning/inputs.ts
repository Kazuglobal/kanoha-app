import "server-only";
import { and, desc, eq, inArray, isNotNull, or } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { getCurriculumProblemsBySubject, getCurriculumStages } from "@/lib/curriculum/curriculumBank";
import { computeStageStates } from "@/lib/curriculum/stageUnlock";
import { SUBJECT_CONFIG, type Subject } from "@/lib/curriculum/subjects";
import type { Database } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import type { BankCandidate, SkillState } from "@/lib/generation/plan";
import { SOLUTION_HINT_LEVEL } from "@/lib/utils/resources";
import { BANK_LEVEL, clampLevel, levelFromDifficulty, summarizeSkill, type Difficulty, type LevelEvent } from "./level";

/**
 * 子どもの記録(DB)から、出題計画(planBatch)に渡す材料を集める。所有確認は呼び出し側で済ませておくこと。
 * 答え・ヒントは読まない(単元・小単元・正誤・時刻だけ)。
 */

/** 新しい記録をこの件数まで読む。 */
const EVENT_LIMIT = 300;

export interface SkillEvent extends LevelEvent {
  readonly unit: string;
  readonly subUnit: string;
}

const isDifficulty = (value: string | null): value is Difficulty => value === "basic" || value === "standard" || value === "advanced";
const difficultyLevel = (value: string | null): number => levelFromDifficulty(isDifficulty(value) ? value : "standard");

interface ProblemSide {
  readonly unit: string | null;
  readonly subUnit: string | null;
  readonly difficulty: string | null;
  readonly level: number | null;
  readonly curriculumId: string | null;
}

/** 生成した問題はそのレベル、問題バンクは 2、アップロードは難易度から。 */
const problemLevel = (problem: ProblemSide): number =>
  problem.level !== null ? clampLevel(problem.level) : problem.curriculumId !== null ? BANK_LEVEL : difficultyLevel(problem.difficulty);

/**
 * 解いた記録(新しい 300 件)を、小単元ごとの出来事にして 古い順で返す。
 * units を渡すと、その単元の記録だけを数えてから新しい 300 件を取る(ほかの教科をたくさん解いても、この教科の記録は押し出されない)。
 */
export async function loadSkillEvents(db: Database, childId: string, units?: readonly string[]): Promise<SkillEvent[]> {
  const sourceProblems = alias(schema.problems, "source_problems");
  const inUnits = units
    ? or(inArray(schema.problems.unit, [...units]), inArray(schema.generatedSimilarProblems.unit, [...units]))
    : undefined;
  const rows = await db
    .select({
      correct: schema.attempts.isCorrect,
      hint: schema.attempts.hintLevelUsed,
      at: schema.attempts.createdAt,
      problemUnit: schema.problems.unit,
      problemSubUnit: schema.problems.subUnit,
      problemDifficulty: schema.problems.difficulty,
      problemLevel: schema.problems.difficultyLevel,
      curriculumId: schema.problems.curriculumProblemId,
      similarUnit: schema.generatedSimilarProblems.unit,
      similarSubUnit: schema.generatedSimilarProblems.subUnit,
      similarDifficulty: schema.generatedSimilarProblems.difficulty,
      sourceLevel: sourceProblems.difficultyLevel,
    })
    .from(schema.attempts)
    .leftJoin(schema.problems, eq(schema.attempts.problemId, schema.problems.id))
    .leftJoin(schema.generatedSimilarProblems, eq(schema.attempts.similarProblemId, schema.generatedSimilarProblems.id))
    .leftJoin(sourceProblems, eq(schema.generatedSimilarProblems.sourceProblemId, sourceProblems.id))
    .where(and(eq(schema.attempts.childId, childId), inUnits))
    .orderBy(desc(schema.attempts.createdAt))
    .limit(EVENT_LIMIT)
    .all();

  const events = rows.flatMap((row): SkillEvent[] => {
    const at = Date.parse(row.at);
    const base = { correct: row.correct === 1, usedAnswerHint: row.hint >= SOLUTION_HINT_LEVEL, at };
    if (Number.isNaN(at)) return [];
    if (row.problemUnit !== null && row.problemSubUnit !== null) {
      const level = problemLevel({ unit: row.problemUnit, subUnit: row.problemSubUnit, difficulty: row.problemDifficulty, level: row.problemLevel, curriculumId: row.curriculumId });
      return [{ ...base, unit: row.problemUnit, subUnit: row.problemSubUnit, level }];
    }
    if (row.similarUnit !== null && row.similarSubUnit !== null) {
      // 自動で作った問題の類題は、元の問題のレベルで数える(3 段階の難易度に丸めると L3 が 2、L5 が 4 に読めてしまう)
      const level = row.sourceLevel !== null ? clampLevel(row.sourceLevel) : difficultyLevel(row.similarDifficulty);
      return [{ ...base, unit: row.similarUnit, subUnit: row.similarSubUnit, level }];
    }
    return [];
  });
  return events.reverse();
}

/** 出来事を小単元ごとにまとめて、レベルとようす(new/review/ready/steady)を求める。 */
export function groupSkillStates(events: readonly SkillEvent[], now: number): SkillState[] {
  const groups = new Map<string, { unit: string; subUnit: string; events: SkillEvent[] }>();
  for (const event of events) {
    const key = `${event.unit}/${event.subUnit}`;
    const group = groups.get(key) ?? { unit: event.unit, subUnit: event.subUnit, events: [] };
    groups.set(key, { ...group, events: [...group.events, event] });
  }
  return [...groups.values()].map(({ unit, subUnit, events: skillEvents }) => ({ unit, subUnit, ...summarizeSkill(skillEvents, { now }) }));
}

/** ステージマップの進み具合: いちどでも正解した問題バンクの id。 */
export async function loadSolvedCurriculumIds(db: Database, childId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ id: schema.problems.curriculumProblemId })
    .from(schema.attempts)
    .innerJoin(schema.problems, eq(schema.attempts.problemId, schema.problems.id))
    .where(and(eq(schema.attempts.childId, childId), eq(schema.attempts.isCorrect, 1), isNotNull(schema.problems.curriculumProblemId)))
    .all();
  return rows.flatMap(({ id }) => (id ? [id] : []));
}

export interface PracticeInputs {
  readonly states: readonly SkillState[];
  readonly unlockedUnits: readonly string[];
  /** まだ解放されていない単元(開く順) */
  readonly lockedUnits: readonly string[];
  readonly bank: readonly BankCandidate[];
}

/** 教科ひとつぶんの、出題計画に渡す材料。 */
export async function loadPracticeInputs(db: Database, childId: string, subject: Subject, now: Date): Promise<PracticeInputs> {
  const [events, solvedIds] = await Promise.all([
    loadSkillEvents(db, childId, SUBJECT_CONFIG[subject].units),
    loadSolvedCurriculumIds(db, childId),
  ]);
  const states = groupSkillStates(events, now.getTime());

  const stageStates = computeStageStates(getCurriculumStages(subject), solvedIds).stages;
  const unlockedUnits = stageStates.filter((state) => state.unlocked).map((state) => state.stage.unit);
  const lockedUnits = stageStates
    .filter((state) => !state.unlocked)
    .sort((a, b) => a.stage.unlockRequirement - b.stage.unlockRequirement)
    .map((state) => state.stage.unit);

  const solved = new Set(solvedIds);
  const unlocked = new Set<string>(unlockedUnits);
  const bank = getCurriculumProblemsBySubject(subject)
    .filter((problem) => unlocked.has(problem.unit) && !solved.has(problem.id))
    .map((problem): BankCandidate => ({ id: problem.id, unit: problem.unit, subUnit: problem.subUnit }));

  return { states, unlockedUnits, lockedUnits, bank };
}
