import { z } from "zod";

import { GRADE_2_MATH_UNITS } from "@/lib/curriculum/grade2Math";
import { GRADE_2_JAPANESE_UNITS } from "@/lib/curriculum/grade2Japanese";
import { GRADE_2_ENGLISH_UNITS } from "@/lib/curriculum/grade2English";
import { GRADE_2_ALL_UNITS, SUBJECTS } from "@/lib/curriculum/subjects";
import { ALL_MISTAKE_TYPE_IDS, MISTAKE_TYPE_IDS } from "@/lib/curriculum/mistakeTypes";

export const difficultySchema = z.enum(["basic", "standard", "advanced"]);
export const subjectSchema = z.enum(SUBJECTS);

/** Mistake classification. Source of truth: lib/curriculum/mistakeTypes.ts (13 ids). */
export const mistakeTypeSchema = z.enum(MISTAKE_TYPE_IDS);
export const allMistakeTypeSchema = z.enum(ALL_MISTAKE_TYPE_IDS);

/** Unit classification. Source of truth: lib/curriculum/grade2Math.ts (11 units). */
export const unitSchema = z.enum(GRADE_2_MATH_UNITS);
export const japaneseUnitSchema = z.enum(GRADE_2_JAPANESE_UNITS);
export const englishUnitSchema = z.enum(GRADE_2_ENGLISH_UNITS);
export const allUnitSchema = z.enum(GRADE_2_ALL_UNITS);

export const TEXT_LIMITS = {
  answer: 200,
  explanation: 1000,
  hint: 1000,
  mistakeReason: 500,
  problemText: 2000,
  subUnit: 50,
  unit: 50,
} as const;

const boundedText = (max: number) => z.string().trim().min(1).max(max);

const hintText = boundedText(TEXT_LIMITS.hint);
const answerText = boundedText(TEXT_LIMITS.answer);
const problemText = boundedText(TEXT_LIMITS.problemText);
const subUnitText = boundedText(TEXT_LIMITS.subUnit);

export const hintsSchema = z
  .object({
    hint1: hintText,
    hint2: hintText,
    solution: hintText,
    answer: answerText,
    praise: hintText,
  })
  .strict();

export const parsedProblemSchema = z
  .object({
    problemText,
    detectedAnswer: answerText.optional(),
    correctAnswer: answerText,
    isCorrect: z.boolean().optional(),
    subject: subjectSchema,
    grade: z.literal(2),
    unit: allUnitSchema,
    subUnit: subUnitText,
    difficulty: difficultySchema,
    mistakeType: allMistakeTypeSchema.optional(),
    mistakeReason: boundedText(TEXT_LIMITS.mistakeReason).optional(),
    hints: hintsSchema,
    rubyTextRequired: z.boolean(),
    recommendedVisualTemplate: boundedText(TEXT_LIMITS.unit).nullable(),
    similarProblemCount: z.literal(5),
  })
  .strict()
  .superRefine((problem, context) => {
    const analysisFields = [
      problem.detectedAnswer,
      problem.isCorrect,
      problem.mistakeType,
    ];
    const presentCount = analysisFields.filter((field) => field !== undefined).length;
    if (presentCount > 0 && presentCount < analysisFields.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Answer analysis fields must be provided together",
      });
    }
  });

export const similarProblemSchema = z
  .object({
    problemText,
    answer: answerText,
    unit: allUnitSchema,
    subUnit: subUnitText,
    difficulty: difficultySchema,
    explanation: boundedText(TEXT_LIMITS.explanation),
  })
  .strict();

export const similarProblemsSchema = z
  .object({
    sourceProblemId: z.string().trim().min(1),
    similarProblems: z.array(similarProblemSchema).length(5),
  })
  .strict();

export const similarProblemDraftsSchema = z.array(similarProblemSchema).length(5);

/** サーバーが生成して保存する類題の 4 択(lib/review/choices.ts)。null は文字入力にフォールバック。 */
export const similarChoicesSchema = z.array(answerText).length(4).nullable();

export const handwritingAnswerSchema = z
  .object({
    answer: answerText,
  })
  .strict();

/** 類題生成リクエスト。mistakeType は mistakeTypes.ts の enum に限定する(A4)。 */
export const similarProblemRequestSchema = z
  .object({
    difficulty: difficultySchema,
    mistakeType: allMistakeTypeSchema.optional(),
    problemText,
    subUnit: subUnitText,
    unit: allUnitSchema,
    subject: subjectSchema.optional(),
  })
  .strict();

export type SimilarProblemRequest = z.infer<typeof similarProblemRequestSchema>;

/** 英会話れんしゅう: 子どもの声のこたえを AI がゆるく判定した結果。feedback はひらがな中心の短いほめ言葉。 */
export const englishTalkJudgeSchema = z
  .object({
    correct: z.boolean(),
    feedback: boundedText(TEXT_LIMITS.answer),
  })
  .strict();

export interface EnglishTalkJudgeRequest {
  question: string;
  modelAnswer: string;
  answer: string;
}

export type EnglishTalkJudge = z.infer<typeof englishTalkJudgeSchema>;

export type Difficulty = z.infer<typeof difficultySchema>;
export type MistakeTypeId = z.infer<typeof allMistakeTypeSchema>;
export type MathUnit = z.infer<typeof unitSchema>;
export type Unit = z.infer<typeof allUnitSchema>;
export type SimilarChoices = z.infer<typeof similarChoicesSchema>;
export type HandwritingAnswer = z.infer<typeof handwritingAnswerSchema>;
export type Hints = z.infer<typeof hintsSchema>;
export type ParsedProblem = z.infer<typeof parsedProblemSchema>;
export type SimilarProblems = z.infer<typeof similarProblemsSchema>;
export type SimilarProblemDraft = z.infer<typeof similarProblemSchema>;
