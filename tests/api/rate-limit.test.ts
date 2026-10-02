import { describe, expect, it, vi } from "vitest";
import { checkRateLimit, checkRateLimitDb } from "@/lib/utils/rateLimit";
import * as operations from "@/lib/db/operations";

describe("checkRateLimitDb", () => {
  it("calls checkDbRateLimit with the `${user}:${action}` key and passes the verdict", async () => {
    const spy = vi.spyOn(operations, "checkDbRateLimit").mockResolvedValueOnce(true);

    await expect(checkRateLimitDb("user-1", "attempts", 60)).resolves.toBe(true);

    expect(spy).toHaveBeenCalledWith("user-1:attempts", 60, 60);
  });

  it("returns false when the window limit is exceeded", async () => {
    vi.spyOn(operations, "checkDbRateLimit").mockResolvedValueOnce(false);
    await expect(checkRateLimitDb("user-1", "attempts", 60)).resolves.toBe(false);
  });

  it("fails closed when the DB operation errors", async () => {
    vi.spyOn(operations, "checkDbRateLimit").mockRejectedValueOnce(new Error("boom"));
    await expect(checkRateLimitDb("user-1", "attempts", 60)).resolves.toBe(false);
  });

  it("supports a custom window", async () => {
    const spy = vi.spyOn(operations, "checkDbRateLimit").mockResolvedValueOnce(true);
    await checkRateLimitDb("user-1", "slack-report", 5, 300);
    expect(spy).toHaveBeenCalledWith("user-1:slack-report", 5, 300);
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
