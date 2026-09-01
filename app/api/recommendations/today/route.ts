import { getTodayRecommendations } from "@/lib/review/today";
import { apiSuccess, internalError, requireOwnedChild } from "@/lib/utils/api";

export async function GET(request: Request) {
  const childId = new URL(request.url).searchParams.get("childId") ?? "";
  const auth = await requireOwnedChild(childId);
  if (auth.response) return auth.response;

  const result = await getTodayRecommendations(auth.supabase, childId);
  return result.error
    ? internalError()
    : apiSuccess({ source: "rules", problems: result.problems });
}

