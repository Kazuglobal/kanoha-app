/**
 * Single source of truth for calendar dates in the app.
 * Every "today", `report_date`, `scheduled_for`, and `usage_date` is
 * computed in Asia/Tokyo regardless of the server's local time zone.
 */
const JST_TIME_ZONE = "Asia/Tokyo";
const DAY_MS = 86_400_000;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const jstFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: JST_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const assertValidDate = (date: Date): void => {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("date must be a valid Date");
  }
};

const assertDateKey = (dateKey: string): void => {
  if (!DATE_KEY_PATTERN.test(dateKey) || Number.isNaN(Date.parse(`${dateKey}T00:00:00Z`))) {
    throw new RangeError("dateKey must be formatted as YYYY-MM-DD");
  }
};

/** Formats an instant as its Asia/Tokyo calendar date (`YYYY-MM-DD`). */
export const toJstDateKey = (date: Date): string => {
  assertValidDate(date);
  return jstFormatter.format(date);
};

/** Today's Asia/Tokyo calendar date. */
export const todayKeyJst = (now: Date = new Date()): string => toJstDateKey(now);

/** Current ISO timestamp string. */
export const nowJstIso = (now: Date = new Date()): string => now.toISOString();

/** Adds whole days to a `YYYY-MM-DD` key in Asia/Tokyo (no DST, so day arithmetic is exact). */
export const addDaysJst = (dateKey: string, days: number): string => {
  assertDateKey(dateKey);
  if (!Number.isInteger(days)) {
    throw new RangeError("days must be an integer");
  }
  const noonJst = new Date(`${dateKey}T12:00:00+09:00`);
  return toJstDateKey(new Date(noonJst.getTime() + days * DAY_MS));
};

/** The `[start, end)` instants of the Asia/Tokyo day containing `now`, as ISO strings. */
export const jstDayRange = (now: Date = new Date()): { start: string; end: string } => {
  const start = new Date(`${toJstDateKey(now)}T00:00:00+09:00`);
  return {
    start: start.toISOString(),
    end: new Date(start.getTime() + DAY_MS).toISOString(),
  };
};
