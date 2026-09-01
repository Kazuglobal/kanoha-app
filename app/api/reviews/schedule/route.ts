import { z } from "zod";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { ownedProblem } from "@/lib/utils/resources";
import { uuid } from "@/lib/utils/schemas";
import { calculateReviewSchedule, toReviewStage } from "@/lib/review/schedule";
import { masteryAfterSimilarSet, type MasteryLevel } from "@/lib/review/weakness";

const schema = z.object({
  childId: uuid,
  problemId: uuid,
  similarCorrectCount: z.number().int().min(0).max(5),
});

type Supabase = Awaited<ReturnType<typeof requireOwnedChild>>["supabase"];

export async function POST(request: Request) {
  const parsed = await parseJson(request, schema);
  if (!parsed.success) return apiError("Invalid review schedule");
  const input = parsed.data;
  const auth = await requireOwnedChild(input.childId);
  if (auth.response) return auth.response;
  const problem = await ownedProblem(auth.supabase, input.childId, input.problemId);
  if (!problem) return apiError("Problem not found", 404);

  const existing = await auth.supabase.from("review_schedule")
    .select("review_stage")
    .eq("child_id", input.childId)
    .eq("problem_id", input.problemId)
    .maybeSingle();
  if (existing.error) return internalError();

  const { scheduledFor, reviewStage } = calculateReviewSchedule({
    correctCount: input.similarCorrectCount,
    currentStage: toReviewStage(existing.data?.review_stage),
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
  if (error) return internalError();

  const mastery = await applySimilarSetMastery(auth.supabase, input, problem.unit, problem.sub_unit);
  if (mastery === null) return internalError();
  return apiSuccess({ ...data, mastery_level: mastery });
}

/** doc.md §9: 類題 4/5 以上で単元を習得扱いにする(判断は lib/review/weakness.ts)。 */
async function applySimilarSetMastery(
  supabase: Supabase,
  input: z.infer<typeof schema>,
  unit: string,
  subUnit: string,
): Promise<MasteryLevel | null> {
  const current = await supabase.from("weakness_map")
    .select("mastery_level")
    .eq("child_id", input.childId)
    .eq("unit", unit)
    .eq("sub_unit", subUnit)
    .maybeSingle();
  if (current.error) return null;
  const currentLevel = (current.data?.mastery_level ?? "learning") as MasteryLevel;
  const next = masteryAfterSimilarSet(currentLevel, input.similarCorrectCount);
  if (next === currentLevel) return next;

  const { error } = await supabase.from("weakness_map").upsert({
    child_id: input.childId,
    unit,
    sub_unit: subUnit,
    mastery_level: next,
    last_attempted_at: new Date().toISOString(),
  }, { onConflict: "child_id,unit,sub_unit" });
  return error ? null : next;
}
