import { describe, expect, it } from "vitest";

import { checkAiCost } from "@/lib/ai/costGuard";

describe("checkAiCost", () => {
  it("allows a request within both daily limits", () => {
    expect(
      checkAiCost(
        { calls: 3, costUsd: 0.75 },
        { estimatedCostUsd: 0.2 },
        { dailyCallLimit: 10, dailyCostLimitUsd: 2 },
      ),
    ).toEqual({ allowed: true, projectedCalls: 4, projectedCostUsd: 0.95 });
  });

  it("rejects a request that exceeds the cost limit", () => {
    expect(
      checkAiCost(
        { calls: 3, costUsd: 1.9 },
        { estimatedCostUsd: 0.11 },
        { dailyCallLimit: 10, dailyCostLimitUsd: 2 },
      ).reason,
    ).toBe("daily_cost_limit");
  });

  it("rejects a request that exceeds the call limit", () => {
    expect(
      checkAiCost(
        { calls: 10, costUsd: 0.5 },
        { estimatedCostUsd: 0.1 },
        { dailyCallLimit: 10, dailyCostLimitUsd: 2 },
      ).reason,
    ).toBe("daily_call_limit");
  });

  it("rejects invalid negative usage", () => {
    expect(() =>
      checkAiCost(
        { calls: -1, costUsd: 0 },
        { estimatedCostUsd: 0.1 },
        { dailyCallLimit: 10, dailyCostLimitUsd: 2 },
      ),
    ).toThrow();
  });
});
