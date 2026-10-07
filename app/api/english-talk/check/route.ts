import { z } from "zod";
import { getAiProvider } from "@/lib/ai";
import { costLimitsFromEnv } from "@/lib/ai/costGuard";
import { englishTalkJudgeSchema, TEXT_LIMITS } from "@/lib/ai/schemas";
import { reserveAiUsage } from "@/lib/ai/usage";
import { getTalkTurn, type TalkTurn } from "@/lib/curriculum/englishTalkScenes";
import { judgeTalkAnswer } from "@/lib/englishTalk/judge";
import { apiError, apiSuccess, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { checkRateLimit } from "@/lib/utils/rateLimit";
import { uuid } from "@/lib/utils/schemas";

const schema = z.object({
  sceneId: z.string().trim().min(1).max(50),
  turnId: z.string().trim().min(1).max(80),
  answer: z.string().trim().min(1).max(TEXT_LIMITS.answer),
  /** choice: 4択 / voice: 声のこたえ / repeat: 正しい言い方のまね */
  mode: z.enum(["choice", "voice", "repeat"]),
  childId: uuid.optional().nullable(),
});

const JUDGE_COST_USD = Number(process.env.AI_ENGLISH_TALK_COST_USD ?? 0.0005);

export interface EnglishTalkCheckResult {
  correct: boolean;
  feedback?: string;
  /** まちがえたときだけ返す(正しい言い方を教える) */
  modelAnswer?: string;
  modelAnswerJa?: string;
}

/**
 * 英会話れんしゅうの答え合わせ。判定キーはサーバーだけが持つ。
 * 声のこたえがキーワードに合わないときだけ、ログイン中(子どもの所有確認つき)なら AI でゆるく判定する。
 * 子どもの答えは保存もログ出力もしない。
 */
export async function POST(request: Request) {
  const parsed = await parseJson(request, schema);
  if (!parsed.success) return apiError("Invalid check request");
  const { sceneId, turnId, answer, mode, childId } = parsed.data;

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  if (!checkRateLimit(`english-talk:${childId ?? forwarded}`, 120)) {
    return apiError("Too many requests", 429);
  }

  const turn = getTalkTurn(sceneId, turnId);
  if (!turn) return apiError("Turn not found", 404);

  if (judgeTalkAnswer(turn, answer)) return apiSuccess<EnglishTalkCheckResult>({ correct: true });

  const aiCorrect = mode === "voice" && childId ? await judgeWithAi(childId, turn, answer) : null;
  if (aiCorrect) return apiSuccess<EnglishTalkCheckResult>(aiCorrect);

  return apiSuccess<EnglishTalkCheckResult>({
    correct: false,
    modelAnswer: turn.modelAnswer,
    modelAnswerJa: turn.modelAnswerJa,
  });
}

/** AI で正解と判定できたときだけ結果を返す(上限・失敗・不正な出力は null = キーワード判定のまま)。 */
async function judgeWithAi(
  childId: string,
  turn: TalkTurn,
  answer: string,
): Promise<EnglishTalkCheckResult | null> {
  const provider = getAiProvider();
  if (provider.name === "mock") return null;

  const auth = await requireOwnedChild(childId);
  if (auth.response || !auth.user) return null;

  const reservation = await reserveAiUsage(auth.user.id, JUDGE_COST_USD, costLimitsFromEnv(), auth.db);
  if (reservation.outcome !== "allowed") return null;

  try {
    const raw = await provider.judgeEnglishTalk({
      question: turn.prompt,
      modelAnswer: turn.modelAnswer,
      answer,
    });
    const validated = englishTalkJudgeSchema.safeParse(raw);
    if (!validated.success || !validated.data.correct) return null;
    return { correct: true, feedback: validated.data.feedback };
  } catch {
    return null;
  }
}
