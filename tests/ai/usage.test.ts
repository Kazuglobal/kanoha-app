import { describe, expect, it, vi } from "vitest";

import { reserveAiUsage } from "@/lib/ai/usage";

const limits = { dailyCallLimit: 100, dailyCostLimitUsd: 2 };

const clientWithRpc = (result: { data: unknown; error: { message: string } | null }) => {
  const rpc = vi.fn().mockResolvedValue(result);
  return { client: { rpc } as never, rpc };
};

describe("reserveAiUsage (increment_ai_usage RPC)", () => {
  it("reserves through the RPC with the caller's id, cost and both limits", async () => {
    const { client, rpc } = clientWithRpc({
      data: [{ allowed: true, calls: 3, cost_usd: 0.05 }],
      error: null,
    });

    const reservation = await reserveAiUsage(client, "user-1", 0.01, limits);

    expect(reservation).toEqual({ outcome: "allowed", calls: 3, costUsd: 0.05 });
    expect(rpc).toHaveBeenCalledWith("increment_ai_usage", {
      p_call_limit: 100,
      p_cost: 0.01,
      p_cost_limit: 2,
      p_user: "user-1",
    });
  });

  it("returns denied when the RPC reports the limit is reached", async () => {
    const { client } = clientWithRpc({
      data: [{ allowed: false, calls: 100, cost_usd: 1.99 }],
      error: null,
    });
    await expect(reserveAiUsage(client, "user-1", 0.01, limits)).resolves.toEqual({
      outcome: "denied",
      calls: 100,
      costUsd: 1.99,
    });
  });

  it("fails closed (unavailable) on an RPC error", async () => {
    const { client } = clientWithRpc({ data: null, error: { message: "boom" } });
    await expect(reserveAiUsage(client, "user-1", 0.01, limits)).resolves.toEqual({
      outcome: "unavailable",
    });
  });

  it("fails closed on a malformed RPC response instead of silently allowing", async () => {
    const empty = clientWithRpc({ data: [], error: null });
    await expect(reserveAiUsage(empty.client, "user-1", 0.01, limits)).resolves.toEqual({
      outcome: "unavailable",
    });
    const malformed = clientWithRpc({ data: [{ calls: 1 }], error: null });
    await expect(reserveAiUsage(malformed.client, "user-1", 0.01, limits)).resolves.toEqual({
      outcome: "unavailable",
    });
  });
});
