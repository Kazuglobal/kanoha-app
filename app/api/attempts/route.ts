import { z } from "zod";
import { MISTAKE_TYPE_IDS } from "@/lib/curriculum/mistakeTypes";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { ownedProblem, ownedSession, ownedSimilarProblemRecord } from "@/lib/utils/resources";
import { uuid } from "@/lib/utils/schemas";
import { answersMatch } from "@/lib/utils/answers";

const schema = z.object({
  childId: uuid,
  sessionId: uuid,
  problemId: uuid.optional(),
  similarProblemId: uuid.optional(),
  childAnswer: z.string().trim().min(1).max(500),
  answerType: z.enum(["tap", "text", "voice", "handwriting"]),
  isCorrect: z.boolean().optional(),
  hintLevelUsed: z.number().int().min(0).max(4).default(0),
  mistakeType: z.enum(MISTAKE_TYPE_IDS).nullable().optional(),
  aiFeedback: z.string().trim().max(1000).nullable().optional(),
}).refine((value) => Boolean(value.problemId) !== Boolean(value.similarProblemId), {
  message: "Exactly one problem reference is required",
});

export async function POST(request: Request) {
  const parsed = await parseJson(request, schema);
  if (!parsed.success) return apiError("Invalid attempt");
  const input = parsed.data;
  const auth = await requireOwnedChild(input.childId);
  if (auth.response) return auth.response;

  const sessionOk = await ownedSession(auth.supabase, input.childId, input.sessionId);
  const resource = input.problemId
    ? await ownedProblem(auth.supabase, input.childId, input.problemId)
    : await ownedSimilarProblemRecord(auth.supabase, input.childId, input.similarProblemId!);
  if (!sessionOk || !resource) return apiError("Learning resource not found", 404);
  const expectedAnswer = "correct_answer" in resource ? resource.correct_answer : resource.answer;
  const isCorrect = answersMatch(input.childAnswer, String(expectedAnswer));

  const { data, error } = await auth.supabase.from("attempts").insert({
    child_id: input.childId,
    session_id: input.sessionId,
    problem_id: input.problemId ?? null,
    similar_problem_id: input.similarProblemId ?? null,
    child_answer: input.childAnswer,
    answer_type: input.answerType,
    is_correct: isCorrect,
    hint_level_used: input.hintLevelUsed,
    mistake_type: input.mistakeType ?? null,
    ai_feedback: input.aiFeedback ?? null,
  }).select("id, is_correct, created_at").single();

  if (error) return internalError();

  const { data: attempts } = await auth.supabase.from("attempts")
    .select("is_correct")
    .eq("child_id", input.childId)
    .or(input.problemId
      ? `problem_id.eq.${input.problemId}`
      : `similar_problem_id.eq.${input.similarProblemId}`);
  const total = attempts?.length ?? 1;
  const correct = attempts?.filter((attempt) => attempt.is_correct).length ?? Number(isCorrect);
  const accuracy = correct / total;
  await auth.supabase.from("weakness_map").upsert({
    child_id: input.childId,
    unit: resource.unit,
    sub_unit: resource.sub_unit,
    accuracy_rate: accuracy,
    mistake_count: total - correct,
    last_attempted_at: new Date().toISOString(),
    mastery_level: total >= 5 && accuracy >= 0.8 ? "mastered" : correct ? "reviewing" : "learning",
  }, { onConflict: "child_id,unit,sub_unit" });

  return apiSuccess(data, 201);
}
