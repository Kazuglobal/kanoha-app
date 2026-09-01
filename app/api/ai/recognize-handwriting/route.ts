import { z } from "zod";
import { getAiProvider } from "@/lib/ai";
import { costLimitsFromEnv } from "@/lib/ai/costGuard";
import { reserveAiUsage } from "@/lib/ai/usage";
import { apiError, apiSuccess, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { checkRateLimit } from "@/lib/utils/rateLimit";
import { ownedProblem } from "@/lib/utils/resources";
import { uuid } from "@/lib/utils/schemas";

/** base64 で約1.5MBの画像に相当する上限。巨大ペイロードでのメモリ圧迫を防ぐ。 */
const MAX_IMAGE_DATA_CHARS = 2_000_000;

const schema = z.object({
  childId: uuid,
  problemId: uuid,
  image: z.object({
    data: z.string().min(1).max(MAX_IMAGE_DATA_CHARS),
    mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  }),
});

const RECOGNIZE_COST_USD = Number(process.env.AI_RECOGNIZE_COST_USD ?? 0.005);

const MAGIC_CHECKS: Record<string, (bytes: Buffer) => boolean> = {
  "image/png": (bytes) =>
    bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47,
  "image/jpeg": (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  "image/webp": (bytes) =>
    bytes.length >= 12 &&
    bytes.toString("latin1", 0, 4) === "RIFF" &&
    bytes.toString("latin1", 8, 12) === "WEBP",
};

/** 宣言された mimeType と base64 先頭のマジックバイトが一致するか検証する(なりすまし対策)。 */
function matchesDeclaredType(data: string, mimeType: string): boolean {
  try {
    const prefix = Buffer.from(data.slice(0, 32), "base64");
    return MAGIC_CHECKS[mimeType]?.(prefix) ?? false;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const parsed = await parseJson(request, schema);
  if (!parsed.success) return apiError("Invalid handwriting request");
  if (!matchesDeclaredType(parsed.data.image.data, parsed.data.image.mimeType)) {
    return apiError("Invalid handwriting request");
  }
  const auth = await requireOwnedChild(parsed.data.childId);
  if (auth.response) return auth.response;
  if (!checkRateLimit(`handwriting:${auth.user!.id}`, 10)) return apiError("Too many requests", 429);

  const problem = await ownedProblem(auth.supabase, parsed.data.childId, parsed.data.problemId);
  if (!problem) return apiError("Problem not found", 404);

  const provider = getAiProvider();
  if (provider.name === "mock") {
    const result = await provider.recognizeHandwriting([], problem.problem_text);
    return apiSuccess(result);
  }

  // 予約はプロバイダ呼び出しの「前」。RPC不通は 503(フェイルクローズ、B10)。
  const reservation = await reserveAiUsage(auth.supabase, auth.user!.id, RECOGNIZE_COST_USD, costLimitsFromEnv());
  if (reservation.outcome === "unavailable") {
    return apiError("AIをいまは つかえないよ。すうじで にゅうりょくしてね。", 503);
  }
  if (reservation.outcome === "denied") {
    return apiError("AIの利用上限に達しました。すうじで にゅうりょくしてね。", 429);
  }

  try {
    const result = await provider.recognizeHandwriting(
      [{ data: parsed.data.image.data, mimeType: parsed.data.image.mimeType }],
      problem.problem_text,
    );
    return apiSuccess(result);
  } catch {
    return apiError("てがきを よみとれなかったよ。すうじで にゅうりょくしてね。", 502);
  }
}
