import { jstDayRange } from "@/lib/utils/date";

export function dailyLimitStatus(limitMinutes: number, durationSeconds: readonly number[]) {
  const usedSeconds = durationSeconds.reduce((sum, duration) => sum + duration, 0);
  return {
    limitMinutes,
    usedMinutes: Math.ceil(usedSeconds / 60),
    reached: usedSeconds >= limitMinutes * 60,
  };
}

/** Asia/Tokyo day window for a session query. Delegates to lib/utils/date. */
export function tokyoDayRange(now = new Date()) {
  return jstDayRange(now);
}
