import { z } from "zod";
import { SUBJECTS } from "@/lib/curriculum/subjects";
import { createOrGetPracticeSet } from "@/lib/practice/newSet";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { practiceGenerationEnabled } from "@/lib/utils/flags";
import { checkRateLimitDb } from "@/lib/utils/rateLimit";
import { uuid } from "@/lib/utils/schemas";

const schemaValidation = z.object({
  childId: uuid,
  subject: z.enum(SUBJECTS),
  more: z.boolean().optional().default(false),
});

/** 1 分あたりの回数。リロードは同じセットを返すだけなので、ふつうに使えばこの数には届かない。 */
const RATE_LIMIT_PER_MINUTE = 10;

/**
 * 今日の「あたらしい もんだい」のセット(その子の進み具合に合わせた 5 問)を返す。
 * 返すのは 問題文・単元・選択肢・聞く英語だけ。答えとヒントは サーバーに置き、ヒントは既存の
 * POST /api/problems/[id]/hint が 1 段ずつ返す。
 * 「今日はここまで」(上限)と「出す問題がない」は エラーではないので 200 の status で返す。
 */
export async function POST(request: Request) {
  const parsed = await parseJson(request, schemaValidation);
  if (!parsed.success) return apiError("Invalid practice request");
  if (!practiceGenerationEnabled()) return apiError("Not found", 404);
  const { childId, subject, more } = parsed.data;

  const auth = await requireOwnedChild(childId);
  if (auth.response) return auth.response;
  if (!(await checkRateLimitDb(auth.user!.id, "practice-set", RATE_LIMIT_PER_MINUTE))) {
    return apiError("Too many requests", 429);
  }

  try {
    const result = await createOrGetPracticeSet(auth.db, { childId, subject, more });
    if (result.ok) return apiSuccess({ status: "ready" as const, ...result.set });
    return apiSuccess(result.reason === "limit" ? { status: "limit" as const, remainingSets: 0 } : { status: "empty" as const, remainingSets: 0 });
  } catch {
    return internalError();
  }
}
