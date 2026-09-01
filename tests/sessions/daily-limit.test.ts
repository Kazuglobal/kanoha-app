import { describe, expect, it } from "vitest";
import { dailyLimitFromSessions, dailyLimitStatus, usedSecondsToday } from "@/lib/sessions/dailyLimit";

const now = new Date("2026-09-02T09:00:00+09:00");
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

describe("dailyLimitStatus", () => {
  it("allows learning while used time is below the limit", () => {
    expect(dailyLimitStatus(15, 899)).toEqual({
      limitMinutes: 15,
      usedMinutes: 15,
      remainingMinutes: 0,
      limitReached: false,
    });
  });

  it("reports remaining whole minutes", () => {
    expect(dailyLimitStatus(15, 300)).toEqual({
      limitMinutes: 15,
      usedMinutes: 5,
      remainingMinutes: 10,
      limitReached: false,
    });
  });

  it("stops once used time reaches the limit", () => {
    expect(dailyLimitStatus(15, 900).limitReached).toBe(true);
    expect(dailyLimitStatus(15, 1200).remainingMinutes).toBe(0);
  });

  it("rejects negative input", () => {
    expect(() => dailyLimitStatus(-1, 0)).toThrow(RangeError);
  });
});

describe("usedSecondsToday", () => {
  it("adds finished durations and elapsed time of open sessions", () => {
    expect(usedSecondsToday([
      { started_at: minutesAgo(30), ended_at: minutesAgo(25), duration_seconds: 300 },
      { started_at: minutesAgo(4), ended_at: null, duration_seconds: 0 },
    ], now)).toBe(540);
  });

  it("never counts an open session as negative time", () => {
    expect(usedSecondsToday([
      { started_at: minutesAgo(-5), ended_at: null, duration_seconds: 0 },
    ], now)).toBe(0);
  });
});

describe("dailyLimitFromSessions", () => {
  it("treats an open session as time already used", () => {
    expect(dailyLimitFromSessions(10, [
      { started_at: minutesAgo(6), ended_at: null, duration_seconds: 0 },
      { started_at: minutesAgo(60), ended_at: minutesAgo(56), duration_seconds: 240 },
    ], now)).toEqual({ limitMinutes: 10, usedMinutes: 10, remainingMinutes: 0, limitReached: true });
  });
});
