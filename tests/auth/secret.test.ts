import { describe, expect, it } from "vitest";

import { DEV_AUTH_SECRET, resolveAuthSecret } from "@/lib/auth/secret";

const STRONG = "x".repeat(32);

describe("resolveAuthSecret", () => {
  it("uses BETTER_AUTH_SECRET when it is set", () => {
    expect(resolveAuthSecret({ NODE_ENV: "production", BETTER_AUTH_SECRET: STRONG })).toBe(STRONG);
    expect(resolveAuthSecret({ NODE_ENV: "development", BETTER_AUTH_SECRET: STRONG })).toBe(STRONG);
  });

  it("refuses to run production without a secret", () => {
    expect(() => resolveAuthSecret({ NODE_ENV: "production" })).toThrow(/BETTER_AUTH_SECRET/);
    expect(() => resolveAuthSecret({ NODE_ENV: "production", BETTER_AUTH_SECRET: "  " })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
  });

  it("refuses a short secret in production", () => {
    expect(() =>
      resolveAuthSecret({ NODE_ENV: "production", BETTER_AUTH_SECRET: "too-short" }),
    ).toThrow(/32/);
  });

  it("never falls back to the dev secret in production", () => {
    expect(() =>
      resolveAuthSecret({ NODE_ENV: "production", BETTER_AUTH_SECRET: DEV_AUTH_SECRET }),
    ).toThrow(/BETTER_AUTH_SECRET/);
  });

  it("falls back to a dev-only secret outside production", () => {
    expect(resolveAuthSecret({ NODE_ENV: "development" })).toBe(DEV_AUTH_SECRET);
    expect(resolveAuthSecret({ NODE_ENV: "test" })).toBe(DEV_AUTH_SECRET);
    expect(resolveAuthSecret({})).toBe(DEV_AUTH_SECRET);
  });

  it("lets `next build` evaluate the module without the runtime secret", () => {
    expect(
      resolveAuthSecret({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" }),
    ).toBe(DEV_AUTH_SECRET);
  });
});
