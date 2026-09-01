import { describe, expect, it } from "vitest";
import { dailyLimitStatus } from "@/lib/sessions/dailyLimit";

describe("dailyLimitStatus", () => {
  it("allows learning while completed time is below the limit", () => {
    expect(dailyLimitStatus(15, [300, 599])).toEqual({
      limitMinutes: 15,
      usedMinutes: 15,
      reached: false,
    });
  });

  it("stops a new session once completed time reaches the limit", () => {
    expect(dailyLimitStatus(15, [600, 300])).toEqual({
      limitMinutes: 15,
      usedMinutes: 15,
      reached: true,
    });
  });
});
