import type { ParsedProblem } from "./schemas";

export interface ProblemRecord {
  child_id: string;
  correct_answer: string;
  difficulty: ParsedProblem["difficulty"];
  explanation_json: ParsedProblem["hints"];
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
    explanation_json: problem.hints,
    grade: problem.grade,
    material_id: materialId,
    problem_text: problem.problemText,
    status: "active",
    sub_unit: problem.subUnit,
    subject: problem.subject,
    unit: problem.unit,
  }));
}
