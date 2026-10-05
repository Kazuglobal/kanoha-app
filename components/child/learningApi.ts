/**
 * 学習フローが使う API クライアント(W6)。
 * すべて失敗時に null を返し、呼び出し側が「もういちど ためす」を出す。
 */

export const postJson = (url: string, body: Record<string, unknown>) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export interface DailyLimitInfo {
  limitMinutes: number;
  usedMinutes: number;
  limitReached: boolean;
}

export interface SessionStartResult extends DailyLimitInfo {
  id?: string;
}

export async function startLearningSession(childId: string): Promise<SessionStartResult | null> {
  const response = await postJson("/api/sessions", { childId }).catch(() => null);
  const body = await response?.json().catch(() => null);
  if (!response?.ok || !body?.success) return null;
  return body.data as SessionStartResult;
}

/** ヒントを 1 段だけ取る。level の検証はサーバーが行う(A2)。 */
export async function fetchHintText(
  problemId: string,
  body: Record<string, unknown>,
): Promise<string | null> {
  const response = await postJson(`/api/problems/${problemId}/hint`, body).catch(() => null);
  const json = await response?.json().catch(() => null);
  if (!response?.ok || !json?.success || typeof json.data?.text !== "string") return null;
  return json.data.text;
}

export interface FetchedSimilarProblem {
  id: string;
  question: string;
  choices: readonly string[] | null;
  listenText?: string;
}

export async function fetchSimilarProblems(
  childId: string,
  problemId: string,
): Promise<readonly FetchedSimilarProblem[] | null> {
  const response = await postJson("/api/ai/generate-similar-problems", { childId, problemId }).catch(() => null);
  const body = await response?.json().catch(() => null);
  if (!response?.ok || !body?.success || !Array.isArray(body.data)) return null;
  return body.data.map(
    (item: { id: string; problem_text: string; choices?: string[] | null; listen_text?: string | null }) => ({
      id: item.id,
      question: item.problem_text,
      choices: Array.isArray(item.choices) ? item.choices : null,
      ...(item.listen_text ? { listenText: item.listen_text } : {}),
    }),
  );
}

export interface AttemptResult {
  correct: boolean;
  explanation: string | null;
  /** 元問題の正解でサーバーが記録したごほうび(それ以外は null) */
  reward?: unknown;
}

/** 正誤はサーバー(/api/attempts)が判定して返す。 */
export async function postAttempt(body: Record<string, unknown>): Promise<AttemptResult | null> {
  const response = await postJson("/api/attempts", body).catch(() => null);
  const json = await response?.json().catch(() => null);
  if (!response?.ok || !json?.success) return null;
  return {
    correct: Boolean(json.data.is_correct),
    explanation: typeof json.data.explanation === "string" ? json.data.explanation : null,
    reward: json.data.reward ?? null,
  };
}

/** 未ログイン(デモ)の答え合わせ。答えはサーバーだけが持つ(A2)。 */
export async function checkDemoAnswer(checkId: string, answer: string): Promise<AttemptResult | null> {
  const response = await postJson("/api/demo/check", { checkId, answer }).catch(() => null);
  const json = await response?.json().catch(() => null);
  if (!response?.ok || !json?.success) return null;
  return {
    correct: Boolean(json.data.correct),
    explanation: typeof json.data.explanation === "string" ? json.data.explanation : null,
  };
}

export async function fetchDailyLimit(childId: string): Promise<DailyLimitInfo | null> {
  const response = await fetch(`/api/sessions?childId=${encodeURIComponent(childId)}`).catch(() => null);
  const body = await response?.json().catch(() => null);
  if (!response?.ok || !body?.success) return null;
  return body.data as DailyLimitInfo;
}

export const elapsedSeconds = (startedAt: number): number =>
  Math.max(1, Math.round((Date.now() - startedAt) / 1000));

/**
 * タブが閉じられる・隠れるときにセッション時間を記録する(keepalive)。
 * sendBeacon は POST 固定のため、fetch の keepalive で PATCH を送る。
 */
export function sendSessionKeepalive(sessionId: string, childId: string, startedAt: number): void {
  void fetch(`/api/sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ childId, durationSeconds: elapsedSeconds(startedAt) }),
    keepalive: true,
  }).catch(() => null);
}
