import { z } from "zod";
import { checkDemoAnswer } from "@/lib/curriculum/demoCheck";
import { TEXT_LIMITS } from "@/lib/ai/schemas";
import { apiError, apiSuccess, parseJson } from "@/lib/utils/api";
import { clientIpFrom } from "@/lib/utils/clientIp";
import { checkRateLimit } from "@/lib/utils/rateLimit";

const schema = z.object({
  checkId: z.string().trim().min(1).max(100),
  answer: z.string().trim().min(1).max(TEXT_LIMITS.answer),
});

/**
 * 未ログイン(デモ)の答え合わせ(A2)。答えはクライアントへ渡さず、正誤と(まちがえたときの)解説だけ返す。
 * 公開の問題バンクだけが対象で、記録は残さない。
 */
export async function POST(request: Request) {
  const parsed = await parseJson(request, schema);
  if (!parsed.success) return apiError("Invalid check request");
  if (!checkRateLimit(`demo-check:${clientIpFrom(request)}`, 120)) return apiError("Too many requests", 429);

  const result = checkDemoAnswer(parsed.data.checkId, parsed.data.answer);
  if (!result) return apiError("Problem not found", 404);
  return apiSuccess(result);
}
