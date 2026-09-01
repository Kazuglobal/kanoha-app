import { describe, expect, it } from "vitest";
import { checkRateLimit, checkRateLimitDb } from "@/lib/utils/rateLimit";
import { fakeSupabase } from "@/tests/review/fakeSupabase";

describe("checkRateLimitDb (0012 RPC)", () => {
  it("calls check_rate_limit with the `${user}:${action}` key and passes the verdict", async () => {
    const fake = fakeSupabase({ tables: {}, rpc: () => ({ data: true, error: null }) });

    await expect(checkRateLimitDb(fake.client, "user-1", "attempts", 60)).resolves.toBe(true);

    expect(fake.rpcCalls).toEqual([
      { name: "check_rate_limit", args: { p_key: "user-1:attempts", p_limit: 60, p_window_seconds: 60 } },
    ]);
  });

  it("returns false when the window limit is exceeded", async () => {
    const fake = fakeSupabase({ tables: {}, rpc: () => ({ data: false, error: null }) });
    await expect(checkRateLimitDb(fake.client, "user-1", "attempts", 60)).resolves.toBe(false);
  });

  it("fails closed when the RPC errors", async () => {
    const fake = fakeSupabase({ tables: {}, rpc: () => ({ data: null, error: { message: "boom" } }) });
    await expect(checkRateLimitDb(fake.client, "user-1", "attempts", 60)).resolves.toBe(false);
  });

  it("supports a custom window", async () => {
    const fake = fakeSupabase({ tables: {}, rpc: () => ({ data: true, error: null }) });
    await checkRateLimitDb(fake.client, "user-1", "slack-report", 5, 300);
    expect(fake.rpcCalls[0].args).toEqual({ p_key: "user-1:slack-report", p_limit: 5, p_window_seconds: 300 });
  });
});

describe("checkRateLimit (in-memory fallback)", () => {
  it("keeps the legacy signature working for the AI routes", () => {
    const key = `fallback:${Math.random()}`;
    expect(checkRateLimit(key, 2)).toBe(true);
    expect(checkRateLimit(key, 2)).toBe(true);
    expect(checkRateLimit(key, 2)).toBe(false);
  });
});
