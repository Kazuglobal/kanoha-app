import { z } from "zod";
import { apiError, apiSuccess, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { checkRateLimit } from "@/lib/utils/rateLimit";
import { ownedProblem } from "@/lib/utils/resources";
import { uuid } from "@/lib/utils/schemas";

const schema = z.object({
  childId: uuid,
  problemId: uuid,
  requestedByChild: z.literal(true),
});

const templates: Record<string, string> = {
  "水のかさ": "/visuals/volume-l-ml.svg",
};

export async function POST(request: Request) {
  const parsed = await parseJson(request, schema);
  if (!parsed.success) return apiError("Invalid image request");
  const auth = await requireOwnedChild(parsed.data.childId);
  if (auth.response) return auth.response;
  if (!checkRateLimit(`image:${auth.user!.id}`, 5)) return apiError("Too many requests", 429);
  const problem = await ownedProblem(auth.supabase, parsed.data.childId, parsed.data.problemId);
  if (!problem) return apiError("Problem not found", 404);

  const templateUrl = templates[problem.unit];
  if (templateUrl) return apiSuccess({ kind: "template", url: templateUrl });
  return apiError("A visual is not available for this problem", 422);
}
