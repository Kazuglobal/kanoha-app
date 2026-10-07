import { GRADE_2_ALL_UNITS, SUBJECTS } from "@/lib/curriculum/subjects";
import { ALL_MISTAKE_TYPE_IDS } from "@/lib/curriculum/mistakeTypes";

import { difficultySchema } from "./schemas";

/**
 * Gemini の generationConfig.responseSchema に渡す手書き JSON Schema(B8)。
 * enum は curriculum 定数と Zod enum から実行時に生成し、二重管理しない。
 * キー集合が lib/ai/schemas.ts の Zod shape と一致することはテストで担保する。
 */
type JsonSchema = Record<string, unknown>;

const text: JsonSchema = { type: "string" };
const boolean: JsonSchema = { type: "boolean" };
const integer: JsonSchema = { type: "integer" };

const object = (
  properties: Record<string, JsonSchema>,
  required: readonly string[],
): JsonSchema => ({ type: "object", properties, required: [...required] });

const enumOf = (values: readonly string[]): JsonSchema => ({
  type: "string",
  enum: [...values],
});

const unitEnum = enumOf(GRADE_2_ALL_UNITS);
const mistakeTypeEnum = enumOf(ALL_MISTAKE_TYPE_IDS);
const difficultyEnum = enumOf(difficultySchema.options);
const subjectEnum = enumOf(SUBJECTS);

export const hintsResponseSchema = object(
  {
    hint1: text,
    hint2: text,
    solution: text,
    answer: text,
    praise: text,
  },
  ["hint1", "hint2", "solution", "answer", "praise"],
);

export const parsedProblemResponseSchema = object(
  {
    problemText: text,
    detectedAnswer: text,
    correctAnswer: text,
    isCorrect: boolean,
    subject: subjectEnum,
    grade: integer,
    unit: unitEnum,
    subUnit: text,
    difficulty: difficultyEnum,
    mistakeType: mistakeTypeEnum,
    mistakeReason: text,
    hints: hintsResponseSchema,
    rubyTextRequired: boolean,
    recommendedVisualTemplate: { type: "string", nullable: true },
    similarProblemCount: integer,
  },
  [
    "problemText",
    "correctAnswer",
    "subject",
    "grade",
    "unit",
    "subUnit",
    "difficulty",
    "hints",
    "rubyTextRequired",
    "recommendedVisualTemplate",
    "similarProblemCount",
  ],
);

export const parsedProblemsResponseSchema: JsonSchema = {
  type: "array",
  items: parsedProblemResponseSchema,
};

export const similarProblemResponseSchema = object(
  {
    problemText: text,
    answer: text,
    unit: unitEnum,
    subUnit: text,
    difficulty: difficultyEnum,
    explanation: text,
  },
  ["problemText", "answer", "unit", "subUnit", "difficulty", "explanation"],
);

export const similarProblemsResponseSchema: JsonSchema = {
  type: "array",
  items: similarProblemResponseSchema,
  minItems: 5,
  maxItems: 5,
};

export const handwritingResponseSchema = object({ answer: text }, ["answer"]);

export const englishTalkJudgeResponseSchema = object(
  { correct: boolean, feedback: text },
  ["correct", "feedback"],
);
