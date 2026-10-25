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

  describe("app-wide daily ceiling (guards against many throwaway accounts)", () => {
    it("is checked after the per-user reservation, keyed by the JST date, with a 24h window", async () => {
      vi.spyOn(operations, "incrementAiUsage").mockResolvedValueOnce({ allowed: true, calls: 1, costUsd: 0.01 });
      const global = vi.spyOn(operations, "checkDbRateLimit").mockResolvedValueOnce(true);

      const reservation = await reserveAiUsage("user-1", 0.01, limits);

      expect(reservation.outcome).toBe("allowed");
      expect(global).toHaveBeenCalledWith(expect.stringMatching(/^global:ai-calls:\d{4}-\d{2}-\d{2}$/), 1000, 86_400, expect.anything());
    });

    it("denies when the app-wide ceiling is reached even though the user still has quota", async () => {
      vi.spyOn(operations, "incrementAiUsage").mockResolvedValueOnce({ allowed: true, calls: 1, costUsd: 0.01 });
      vi.spyOn(operations, "checkDbRateLimit").mockResolvedValueOnce(false);

      await expect(reserveAiUsage("user-1", 0.01, limits)).resolves.toEqual({
        outcome: "denied",
        calls: 1,
        costUsd: 0.01,
      });
    });

    it("does not spend the app-wide ceiling when the user's own limit already denied", async () => {
      vi.spyOn(operations, "incrementAiUsage").mockResolvedValueOnce({ allowed: false, calls: 100, costUsd: 1.99 });
      const global = vi.spyOn(operations, "checkDbRateLimit");
      global.mockClear();

      await reserveAiUsage("user-1", 0.01, limits);
      expect(global).not.toHaveBeenCalled();
    });

    it("fails closed when the ceiling check errors, and reads AI_GLOBAL_DAILY_CALL_LIMIT", async () => {
      vi.stubEnv("AI_GLOBAL_DAILY_CALL_LIMIT", "250");
      vi.spyOn(operations, "incrementAiUsage").mockResolvedValue({ allowed: true, calls: 1, costUsd: 0.01 });
      const global = vi.spyOn(operations, "checkDbRateLimit").mockRejectedValueOnce(new Error("boom"));

      await expect(reserveAiUsage("user-1", 0.01, limits)).resolves.toEqual({ outcome: "unavailable" });
      global.mockResolvedValueOnce(true);
      await reserveAiUsage("user-1", 0.01, limits);
      expect(global).toHaveBeenLastCalledWith(expect.any(String), 250, 86_400, expect.anything());
      vi.unstubAllEnvs();
    });
  });
});
