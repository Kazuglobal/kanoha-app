import { NextResponse } from "next/server";
import { z } from "zod";
import { TTS_VOICES, generateGeminiSpeech } from "@/lib/ai/tts";
import { bodyTooLarge, parseJsonText, readBodyText, requireUser } from "@/lib/utils/api";
import { todayKeyJst } from "@/lib/utils/date";
import { clientIpFrom } from "@/lib/utils/clientIp";
import { checkRateLimitDb } from "@/lib/utils/rateLimit";

/** セリフの最大文字数ガード */
const MAX_TEXT_LENGTH = 300;
const DAY_SECONDS = 86_400;
/** 本文の上限(バイト)。セリフは300文字までなので十分に余裕を見ても小さい */
const MAX_BODY_BYTES = 8_192;

/** ログイン中は ユーザーごと。未ログイン(デモ)は IP ごとの上限に加え、全体共通の1日の上限でコストを抑える。 */
const LIMITS = {
  /** signedInSharedPerDay: ログイン中の全員でまとめた1日の上限(アカウントを増やしても総量は増えない) */
  user: { perMinute: 60, perDay: 600, signedInSharedPerDay: 2_000 },
  anonymous: { perMinute: 20, sharedPerDay: 300 },
} as const;

/**
 * 未ログインの1日の共通上限。デモの来訪が多い環境では TTS_ANON_DAILY_LIMIT で調整する(0 なら未ログインの声を止める)。
 * 環境変数は呼び出し時に読む。
 */
const anonymousDailyLimit = (): number => {
  const configured = process.env.TTS_ANON_DAILY_LIMIT;
  const parsed = configured === undefined || configured.trim() === "" ? NaN : Number(configured);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : LIMITS.anonymous.sharedPerDay;
};

/** 全体で共有する1日枠のキー。日本時間の日付ごとに新しくなる(固定24時間の窓だと、使い切った影響が翌日まで残る)。 */
const sharedDailyKey = (name: string): string => `${name}:${todayKeyJst()}`;

const schema = z.object({
  text: z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.slice(0, MAX_TEXT_LENGTH)),
  mood: z.enum(["happy", "celebrate", "think"]).catch("happy"),
  voiceName: z.enum(TTS_VOICES).catch("Aoede"),
  lang: z.enum(["ja", "en"]).catch("ja"),
});

const TTS_UNAVAILABLE = "Speech synthesis unavailable";

const failure = (error: string, status: number) =>
  NextResponse.json({ success: false, fallback: true, error }, { status });

async function withinLimits(request: Request, userId: string | null): Promise<boolean> {
  if (userId) {
    return (
      (await checkRateLimitDb(userId, "tts", LIMITS.user.perMinute)) &&
      (await checkRateLimitDb(userId, "tts-daily", LIMITS.user.perDay, DAY_SECONDS)) &&
      (await checkRateLimitDb(sharedDailyKey("signed-in"), "tts-daily-global", LIMITS.user.signedInSharedPerDay, DAY_SECONDS))
    );
  }
  return (
    (await checkRateLimitDb(`ip:${clientIpFrom(request)}`, "tts", LIMITS.anonymous.perMinute)) &&
    (await checkRateLimitDb(sharedDailyKey("anonymous"), "tts-daily", anonymousDailyLimit(), DAY_SECONDS))
  );
}

export async function POST(request: Request) {
  try {
    if (bodyTooLarge(request, MAX_BODY_BYTES)) return failure("Request too large", 413);

    // 不正なリクエストで共通の枠を減らされないよう、検証してから枠を使う
    const text = await readBodyText(request, MAX_BODY_BYTES);
    if (text === null) return failure("Request too large", 413);
    const parsed = parseJsonText(text, schema);
    if (!parsed.success) return NextResponse.json({ error: "Text is required" }, { status: 400 });

    const { user } = await requireUser();
    if (!(await withinLimits(request, user?.id ?? null))) return failure("Too many requests", 429);

    const result = await generateGeminiSpeech(parsed.data);
    // 上流のエラー内容は返さない。失敗時は固定の形で、声なし(口パクだけ)に切り替えさせる
    return result.success ? NextResponse.json(result) : failure(TTS_UNAVAILABLE, 200);
  } catch {
    return failure(TTS_UNAVAILABLE, 500);
  }
}
