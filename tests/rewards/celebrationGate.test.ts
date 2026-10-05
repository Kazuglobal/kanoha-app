import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CELEBRATION_GATE_EVENT,
  areCelebrationsDeferred,
  setCelebrationsDeferred,
} from "@/lib/rewards/celebrationGate";

afterEach(() => setCelebrationsDeferred(false));

describe("celebration gate", () => {
  it("broadcasts changes only when the state actually changes", () => {
    const listener = vi.fn();
    window.addEventListener(CELEBRATION_GATE_EVENT, listener);
    setCelebrationsDeferred(true);
    setCelebrationsDeferred(true);
    expect(areCelebrationsDeferred()).toBe(true);
    setCelebrationsDeferred(false);
    expect(listener).toHaveBeenCalledTimes(2);
    expect((listener.mock.calls[1][0] as CustomEvent<boolean>).detail).toBe(false);
    window.removeEventListener(CELEBRATION_GATE_EVENT, listener);
  });
});
