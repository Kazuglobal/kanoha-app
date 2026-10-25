import { afterEach, describe, expect, it, vi } from "vitest";
import { envNumber } from "@/lib/utils/envNumber";

afterEach(() => vi.unstubAllEnvs());

describe("envNumber", () => {
  it("returns the fallback when unset, empty or not a number", () => {
    expect(envNumber("X_UNSET_VAR", 5)).toBe(5);
    vi.stubEnv("X_TEST_VAR", "  ");
    expect(envNumber("X_TEST_VAR", 5)).toBe(5);
    vi.stubEnv("X_TEST_VAR", "abc");
    expect(envNumber("X_TEST_VAR", 5)).toBe(5);
  });

  it("reads numbers at call time and treats 0 as a real value", () => {
    vi.stubEnv("X_TEST_VAR", "0");
    expect(envNumber("X_TEST_VAR", 5)).toBe(0);
    vi.stubEnv("X_TEST_VAR", "250");
    expect(envNumber("X_TEST_VAR", 5)).toBe(250);
  });

  it("rejects negative values", () => {
    vi.stubEnv("X_TEST_VAR", "-3");
    expect(envNumber("X_TEST_VAR", 5)).toBe(5);
  });
});
