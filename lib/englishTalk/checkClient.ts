/**
 * 英会話れんしゅうの答え合わせ(POST /api/english-talk/check)を呼ぶブラウザ側の関数。
 * 失敗の種類を分けて返すので、画面は「やすもう」「つながらなかった」を言い分けられる。
 */

export type CheckMode = "choice" | "voice" | "repeat";

export interface CheckRequest {
  sceneId: string;
  turnId: string;
  answer: string;
  mode: CheckMode;
  childId?: string;
  firstTry?: boolean;
  /** 画面で問いが変わっているときの文脈(おみせで選んだ くだもの) */
  context?: { fruit: string };
}

export interface CheckResult {
  correct: boolean;
  isDontKnow?: boolean;
  /** 日本語だけの答え(まちがいにはせず、英語で言ってもらう) */
  needsEnglish?: boolean;
  /** 聞き取れなかった(まちがいにはせず、もう一度言ってもらう) */
  unclear?: boolean;
  feedback?: string;
  feedbackEn?: string;
  modelAnswer?: string;
  modelAnswerJa?: string;
  /** ログイン中、サーバーがごほうびを数えたときだけ付く(増えたあとの状態) */
  reward?: unknown;
}

export type CheckFailure = "rate_limited" | "offline" | "server";

export type CheckOutcome = { ok: true; data: CheckResult } | { ok: false; reason: CheckFailure };

/** 返事を待つ長さ。これを過ぎたら「つながらなかった」にして、画面が固まらないようにする。 */
const CHECK_TIMEOUT_MS = 10_000;

export async function postCheck(request: CheckRequest): Promise<CheckOutcome> {
  let response: Response;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    response = await fetch("/api/english-talk/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
  } catch {
    return { ok: false, reason: "offline" };
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 429) return { ok: false, reason: "rate_limited" };
  const json = await response.json().catch(() => null);
  return response.ok && json?.success ? { ok: true, data: json.data as CheckResult } : { ok: false, reason: "server" };
}
