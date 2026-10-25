import { NextResponse } from "next/server";
import { z } from "zod";
import { buildTranscribePrompt } from "@/lib/ai/prompts";
import { transcribeAudio } from "@/lib/ai/stt";
import { getTalkTurn } from "@/lib/curriculum/englishTalkScenes";
import { bodyTooLarge, parseJsonText, readBodyText, requireUser } from "@/lib/utils/api";
import { todayKeyJst } from "@/lib/utils/date";
import { envNumber } from "@/lib/utils/envNumber";
import { checkRateLimitDb } from "@/lib/utils/rateLimit";

/** 音声 Base64 の最大文字数（約 1.5MB 相当の音声データまで許容） */
const MAX_AUDIO_BASE64_LENGTH = 2_000_000;
const MIN_AUDIO_BASE64_LENGTH = 50;
const DEFAULT_MIME_TYPE = "audio/webm";
const DAY_SECONDS = 86_400;
/** 本文の上限(バイト)。音声(base64 2,000,000文字)に JSON の枠ぶんの余裕を足した値 */
const MAX_BODY_BYTES = MAX_AUDIO_BASE64_LENGTH + 4_096;
/** signedInSharedPerDay: ログイン中の全員でまとめた1日の上限(アカウントを増やしても総量は増えない) */
const LIMITS = { perMinute: 30, perDay: 300, signedInSharedPerDay: 2_000 } as const;
/** ログイン中の全員でまとめた1日の上限。STT_SIGNED_IN_DAILY_LIMIT で調整する。 */
const signedInSharedDailyLimit = (): number => envNumber("STT_SIGNED_IN_DAILY_LIMIT", LIMITS.signedInSharedPerDay);

const schema = z.object({
  audioBase64: z.string().catch(""),
  /** コーデックなどの指定(; 以降)は落とし、基本の型だけを使う */
  mimeType: z
    .string()
    .max(100)
    .transform((value) => value.split(";")[0].trim().toLowerCase())
    .pipe(z.string().regex(/^audio\/[a-z0-9.+-]+$/))
    .catch(DEFAULT_MIME_TYPE),
  lang: z.enum(["en-US", "ja-JP"]).catch("en-US"),
  sceneId: z.string().max(50).catch(""),
  turnId: z.string().max(80).catch(""),
});

const failure = (error: string, status?: number) =>
  NextResponse.json({ success: false, error }, status ? { status } : undefined);

/**
 * リアルタイム英会話 音声認識 (STT) エンドポイント。ログイン中の親セッションだけが使える
 * (子どもの声を未ログインで外部 AI へ送らない・利用量を守るため)。
 * - ブラウザの Web Speech API が使えない環境でのフォールバックとして、録音を Gemini で書き起こす。
 */
export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    if (!user) return failure("Authentication required", 401);
    if (bodyTooLarge(request, MAX_BODY_BYTES)) return failure("Audio data is too large", 413);
    const text = await readBodyText(request, MAX_BODY_BYTES);
    if (text === null) return failure("Audio data is too large", 413);
    const parsed = parseJsonText(text, schema);
    if (!parsed.success) return failure("Audio data is required", 400);
    const { audioBase64, mimeType, lang, sceneId, turnId } = parsed.data;

    if (audioBase64.length < MIN_AUDIO_BASE64_LENGTH) return failure("Audio data is required", 400);
    if (audioBase64.length > MAX_AUDIO_BASE64_LENGTH) return failure("Audio data is too large", 413);

    // 不正な音声で枠を減らされないよう、検証してから枠を使う
    if (
      !(await checkRateLimitDb(user.id, "stt", LIMITS.perMinute)) ||
      !(await checkRateLimitDb(user.id, "stt-daily", LIMITS.perDay, DAY_SECONDS)) ||
      !(await checkRateLimitDb(`signed-in:${todayKeyJst()}`, "stt-daily-global", signedInSharedDailyLimit(), DAY_SECONDS))
    ) {
      return failure("Too many requests", 429);
    }

    const turn = sceneId && turnId ? getTalkTurn(sceneId, turnId) : undefined;
    const transcript = await transcribeAudio({ audioBase64, mimeType, prompt: buildTranscribePrompt(turn, lang) });
    return transcript ? NextResponse.json({ success: true, transcript }) : failure("Speech recognition unavailable");
  } catch {
    return failure("Speech recognition unavailable", 500);
  }
}
