import type { Grade2MathUnit } from "@/lib/curriculum/grade2Math";
import type { MistakeType } from "@/lib/curriculum/mistakeTypes";

export type Uuid = string;
export type IsoDate = string;
export type IsoDateTime = string;

export type Difficulty = "very_easy" | "easy" | "standard" | "challenging";
export type ExplanationLevel = Exclude<Difficulty, "challenging">;
export type MaterialSourceType =
  | "school_print"
  | "tablet_screenshot"
  | "textbook"
  | "other";
export type MaterialStatus = "pending" | "analyzing" | "done" | "failed";
export type ProblemStatus = "active" | "archived";
export type AnswerType = "tap" | "text" | "voice" | "handwriting";
export type MasteryLevel = "learning" | "reviewing" | "mastered";
export type ReviewStatus = "pending" | "done" | "skipped";
export type HintLevel = 0 | 1 | 2 | 3 | 4;
export type ReviewStage = 1 | 2 | 3;

export interface CurriculumClassification {
  subject: "math";
  grade: 2;
  unit: Grade2MathUnit;
  subUnit: string;
  difficulty: Difficulty;
}

export interface AttemptResult {
  childAnswer: string | null;
  answerType: AnswerType;
  isCorrect: boolean;
  hintLevelUsed: HintLevel;
  mistakeType: MistakeType | null;
  aiFeedback: string | null;
}

