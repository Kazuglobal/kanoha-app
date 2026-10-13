import { buildChoices } from "@/lib/review/choices";
import {
  getCurriculumProblemById,
  getCurriculumProblemsBySubject,
  type CurriculumProblem,
} from "./curriculumBank";

export const PRACTICE_COUNT = 5;

export interface CurriculumPracticeItem {
  sourceId: string;
  question: string;
  answer: string;
  explanation: string;
  unit: CurriculumProblem["unit"];
  subUnit: string;
  choices: readonly string[] | null;
  listenText: string | null;
}

/**
 * 問題バンクの問題から「れんしゅう 5もん」を決定的に組み立てる純粋関数。
 * 同じ単元のほかの問題を優先し、足りなければ同じ教科の近い順(つぎの単元から)で埋める。
 * 選択肢は問題に用意されたものを使い、無ければ数値の答えから 4 択を作る(作れなければ文字入力)。
 */
export function buildCurriculumPractice(
  problemId: string,
  count: number = PRACTICE_COUNT,
): readonly CurriculumPracticeItem[] {
  const current = getCurriculumProblemById(problemId);
  if (!current) return [];

  const subjectProblems = getCurriculumProblemsBySubject(current.subject);
  const start = subjectProblems.findIndex((problem) => problem.id === problemId);
  const rotated = [...subjectProblems.slice(start + 1), ...subjectProblems.slice(0, start)];
  const sameUnit = rotated.filter((problem) => problem.unit === current.unit);
  const others = rotated.filter((problem) => problem.unit !== current.unit);
  const pool = [...sameUnit, ...others];
  const picked = pool.slice(0, Math.min(count, pool.length));

  return picked.map((problem: CurriculumProblem, index: number) => toPracticeItem(problem, `${problemId}:${index}`));
}

const toPracticeItem = (problem: CurriculumProblem, seed: string): CurriculumPracticeItem => ({
  sourceId: problem.id,
  question: problem.problemText,
  answer: problem.correctAnswer,
  explanation: problem.hints.solution,
  unit: problem.unit,
  subUnit: problem.subUnit,
  choices: problem.choices ? [...problem.choices] : buildChoices(problem.correctAnswer, seed),
  listenText: problem.listenText ?? null,
});
