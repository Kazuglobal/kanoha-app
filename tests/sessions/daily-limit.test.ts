import { describe, expect, it } from "vitest";
import {
  OPEN_SESSION_GRACE_MINUTES,
  OPEN_SESSION_GRACE_MS,
  dailyLimitFromSessions,
  dailyLimitStatus,
  lastAttemptBySession,
  openSessionIds,
  openSessionSeconds,
  usedSecondsToday,
  withLastAttempts,
} from "@/lib/sessions/dailyLimit";

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

describe("openSessionSeconds (abandoned-session grace)", () => {
  it("exports a 10 minute grace", () => {
    expect(OPEN_SESSION_GRACE_MINUTES).toBe(10);
    expect(OPEN_SESSION_GRACE_MS).toBe(600_000);
  });

  it("counts an active session by elapsed time while inside the grace", () => {
    expect(openSessionSeconds(
      { started_at: minutesAgo(7), ended_at: null, duration_seconds: 0, last_attempt_at: minutesAgo(2) }, now,
    )).toBe(7 * 60);
    expect(openSessionSeconds(
      { started_at: minutesAgo(4), ended_at: null, duration_seconds: 0 }, now,
    )).toBe(4 * 60);
  });

  it("stops counting 10 minutes after the last attempt (60 min ago, last attempt 50 min ago → 20 min)", () => {
    expect(openSessionSeconds(
      { started_at: minutesAgo(60), ended_at: null, duration_seconds: 0, last_attempt_at: minutesAgo(50) }, now,
    )).toBe(20 * 60);
  });

  it("counts only the grace when a session was abandoned with no attempts", () => {
    expect(openSessionSeconds(
      { started_at: minutesAgo(60), ended_at: null, duration_seconds: 0, last_attempt_at: null }, now,
    )).toBe(10 * 60);
    expect(openSessionSeconds(
      { started_at: minutesAgo(60), ended_at: null, duration_seconds: 0 }, now,
    )).toBe(10 * 60);
  });

  it("never lets a last attempt before started_at shrink the count below the grace", () => {
    expect(openSessionSeconds(
      { started_at: minutesAgo(30), ended_at: null, duration_seconds: 0, last_attempt_at: minutesAgo(45) }, now,
    )).toBe(10 * 60);
  });

  it("returns 0 for unparsable timestamps", () => {
    expect(openSessionSeconds({ started_at: "nope", ended_at: null, duration_seconds: 0 }, now)).toBe(0);
  });

  it("flows through usedSecondsToday and dailyLimitFromSessions", () => {
    const sessions = [
      { started_at: minutesAgo(60), ended_at: null, duration_seconds: 0, last_attempt_at: minutesAgo(50) },
      { started_at: minutesAgo(120), ended_at: minutesAgo(115), duration_seconds: 300 },
    ];
    expect(usedSecondsToday(sessions, now)).toBe(25 * 60);
    expect(dailyLimitFromSessions(15, sessions, now)).toEqual({
      limitMinutes: 15, usedMinutes: 25, remainingMinutes: 0, limitReached: true,
    });
    expect(dailyLimitFromSessions(30, sessions, now).remainingMinutes).toBe(5);
  });
});

describe("lastAttemptBySession / withLastAttempts", () => {
  it("keeps the newest created_at per session regardless of input order", () => {
    const map = lastAttemptBySession([
      { session_id: "a", created_at: minutesAgo(30) },
      { session_id: "a", created_at: minutesAgo(5) },
      { session_id: "b", created_at: minutesAgo(50) },
      { session_id: "a", created_at: minutesAgo(20) },
    ]);
    expect(map.get("a")).toBe(minutesAgo(5));
    expect(map.get("b")).toBe(minutesAgo(50));
  });

  it("attaches last_attempt_at to each session and lists only open session ids", () => {
    const rows = [
      { id: "open", started_at: minutesAgo(60), ended_at: null, duration_seconds: 0 },
      { id: "done", started_at: minutesAgo(90), ended_at: minutesAgo(80), duration_seconds: 600 },
    ];
    expect(openSessionIds(rows)).toEqual(["open"]);
    const usage = withLastAttempts(rows, new Map([["open", minutesAgo(50)]]));
    expect(usage).toEqual([
      { ...rows[0], last_attempt_at: minutesAgo(50) },
      { ...rows[1], last_attempt_at: null },
    ]);
    expect(rows[0]).not.toHaveProperty("last_attempt_at");
    expect(usedSecondsToday(usage, now)).toBe(30 * 60);
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
