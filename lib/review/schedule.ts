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
    correctCount === 5 ? 3 : correctCount === 4 ? 2 : currentStage;
  const days = correctCount === 5 ? 7 : correctCount === 4 ? 3 : 1;

  return { reviewStage, scheduledFor: addDaysJst(toJstDateKey(reviewedAt), days) };
};
