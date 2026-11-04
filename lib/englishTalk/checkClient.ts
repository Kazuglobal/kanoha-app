/**
 * 英会話れんしゅうの答え合わせ(POST /api/english-talk/check)を呼ぶブラウザ側の関数。
 * 失敗の種類を分けて返すので、画面は「やすもう」「つながらなかった」を言い分けられる。
 */

import type { SceneStars, TalkOutcome } from "./score";

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

export interface TalkCompleteRequest {
  childId: string;
  sceneId: string;
  /** 1 回の挑戦の ID。同じ挑戦を送りなおしても、サーバーは回数を二重に数えない。 */
  runId: string;
  outcomes: readonly { turnId: string; outcome: TalkOutcome }[];
}

export interface TalkCompleteResult {
  stars: SceneStars;
  bestStars: SceneStars;
  clearCount: number;
}

/** 挑戦ごとの ID(UUID の形)。 */
export function newRunId(): string {
  const random = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  if (random) return random();
  const hex = (length: number) => Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${"89ab"[Math.floor(Math.random() * 4)]}${hex(3)}-${hex(12)}`;
}

/** 通信の失敗や一時的なサーバーの失敗のあと、送りなおすまで待つ時間。 */
const COMPLETE_RETRY_DELAY_MS = 1_500;
/** 送りなおしても通らない応答(入力・ログイン・所有・回数制限)。 */
const NO_RETRY_STATUS: ReadonlySet<number> = new Set([400, 401, 403, 404, 429]);

type CompleteAttempt = { result: TalkCompleteResult | null; retry: boolean };

async function sendComplete(request: TalkCompleteRequest): Promise<CompleteAttempt> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    // keepalive: 最後の答えのすぐあとにタブを閉じても、送りきれるようにする(本文は小さい)
    const response = await fetch("/api/english-talk/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      keepalive: true,
      signal: controller.signal,
    });
    if (NO_RETRY_STATUS.has(response.status)) return { result: null, retry: false };
    const json = await response.json().catch(() => null);
    return response.ok && json?.success ? { result: json.data as TalkCompleteResult, retry: false } : { result: null, retry: true };
  } catch {
    return { result: null, retry: true };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 場面のクリアをサーバーへ記録する(POST /api/english-talk/complete)。★はサーバーがターンごとの結果から計算する。
 * 通信の失敗・一時的なサーバーの失敗は、少し待って 1 回だけ同じ挑戦の ID で送りなおす(サーバーは二重に数えない)。
 * それでも失敗したら null(画面は止めない。端末の記録は残っている)。
 */
export async function postTalkComplete(request: TalkCompleteRequest, options: { retryDelayMs?: number } = {}): Promise<TalkCompleteResult | null> {
  const first = await sendComplete(request);
  if (first.result || !first.retry) return first.result;
  await new Promise((resolve) => setTimeout(resolve, options.retryDelayMs ?? COMPLETE_RETRY_DELAY_MS));
  return (await sendComplete(request)).result;
}
