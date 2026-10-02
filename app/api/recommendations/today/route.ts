import { isSubject, type Subject } from "@/lib/curriculum/subjects";
import { getTodayRecommendations } from "@/lib/review/today";
import { apiError, apiSuccess, internalError, requireOwnedChild } from "@/lib/utils/api";
import { uuid } from "@/lib/utils/schemas";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const childId = url.searchParams.get("childId") ?? "";
  const rawSubject = url.searchParams.get("subject");
  const subject: Subject | undefined = rawSubject && isSubject(rawSubject) ? rawSubject : undefined;

  if (!uuid.safeParse(childId).success) return apiError("Invalid recommendation request");
  const auth = await requireOwnedChild(childId);
  if (auth.response) return auth.response;

  const result = await getTodayRecommendations(childId, new Date(), auth.db, subject);
  return result.error
    ? internalError()
    : apiSuccess({
        source: "rules",
        problems: result.problems,
        limitReached: result.limitReached,
        remainingMinutes: result.remainingMinutes,
      });
}
