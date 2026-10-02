import { beforeEach, describe, expect, it, vi } from "vitest";
import { soundManager } from "@/lib/audio/soundSystem";

describe("soundSystem (SoundManager)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe("settings and toggle", () => {
    it("returns default sound settings (both BGM and SE enabled)", () => {
      const settings = soundManager.getSettings();
      expect(typeof settings.bgmEnabled).toBe("boolean");
      expect(typeof settings.seEnabled).toBe("boolean");
    });

    it("toggles BGM state and dispatches kanoha-sound-change event", () => {
      const dispatchSpy = vi.spyOn(window, "dispatchEvent");
      const initial = soundManager.getSettings().bgmEnabled;

      const toggled = soundManager.toggleBgm();
      expect(toggled).toBe(!initial);
      expect(soundManager.getSettings().bgmEnabled).toBe(!initial);

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: "kanoha-sound-change" })
      );

      // 元に戻す
      soundManager.toggleBgm();
    });

    it("toggles SE state and dispatches kanoha-sound-change event", () => {
      const dispatchSpy = vi.spyOn(window, "dispatchEvent");
      const initial = soundManager.getSettings().seEnabled;

      const toggled = soundManager.toggleSe();
      expect(toggled).toBe(!initial);
      expect(soundManager.getSettings().seEnabled).toBe(!initial);

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: "kanoha-sound-change" })
      );

      // 元に戻す
      soundManager.toggleSe();
    });
  });

  describe("playback safety (Web Audio API graceful degradation)", () => {
    it("safely calls SE methods without throwing errors in Node/jsdom", () => {
      expect(() => soundManager.playCorrect()).not.toThrow();
      expect(() => soundManager.playWrong()).not.toThrow();
      expect(() => soundManager.playHint()).not.toThrow();
      expect(() => soundManager.playTap()).not.toThrow();
      expect(() => soundManager.playCelebrate()).not.toThrow();
    });

    it("safely manages BGM lifecycle without throwing errors", () => {
      expect(() => soundManager.startBgm("math")).not.toThrow();
      expect(() => soundManager.startBgm("japanese")).not.toThrow();
      expect(() => soundManager.startBgm("celebrate")).not.toThrow();
      expect(() => soundManager.stopBgm()).not.toThrow();
    });
  });
});
