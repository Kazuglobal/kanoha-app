import type { ParsedProblem } from "./schemas";

/**
 * problems.explanation_json の中身。段階ヒントに加え、手書き回答から診断した
 * mistakeType / mistakeReason を持つ(/api/attempts が attempts.mistake_type に伝搬する: A4)。
 */
export type ProblemExplanation = ParsedProblem["hints"] & {
  mistakeType?: ParsedProblem["mistakeType"];
  mistakeReason?: string;
};

export const buildProblemExplanation = (problem: ParsedProblem): ProblemExplanation => ({
  ...problem.hints,
  ...(problem.mistakeType ? { mistakeType: problem.mistakeType } : {}),
  ...(problem.mistakeReason ? { mistakeReason: problem.mistakeReason } : {}),
});

export interface ProblemRecord {
  child_id: string;
  correct_answer: string;
  difficulty: ParsedProblem["difficulty"];
  explanation_json: ProblemExplanation;
  grade: number;
  material_id: string;
  problem_text: string;
  status: "active";
  sub_unit: string;
  subject: "math";
  unit: string;
}

export function buildProblemRecords(
  problems: readonly ParsedProblem[],
  childId: string,
  materialId: string,
): ProblemRecord[] {
  return problems.map((problem) => ({
    child_id: childId,
    correct_answer: problem.correctAnswer,
    difficulty: problem.difficulty,
    explanation_json: buildProblemExplanation(problem),
    grade: problem.grade,
    material_id: materialId,
    problem_text: problem.problemText,
    status: "active",
    sub_unit: problem.subUnit,
    subject: problem.subject,
    unit: problem.unit,
  }));
}
