import { describe, expect, it, vi } from "vitest";
import { reserveAiUsage } from "@/lib/ai/usage";
import * as operations from "@/lib/db/operations";

const limits = { dailyCallLimit: 100, dailyCostLimitUsd: 2 };

describe("reserveAiUsage", () => {
  it("reserves through incrementAiUsage with the caller's id, cost and limits", async () => {
    vi.spyOn(operations, "incrementAiUsage").mockResolvedValueOnce({
      allowed: true,
      calls: 3,
      costUsd: 0.05,
    });

    const reservation = await reserveAiUsage("user-1", 0.01, limits);

    expect(reservation).toEqual({ outcome: "allowed", calls: 3, costUsd: 0.05 });
    expect(operations.incrementAiUsage).toHaveBeenCalledWith(
      "user-1",
      0.01,
      100,
      2,
      expect.anything(),
    );
  });

  it("returns denied when the limit is reached", async () => {
    vi.spyOn(operations, "incrementAiUsage").mockResolvedValueOnce({
      allowed: false,
      calls: 100,
      costUsd: 1.99,
    });

    await expect(reserveAiUsage("user-1", 0.01, limits)).resolves.toEqual({
      outcome: "denied",
      calls: 100,
      costUsd: 1.99,
    });
  });

  it("fails closed (unavailable) on an error", async () => {
    vi.spyOn(operations, "incrementAiUsage").mockRejectedValueOnce(new Error("boom"));

    await expect(reserveAiUsage("user-1", 0.01, limits)).resolves.toEqual({
      outcome: "unavailable",
    });
  });
});
