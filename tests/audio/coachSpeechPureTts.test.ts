import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { speakCoachVoice, stopCoachVoice, isCoachSpeaking } from "@/lib/audio/coachSpeech";

describe("coachSpeech with pure Gemini TTS", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    stopCoachVoice();
  });

  afterEach(() => {
    stopCoachVoice();
  });

  it("calls /api/ai/tts and plays audio when available", async () => {
    const mockAudioPlay = vi.fn().mockImplementation(function (this: any) {
      setTimeout(() => this.onended?.(), 5);
      return Promise.resolve();
    });
    const mockAudioPause = vi.fn();

    class MockAudio {
      play = mockAudioPlay;
      pause = mockAudioPause;
      currentTime = 0;
      onplay: (() => void) | null = null;
      onended: (() => void) | null = null;
      onerror: ((err: any) => void) | null = null;
      src: string;
      constructor(src?: string) {
        this.src = src || "";
      }
    }

    vi.stubGlobal("Audio", MockAudio);

    // Mock fetch for /api/ai/tts
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        audioDataUrl: "data:audio/wav;base64,UklGRi...",
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await speakCoachVoice("いっしょに がんばろうね！", "happy");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/ai/tts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          text: "いっしょに がんばろうね！",
          mood: "happy",
          voiceName: "Aoede",
        }),
      })
    );
  });

  it("handles TTS failure gracefully without calling window.speechSynthesis", async () => {
    // Ensure speechSynthesis is NOT called even if window has it
    const mockSpeak = vi.fn();
    vi.stubGlobal("speechSynthesis", {
      speak: mockSpeak,
      cancel: vi.fn(),
      getVoices: () => [],
    });

    // Mock fetch failure
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      })
    );

    await speakCoachVoice("テスト失敗ケース", "think");

    // Must NOT call Web Speech API
    expect(mockSpeak).not.toHaveBeenCalled();
  });
});
