import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { speakVoice, stopCoachVoice } from "@/lib/audio/coachSpeech";

class FailingAudio {
  onplay: (() => void) | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  volume = 1;
  currentTime = 0;
  pause = vi.fn();
  play = vi.fn((): Promise<void> => Promise.reject(new Error("NotAllowedError")));
}

class PlayingAudio extends FailingAudio {
  play = vi.fn(() => {
    queueMicrotask(() => this.onended?.());
    return Promise.resolve();
  });
}

const ttsOk = () =>
  vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, audioDataUrl: "data:audio/wav;base64,AAAA" }),
  });

describe("speakVoice reports whether the line was actually heard", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    // Web Audio も使えない端末
    vi.stubGlobal("AudioContext", undefined);
    vi.stubGlobal("webkitAudioContext", undefined);
  });

  afterEach(() => {
    stopCoachVoice();
    vi.unstubAllGlobals();
    vi.mocked(console.warn).mockRestore();
  });

  it("returns false when the audio element and Web Audio both fail, so callers can fall back", async () => {
    vi.stubGlobal("Audio", FailingAudio);
    vi.stubGlobal("fetch", ttsOk());
    await expect(speakVoice("Hello!", { lang: "en" })).resolves.toBe(false);
    // キャッシュ済みの音声でも同じ
    await expect(speakVoice("Hello!", { lang: "en" })).resolves.toBe(false);
  });

  it("returns true when the audio plays", async () => {
    vi.stubGlobal("Audio", PlayingAudio);
    vi.stubGlobal("fetch", ttsOk());
    await expect(speakVoice("Good morning!", { lang: "en" })).resolves.toBe(true);
  });
});
