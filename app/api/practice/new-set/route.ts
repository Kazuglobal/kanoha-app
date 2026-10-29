import { z } from "zod";
import { SUBJECTS } from "@/lib/curriculum/subjects";
import { createOrGetPracticeSet, type PracticeSetView } from "@/lib/practice/newSet";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { practiceGenerationEnabled } from "@/lib/utils/flags";
import { checkRateLimitDb } from "@/lib/utils/rateLimit";
import { uuid } from "@/lib/utils/schemas";

const schemaValidation = z.object({
  childId: uuid,
  subject: z.enum(SUBJECTS),
  more: z.boolean().optional().default(false),
});

/** 1 分あたりの回数。セットを読むだけ(ホームを開く・教科を切りかえる)は多め、次のセットを作る呼び出しは少なめ。 */
const READ_LIMIT_PER_MINUTE = 60;
const MORE_LIMIT_PER_MINUTE = 10;

/**
 * ホームのカードに要る分だけを返す。問題文・選択肢・聞く英語は 問題を開いたときに画面が受け取る
 * (聞く英語は 答えそのものなので、5 問ぶんを先に渡さない)。答え・ヒント・生成の手がかりは 返さない。
 */
const toPublicSet = (set: PracticeSetView) => ({
  status: "ready" as const,
  batchId: set.batchId,
  seq: set.seq,
  remainingSets: set.remainingSets,
  items: set.items.map(({ problemId, position, done }) => ({ problemId, position, done })),
});

/**
 * 今日の「あたらしい もんだい」のセット(その子の進み具合に合わせた 5 問)を返す。
 * ヒントは既存の POST /api/problems/[id]/hint が 1 段ずつ返す。
 * 「今日はここまで」(上限)と「出す問題がない」は エラーではないので 200 の status で返す。
 */
export async function POST(request: Request) {
  const parsed = await parseJson(request, schemaValidation);
  if (!parsed.success) return apiError("Invalid practice request");
  if (!practiceGenerationEnabled()) return apiError("Not found", 404);
  const { childId, subject, more } = parsed.data;

  const auth = await requireOwnedChild(childId);
  if (auth.response) return auth.response;
  const allowed = more
    ? await checkRateLimitDb(auth.user!.id, "practice-set-more", MORE_LIMIT_PER_MINUTE)
    : await checkRateLimitDb(auth.user!.id, "practice-set", READ_LIMIT_PER_MINUTE);
  if (!allowed) return apiError("Too many requests", 429);

  try {
    const result = await createOrGetPracticeSet(auth.db, { childId, subject, more });
    if (result.ok) return apiSuccess(toPublicSet(result.set));
    return apiSuccess(result.reason === "limit" ? { status: "limit" as const, remainingSets: 0 } : { status: "empty" as const, remainingSets: 0 });
  } catch {
    return internalError();
  }
}
