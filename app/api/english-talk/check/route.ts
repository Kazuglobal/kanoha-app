import { z } from "zod";
import { getAiProvider } from "@/lib/ai";
import { costLimitsFromEnv } from "@/lib/ai/costGuard";
import { englishTalkJudgeSchema, TEXT_LIMITS } from "@/lib/ai/schemas";
import { reserveAiUsage } from "@/lib/ai/usage";
import { getTalkTurn, type TalkTurn } from "@/lib/curriculum/englishTalkScenes";
import { adaptTurn, FRUIT_IDS } from "@/lib/englishTalk/context";
import { buildCorrectiveFeedbackEn, isDontKnowAnswer, judgeTalk } from "@/lib/englishTalk/judge";
import { classifyUtterance } from "@/lib/englishTalk/normalize";
import type { RewardState } from "@/lib/rewards/rewardLogic";
import { recordEnglishTalkClear } from "@/lib/rewards/serverRewards";
import { apiError, apiSuccess, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { clientIpFrom } from "@/lib/utils/clientIp";
import { envNumber } from "@/lib/utils/envNumber";
import { checkRateLimit } from "@/lib/utils/rateLimit";
import { uuid } from "@/lib/utils/schemas";

const schema = z.object({
  sceneId: z.string().trim().min(1).max(50),
  turnId: z.string().trim().min(1).max(80),
  answer: z.string().trim().min(1).max(TEXT_LIMITS.answer),
  /** choice: 4択 / voice: 声や文字のこたえ / repeat: 正しい言い方のまね */
  mode: z.enum(["choice", "voice", "repeat"]),
  childId: uuid.optional().nullable(),
  /** そのターンを1回目でできたという端末の申告。信頼はせず、実際の上限は サーバーの 子ども×ターン×日 に1回(reward_claims) */
  firstTry: z.boolean().optional(),
  /** 画面で問いが変わっているとき(おみせで選んだ くだもの)の文脈。決まった ID だけ受け取る */
  context: z.object({ fruit: z.enum(FRUIT_IDS).nullish() }).optional(),
});

/** AI 判定 1 回ぶんの見込み費用(USD)。環境変数はリクエストごとに読む(Workers ではリクエスト時にしか確定しない)。 */
const judgeCostUsd = (): number => envNumber("AI_ENGLISH_TALK_COST_USD", 0.0005);

export interface EnglishTalkCheckResult {
  correct: boolean;
  /** 「I don't know」「わからない」と声で言ったとき true */
  isDontKnow?: boolean;
  /** 日本語だけの答え。まちがいにはせず、英語で言ってもらう */
  needsEnglish?: boolean;
  /** 聞き取れなかった(記号だけ・書き起こしの印だけ)。まちがいにはせず、もう一度言ってもらう */
  unclear?: boolean;
  feedback?: string;
  /** まちがえたときに英語で即座に返すフィードバックセリフ */
  feedbackEn?: string;
  /** まちがえたときだけ返す(正しい言い方を教える) */
  modelAnswer?: string;
  modelAnswerJa?: string;
  /** ごほうびが増えたときだけ、増えたあとの状態(ログイン中の、1日の上限までの正解) */
  reward?: RewardState;
}

/**
 * 英会話れんしゅうの答え合わせ。判定キーはサーバーだけが持つ。
 * 声のこたえがキーワードに合わないとき、答えが決まっていない問い(aiJudge)で英語の答えなら、
 * ログイン中(子どもの所有確認つき)だけ AI でゆるく判定する。
 * 子どもの答えは保存もログ出力もしない。
 */
export async function POST(request: Request) {
  const parsed = await parseJson(request, schema);
  if (!parsed.success) return apiError("Invalid check request");
  const { sceneId, turnId, answer, mode, childId, firstTry, context } = parsed.data;

  // 端末が送る childId や x-forwarded-for は偽装できるので、制限のキーには使わない
  if (!checkRateLimit(`english-talk:${clientIpFrom(request)}`, 120)) {
    return apiError("Too many requests", 429);
  }

  const turn = getTalkTurn(sceneId, turnId);
  if (!turn) return apiError("Turn not found", 404);

  if (mode === "voice" && isDontKnowAnswer(answer)) {
    return apiSuccess<EnglishTalkCheckResult>({ correct: false, isDontKnow: true });
  }

  const judged = judgeTalk(turn, answer, mode);
  if (judged.invalidChoice) return apiError("Invalid choice");

  const claim = { childId, sceneId, turnId, rewardable: firstTry === true && mode !== "repeat" };
  if (judged.correct) return apiSuccess<EnglishTalkCheckResult>(await withReward({ correct: true }, claim));
  if (judged.needsEnglish) return apiSuccess<EnglishTalkCheckResult>({ correct: false, needsEnglish: true });
  if (judged.unclear) return apiSuccess<EnglishTalkCheckResult>({ correct: false, unclear: true });

  const askAi = mode === "voice" && Boolean(childId) && turn.aiJudge === true && classifyUtterance(answer).kind === "english";
  const aiCorrect = askAi ? await judgeWithAi(childId!, adaptTurn(turn, context), answer) : null;
  if (aiCorrect) return apiSuccess<EnglishTalkCheckResult>(await withReward(aiCorrect, claim));

  return apiSuccess<EnglishTalkCheckResult>({
    correct: false,
    ...(mode === "voice" ? { feedbackEn: buildCorrectiveFeedbackEn(turn) } : {}),
    modelAnswer: turn.modelAnswer,
    modelAnswerJa: turn.modelAnswerJa,
  });
}

/**
 * ログイン中(子どもの所有確認つき)で、1回目の正解のときだけ、1日1ターン1回・1日の上限まで ごほうびを数える。
 * 数えられなくても答え合わせは失敗させない。
 */
async function withReward(
  result: EnglishTalkCheckResult,
  claim: { childId?: string | null; sceneId: string; turnId: string; rewardable: boolean },
): Promise<EnglishTalkCheckResult> {
  if (!claim.childId || !claim.rewardable) return result;
  const auth = await requireOwnedChild(claim.childId);
  if (auth.response) return result;
  try {
    const reward = await recordEnglishTalkClear(auth.db, claim.childId, claim.sceneId, claim.turnId);
    return reward ? { ...result, reward } : result;
  } catch {
    return result;
  }
}

/** AI で正解と判定できたときだけ結果を返す(上限・失敗・不正な出力は null = キーワード判定のまま)。 */
async function judgeWithAi(
  childId: string,
  turn: Pick<TalkTurn, "prompt" | "modelAnswer">,
  answer: string,
): Promise<EnglishTalkCheckResult | null> {
  const provider = getAiProvider();
  if (provider.name === "mock") return null;

  const auth = await requireOwnedChild(childId);
  if (auth.response || !auth.user) return null;

  const reservation = await reserveAiUsage(auth.user.id, judgeCostUsd(), costLimitsFromEnv(), auth.db);
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
