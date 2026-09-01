import { describe, expect, it, vi } from "vitest";
import { getDailyAiUsage, recordAiUsage } from "@/lib/ai/usage";
import { todayKeyJst } from "@/lib/utils/date";

function createAdminStub(existingRow: { calls: number; cost_usd: number } | null) {
  const upsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const maybeSingle = vi.fn().mockResolvedValue({ data: existingRow, error: null });
  const table = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle,
    select: vi.fn().mockReturnThis(),
    upsert,
  };
  const from = vi.fn().mockReturnValue(table);
  return { admin: { from } as never, table, upsert };
}

describe("getDailyAiUsage", () => {
  it("returns zero usage when no row exists for today", async () => {
    const { admin } = createAdminStub(null);
    await expect(getDailyAiUsage(admin, "user-1")).resolves.toEqual({ calls: 0, costUsd: 0 });
  });

  it("looks up the row by the Asia/Tokyo date", async () => {
    const { admin, table } = createAdminStub(null);
    await getDailyAiUsage(admin, "user-1");
    expect(table.eq).toHaveBeenCalledWith("usage_date", todayKeyJst());
  });

  it("returns the stored usage when a row exists", async () => {
    const { admin } = createAdminStub({ calls: 3, cost_usd: 0.05 });
    await expect(getDailyAiUsage(admin, "user-1")).resolves.toEqual({ calls: 3, costUsd: 0.05 });
  });
});

describe("recordAiUsage", () => {
  it("upserts incremented calls and accumulated cost for today", async () => {
    const { admin, upsert } = createAdminStub({ calls: 1, cost_usd: 0.02 });
    await recordAiUsage(admin, "user-1", 0.01);

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        usage_date: todayKeyJst(),
        calls: 2,
        cost_usd: 0.03,
      }),
    );
  });
});
