import { z } from "zod";
import { apiError, apiSuccess, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { checkRateLimit } from "@/lib/utils/rateLimit";
import { ownedProblem } from "@/lib/utils/resources";
import { explanationLevel, uuid } from "@/lib/utils/schemas";

const schema = z.object({ childId: uuid, problemId: uuid, explanationLevel });

export async function POST(request: Request) {
  const parsed = await parseJson(request, schema);
  if (!parsed.success) return apiError("Invalid hint request");
  const auth = await requireOwnedChild(parsed.data.childId);
  if (auth.response) return auth.response;
  if (!checkRateLimit(`hints:${auth.user!.id}`)) return apiError("Too many requests", 429);
  const problem = await ownedProblem(auth.supabase, parsed.data.childId, parsed.data.problemId);
  if (!problem) return apiError("Problem not found", 404);

  const saved = typeof problem.explanation_json === "object" && problem.explanation_json
    ? problem.explanation_json as Record<string, unknown>
    : {};
  return apiSuccess({
    hint1: saved.hint1 ?? "もんだいの たいせつな ことばを さがそう。",
    hint2: saved.hint2 ?? "わかっている かずを ならべてみよう。",
    solution: saved.solution ?? "ひとつずつ じゅんばんに かんがえよう。",
    answer: saved.answer ?? problem.correct_answer,
    praise: saved.praise ?? "ここまで よく かんがえたね。",
    explanationLevel: parsed.data.explanationLevel,
  });
}
