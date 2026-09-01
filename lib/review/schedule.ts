import { addDaysJst, toJstDateKey } from "@/lib/utils/date";

export type ReviewStage = 1 | 2 | 3;

export interface ReviewScheduleInput {
  correctCount: number;
  currentStage?: ReviewStage;
  reviewedAt: Date;
}

export interface ReviewScheduleResult {
  reviewStage: ReviewStage;
  scheduledFor: string;
}

export const MAX_REVIEW_STAGE: ReviewStage = 3;

/** stage 1〜3 に対応する間隔(doc.md §12.1: 1日後 → 3日後 → 7日後)。 */
const STAGE_DAYS: Readonly<Record<ReviewStage, number>> = { 1: 1, 2: 3, 3: 7 };

export const nextReviewStage = (currentStage: ReviewStage): ReviewStage =>
  currentStage >= MAX_REVIEW_STAGE ? MAX_REVIEW_STAGE : ((currentStage + 1) as ReviewStage);

/** 復習日を `currentStage` から一段進めた stage の間隔で返す。 */
export const reviewDateForStage = (reviewedAt: Date, stage: ReviewStage): string =>
  addDaysJst(toJstDateKey(reviewedAt), STAGE_DAYS[stage]);

const isReviewStage = (value: number): value is ReviewStage =>
  value === 1 || value === 2 || value === 3;

/** DB の review_stage(smallint)を ReviewStage に正規化する。範囲外は stage 1 扱い。 */
export const toReviewStage = (value: number | null | undefined): ReviewStage =>
  typeof value === "number" && isReviewStage(value) ? value : 1;

/**
 * doc.md §12.2:
 *   5/5 → 7日後(stage 繰り上げ、最大 3)
 *   4/5 → 3日後(stage は 2 以上を維持)
 *   3/5 以下 → 1日後(stage 据え置き)
 */
export const calculateReviewSchedule = ({
  correctCount,
  currentStage = 1,
  reviewedAt,
}: ReviewScheduleInput): ReviewScheduleResult => {
  if (!Number.isInteger(correctCount) || correctCount < 0 || correctCount > 5) {
    throw new RangeError("correctCount must be an integer from 0 to 5");
  }
  if (Number.isNaN(reviewedAt.getTime())) {
    throw new RangeError("reviewedAt must be a valid date");
  }

  const reviewStage: ReviewStage =
    correctCount === 5
      ? nextReviewStage(currentStage)
      : correctCount === 4
        ? (currentStage < 2 ? 2 : currentStage)
        : currentStage;
  const days = correctCount === 5 ? 7 : correctCount === 4 ? 3 : 1;

  return { reviewStage, scheduledFor: addDaysJst(toJstDateKey(reviewedAt), days) };
};
