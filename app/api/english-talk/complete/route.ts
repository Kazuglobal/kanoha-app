import { z } from "zod";
import { getTalkScene } from "@/lib/curriculum/englishTalkScenes";
import { recordSceneClear } from "@/lib/englishTalk/serverProgress";
import { talkStars } from "@/lib/englishTalk/score";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { checkRateLimitDb } from "@/lib/utils/rateLimit";
import { uuid } from "@/lib/utils/schemas";

const schemaValidation = z.object({
  childId: uuid,
  sceneId: z.string().trim().min(1).max(50),
  /** 1 回の挑戦の ID(端末が決める UUID)。通信が失われて同じ挑戦が再送されても、回数を二重に数えない。 */
  runId: uuid,
  outcomes: z
    .array(z.object({ turnId: z.string().trim().min(1).max(80), outcome: z.enum(["clean", "help", "teach"]) }))
    .min(1)
    .max(12),
});

const RATE_LIMIT_PER_MINUTE = 20;

/**
 * 英会話の場面をクリアしたことを記録する。★は端末の申告を使わず、ターンごとの結果(clean / help / teach)から
 * サーバーで計算する。結果は その場面のターンぜんぶが 1 回ずつ そろっているときだけ受け付ける。
 * 話した言葉は受け取らない・保存しない。
 */
export async function POST(request: Request) {
  const parsed = await parseJson(request, schemaValidation);
  if (!parsed.success) return apiError("Invalid completion");
  const { childId, sceneId, runId, outcomes } = parsed.data;

  const auth = await requireOwnedChild(childId);
  if (auth.response) return auth.response;
  if (!(await checkRateLimitDb(auth.user!.id, "english-talk-complete", RATE_LIMIT_PER_MINUTE))) {
    return apiError("Too many requests", 429);
  }

  const scene = getTalkScene(sceneId);
  if (!scene) return apiError("Scene not found", 404);
  const expected = new Set(scene.turns.map((turn) => turn.id));
  const sent = outcomes.map((item) => item.turnId);
  if (sent.length !== expected.size || new Set(sent).size !== sent.length || sent.some((id) => !expected.has(id))) {
    return apiError("Invalid completion");
  }

  const stars = talkStars(outcomes.map((item) => item.outcome));
  try {
    const clear = await recordSceneClear(auth.db, childId, sceneId, stars, runId);
    return apiSuccess({ stars, bestStars: clear.bestStars, clearCount: clear.clearCount });
  } catch {
    return internalError();
  }
}
