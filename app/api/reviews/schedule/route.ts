import { z } from "zod";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { ownedProblem } from "@/lib/utils/resources";
import { uuid } from "@/lib/utils/schemas";
import { calculateReviewSchedule } from "@/lib/review/schedule";

const schema = z.object({
  childId: uuid,
  problemId: uuid,
  similarCorrectCount: z.number().int().min(0).max(5),
});

export async function POST(request: Request) {
  const parsed = await parseJson(request, schema);
  if (!parsed.success) return apiError("Invalid review schedule");
  const input = parsed.data;
  const auth = await requireOwnedChild(input.childId);
  if (auth.response) return auth.response;
  const problem = await ownedProblem(auth.supabase, input.childId, input.problemId);
  if (!problem) return apiError("Problem not found", 404);

  const { scheduledFor, reviewStage } = calculateReviewSchedule({
    correctCount: input.similarCorrectCount,
    reviewedAt: new Date(),
  });
  const { data, error } = await auth.supabase.from("review_schedule").upsert({
    child_id: input.childId,
    problem_id: input.problemId,
    unit: problem.unit,
    sub_unit: problem.sub_unit,
    scheduled_for: scheduledFor,
    review_stage: reviewStage,
    status: "pending",
  }, { onConflict: "child_id,problem_id" }).select("id, scheduled_for, review_stage, status").single();

  return error ? internalError() : apiSuccess(data);
}
