import { describe, expect, it } from "vitest";

import { addDaysJst, jstDayRange, toJstDateKey, todayKeyJst } from "@/lib/utils/date";

describe("toJstDateKey", () => {
  it.each([
    ["2026-09-01T20:00:00Z", "2026-09-02"],
    ["2026-09-01T14:59:59Z", "2026-09-01"],
    ["2026-09-01T15:00:00Z", "2026-09-02"],
    ["2026-12-31T15:30:00Z", "2027-01-01"],
    ["2026-06-12T10:00:00+09:00", "2026-06-12"],
  ])("formats %s as the Asia/Tokyo date %s", (iso, expected) => {
    expect(toJstDateKey(new Date(iso))).toBe(expected);
  });

  it("rejects invalid dates", () => {
    expect(() => toJstDateKey(new Date("nope"))).toThrow(RangeError);
  });
});

describe("todayKeyJst", () => {
  it("uses the supplied instant", () => {
    expect(todayKeyJst(new Date("2026-09-01T20:00:00Z"))).toBe("2026-09-02");
  });

  it("returns a YYYY-MM-DD key for the current time", () => {
    expect(todayKeyJst()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("addDaysJst", () => {
  it.each([
    ["2026-09-02", 1, "2026-09-03"],
    ["2026-09-02", 7, "2026-09-09"],
    ["2026-02-28", 1, "2026-03-01"],
    ["2026-12-31", 3, "2027-01-03"],
    ["2026-09-02", -2, "2026-08-31"],
    ["2026-09-02", 0, "2026-09-02"],
  ])("adds %i day(s) to %s", (dateKey, days, expected) => {
    expect(addDaysJst(dateKey, days)).toBe(expected);
  });

  it("rejects malformed keys and fractional days", () => {
    expect(() => addDaysJst("2026/09/02", 1)).toThrow(RangeError);
    expect(() => addDaysJst("2026-13-40", 1)).toThrow(RangeError);
    expect(() => addDaysJst("2026-09-02", 1.5)).toThrow(RangeError);
  });
});

describe("jstDayRange", () => {
  it("covers the Asia/Tokyo day around a UTC-midnight instant", () => {
    expect(jstDayRange(new Date("2026-09-01T20:00:00Z"))).toEqual({
      start: "2026-09-01T15:00:00.000Z",
      end: "2026-09-02T15:00:00.000Z",
    });
  });

  it("starts a new day at 15:00Z", () => {
    expect(jstDayRange(new Date("2026-09-01T14:59:59Z")).start).toBe("2026-08-31T15:00:00.000Z");
    expect(jstDayRange(new Date("2026-09-01T15:00:00Z")).start).toBe("2026-09-01T15:00:00.000Z");
  });
});
