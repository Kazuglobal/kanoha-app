import { describe, expect, it } from "vitest";

import {
  PIN_LOCK_MINUTES,
  PIN_MAX_FAILURES,
  hashPin,
  pinAfterFailure,
  pinLockRemainingSeconds,
  pinSchema,
  verifyPin,
} from "@/lib/auth/pin";

describe("parent PIN hashing (scrypt)", () => {
  it("stores scrypt$salt$hash with a fresh 16-byte salt and verifies the same PIN", async () => {
    const first = await hashPin("1234");
    const second = await hashPin("1234");
    const [format, salt, hash] = first.split("$");

    expect(format).toBe("scrypt");
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toBe(second);
    await expect(verifyPin("1234", first)).resolves.toBe(true);
    await expect(verifyPin("1234", second)).resolves.toBe(true);
  });

  it("rejects a different PIN, malformed hashes and missing hashes", async () => {
    const stored = await hashPin("1234");
    await expect(verifyPin("1235", stored)).resolves.toBe(false);
    await expect(verifyPin("1234", null)).resolves.toBe(false);
    await expect(verifyPin("1234", "bcrypt$x$y")).resolves.toBe(false);
    await expect(verifyPin("1234", "scrypt$00$00")).resolves.toBe(false);
  });

  it.each(["1234", "0000"])("accepts the 4-digit PIN %s", (pin) => {
    expect(pinSchema.safeParse(pin).success).toBe(true);
  });

  it.each(["123", "12345", "12a4", "１２３４", ""])("rejects PIN %j", (pin) => {
    expect(pinSchema.safeParse(pin).success).toBe(false);
  });
});

describe("parent PIN lockout", () => {
  const now = new Date("2026-09-02T03:00:00Z");

  it("counts failures until the limit, then locks for 5 minutes and resets the counter", () => {
    const steps = Array.from({ length: PIN_MAX_FAILURES - 1 }, (_, index) => index);
    const beforeLock = steps.reduce(
      (row) => ({ parent_pin_failed_attempts: pinAfterFailure(row, now).parent_pin_failed_attempts }),
      { parent_pin_failed_attempts: 0 },
    );
    expect(beforeLock.parent_pin_failed_attempts).toBe(PIN_MAX_FAILURES - 1);

    const locked = pinAfterFailure(beforeLock, now);
    expect(locked.parent_pin_failed_attempts).toBe(0);
    expect(locked.parent_pin_locked_until).toBe(
      new Date(now.getTime() + PIN_LOCK_MINUTES * 60_000).toISOString(),
    );
  });

  it("reports the remaining lock time and 0 once it has expired", () => {
    const lockedUntil = new Date(now.getTime() + 90_000).toISOString();
    expect(pinLockRemainingSeconds({ parent_pin_locked_until: lockedUntil }, now)).toBe(90);
    expect(pinLockRemainingSeconds({ parent_pin_locked_until: lockedUntil }, new Date(now.getTime() + 100_000))).toBe(0);
    expect(pinLockRemainingSeconds({ parent_pin_locked_until: null }, now)).toBe(0);
    expect(pinLockRemainingSeconds({ parent_pin_locked_until: "not a date" }, now)).toBe(0);
  });
});
