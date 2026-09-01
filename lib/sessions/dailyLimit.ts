import { jstDayRange } from "@/lib/utils/date";

/**
 * learning_sessions の当日分。
 * 未終了(ended_at null)は「最後の attempt(無ければ started_at)+ 猶予」までしか計上しない。
 * タブを閉じたまま放置されたセッションが、その日の残り時間を食いつぶさないため(T011)。
 */
export interface SessionUsage {
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  /** そのセッションで最後に保存された attempts.created_at(無ければ null / 省略)。 */
  last_attempt_at?: string | null;
}

export interface DailyLimitStatus {
  limitMinutes: number;
  usedMinutes: number;
  remainingMinutes: number;
  limitReached: boolean;
}

/** 未終了セッションを「最後の操作から」有効とみなす猶予。 */
export const OPEN_SESSION_GRACE_MINUTES = 10;
export const OPEN_SESSION_GRACE_MS = OPEN_SESSION_GRACE_MINUTES * 60_000;

const timeOf = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
};

/**
 * 未終了セッションの計上秒数:
 *   min(now, max(last_attempt_at ?? started_at, started_at) + grace) - started_at
 * 操作中(猶予内)は経過時間そのもの、放置後は最後の操作 + 猶予で打ち切る。
 */
export const openSessionSeconds = (session: SessionUsage, now: Date): number => {
  const startedAt = timeOf(session.started_at);
  if (startedAt === null) return 0;
  const lastActivity = Math.max(timeOf(session.last_attempt_at) ?? startedAt, startedAt);
  const countedUntil = Math.min(now.getTime(), lastActivity + OPEN_SESSION_GRACE_MS);
  return Math.max(0, Math.floor((countedUntil - startedAt) / 1000));
};

/** 当日のセッションが使った秒数。終了済みは duration_seconds、進行中は猶予つき経過時間。 */
export const usedSecondsToday = (sessions: readonly SessionUsage[], now: Date = new Date()): number =>
  sessions.reduce(
    (sum, session) =>
      sum + (session.ended_at ? session.duration_seconds : openSessionSeconds(session, now)),
    0,
  );

export function dailyLimitStatus(limitMinutes: number, usedSeconds: number): DailyLimitStatus {
  if (limitMinutes < 0 || usedSeconds < 0) throw new RangeError("limit and usage must be non-negative");
  const usedMinutes = Math.ceil(usedSeconds / 60);
  return {
    limitMinutes,
    usedMinutes,
    remainingMinutes: Math.max(0, limitMinutes - usedMinutes),
    limitReached: usedSeconds >= limitMinutes * 60,
  };
}

/** セッション一覧から当日の上限状態を求める(routes と lib/review/today.ts の共通経路)。 */
export const dailyLimitFromSessions = (
  limitMinutes: number,
  sessions: readonly SessionUsage[],
  now: Date = new Date(),
): DailyLimitStatus => dailyLimitStatus(limitMinutes, usedSecondsToday(sessions, now));

/** attempts(session_id, created_at)から、セッションごとの最新 created_at を求める。 */
export const lastAttemptBySession = (
  attempts: readonly { session_id: string; created_at: string }[],
): ReadonlyMap<string, string> =>
  attempts.reduce<Map<string, string>>((map, attempt) => {
    const current = map.get(attempt.session_id);
    const later = !current || (timeOf(attempt.created_at) ?? 0) > (timeOf(current) ?? 0);
    return later ? new Map(map).set(attempt.session_id, attempt.created_at) : map;
  }, new Map());

export interface SessionRow extends SessionUsage {
  id: string;
}

/** 未終了セッションの id(attempts の最終時刻を引くための問い合わせキー)。 */
export const openSessionIds = (sessions: readonly SessionRow[]): string[] =>
  sessions.filter((session) => !session.ended_at).map((session) => session.id);

/** セッション行に、そのセッションの最終 attempt 時刻を付ける。 */
export const withLastAttempts = (
  sessions: readonly SessionRow[],
  lastAttempts: ReadonlyMap<string, string>,
): SessionUsage[] =>
  sessions.map((session) => ({ ...session, last_attempt_at: lastAttempts.get(session.id) ?? null }));

/** Asia/Tokyo day window for a session query. Delegates to lib/utils/date. */
export function tokyoDayRange(now = new Date()) {
  return jstDayRange(now);
}
