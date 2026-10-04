import { describe, expect, it, vi, beforeEach } from "vitest";
import { soundManager } from "@/lib/audio/soundSystem";

describe("SoundManager BGM Ducking", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes duckBgm and unduckBgm methods", () => {
    expect(typeof soundManager.duckBgm).toBe("function");
    expect(typeof soundManager.unduckBgm).toBe("function");
  });

  it("handles speech events without throwing even if audio context is inactive", () => {
    expect(() => {
      window.dispatchEvent(new CustomEvent("kanoha-coach-speaking-start"));
      window.dispatchEvent(new CustomEvent("kanoha-coach-speaking-end"));
    }).not.toThrow();
  });
});
