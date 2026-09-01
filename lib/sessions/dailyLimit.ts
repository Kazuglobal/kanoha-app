import { jstDayRange } from "@/lib/utils/date";

/** learning_sessions の当日分。未終了(ended_at null)は now - started_at で計上する。 */
export interface SessionUsage {
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
}

export interface DailyLimitStatus {
  limitMinutes: number;
  usedMinutes: number;
  remainingMinutes: number;
  limitReached: boolean;
}

const secondsBetween = (start: string, now: Date): number =>
  Math.max(0, Math.floor((now.getTime() - new Date(start).getTime()) / 1000));

/** 当日のセッションが使った秒数。終了済みは duration_seconds、進行中は経過時間。 */
export const usedSecondsToday = (sessions: readonly SessionUsage[], now: Date = new Date()): number =>
  sessions.reduce(
    (sum, session) =>
      sum + (session.ended_at ? session.duration_seconds : secondsBetween(session.started_at, now)),
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

/** Asia/Tokyo day window for a session query. Delegates to lib/utils/date. */
export function tokyoDayRange(now = new Date()) {
  return jstDayRange(now);
}
