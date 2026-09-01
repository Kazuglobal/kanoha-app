import { z } from "zod";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { ownedProblem, ownedSession } from "@/lib/utils/resources";
import { uuid } from "@/lib/utils/schemas";
import { calculateReviewSchedule, toReviewStage } from "@/lib/review/schedule";
import { masteryAfterSimilarSet, type MasteryLevel } from "@/lib/review/weakness";

const schema = z.object({
  childId: uuid,
  problemId: uuid,
  /** 類題セットを解いたセッション。指定があれば、そのセッション内の元問題 attempt で判定する。 */
  sessionId: uuid.optional(),
  similarCorrectCount: z.number().int().min(0).max(5),
});

type Input = z.infer<typeof schema>;
type Supabase = Awaited<ReturnType<typeof requireOwnedChild>>["supabase"];

interface ExistingReview {
  review_stage: number | null;
  status: string;
}

export async function POST(request: Request) {
  const parsed = await parseJson(request, schema);
  if (!parsed.success) return apiError("Invalid review schedule");
  const input = parsed.data;
  const auth = await requireOwnedChild(input.childId);
  if (auth.response) return auth.response;
  const [problem, sessionOk] = await Promise.all([
    ownedProblem(auth.supabase, input.childId, input.problemId),
    input.sessionId ? ownedSession(auth.supabase, input.childId, input.sessionId) : true,
  ]);
  if (!problem || !sessionOk) return apiError("Learning resource not found", 404);

  const existing = await auth.supabase.from("review_schedule")
    .select("review_stage, status")
    .eq("child_id", input.childId)
    .eq("problem_id", input.problemId)
    .maybeSingle();
  if (existing.error) return internalError();
  const current = (existing.data ?? null) as ExistingReview | null;

  const eligible = await reviewEligible(auth.supabase, input, current);
  if (eligible === null) return internalError();
  const review = eligible ? await upsertReview(auth.supabase, input, problem, current) : { scheduled: false as const };
  if (review === null) return internalError();

  const mastery = await applySimilarSetMastery(auth.supabase, input, problem.unit, problem.sub_unit);
  if (mastery === null) return internalError();
  return apiSuccess({ ...review, mastery_level: mastery });
}

/**
 * doc.md §12.1: 復習に載るのは「間違えた問題」だけ。
 * 既に pending の復習があるか、元問題の attempt(sessionId 指定時はそのセッション内)が不正解のときだけ作成/更新する。
 */
async function reviewEligible(
  supabase: Supabase,
  input: Input,
  current: ExistingReview | null,
): Promise<boolean | null> {
  if (current?.status === "pending") return true;
  const query = supabase.from("attempts")
    .select("is_correct")
    .eq("child_id", input.childId)
    .eq("problem_id", input.problemId);
  const { data, error } = await (input.sessionId ? query.eq("session_id", input.sessionId) : query)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data ? data.is_correct === false : false;
}

/** doc.md §12.2: 類題結果で次の復習日と stage を決めて upsert する。 */
async function upsertReview(
  supabase: Supabase,
  input: Input,
  problem: { unit: string; sub_unit: string },
  current: ExistingReview | null,
) {
  const { scheduledFor, reviewStage } = calculateReviewSchedule({
    correctCount: input.similarCorrectCount,
    currentStage: toReviewStage(current?.review_stage),
    reviewedAt: new Date(),
  });
  const { data, error } = await supabase.from("review_schedule").upsert({
    child_id: input.childId,
    problem_id: input.problemId,
    unit: problem.unit,
    sub_unit: problem.sub_unit,
    scheduled_for: scheduledFor,
    review_stage: reviewStage,
    status: "pending",
  }, { onConflict: "child_id,problem_id" }).select("id, scheduled_for, review_stage, status").single();
  return error ? null : { ...data, scheduled: true as const };
}

/**
 * doc.md §9: 類題 4/5 以上で単元を習得扱いにする(判断は lib/review/weakness.ts)。
 * mastered からの降格はここ(4/5 未満)だけが明示的に書く。RPC の upsert は mastered を維持する。
 */
async function applySimilarSetMastery(
  supabase: Supabase,
  input: Input,
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
