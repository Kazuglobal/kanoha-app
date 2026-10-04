import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  playPraiseVoice,
  playEncourageVoice,
  preloadCoachVoices,
  PRAISE_PHRASES,
  ENCOURAGE_PHRASES,
} from "@/lib/audio/coachSpeech";

describe("praise and encouragement coach voices", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("playPraiseVoice picks a praise phrase, dispatches event, and calls TTS", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        audioDataUrl: "data:audio/wav;base64,UklGR...",
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const eventListener = vi.fn();
    window.addEventListener("kanoha-coach-praise", eventListener);

    const chosenPhrase = await playPraiseVoice();

    expect(PRAISE_PHRASES).toContain(chosenPhrase);
    expect(eventListener).toHaveBeenCalled();
    const eventDetail = eventListener.mock.calls[0][0].detail;
    expect(eventDetail.message).toBe(chosenPhrase);
    expect(eventDetail.mood).toBe("celebrate");
  });

  it("playEncourageVoice picks an encouragement phrase and dispatches event", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        audioDataUrl: "data:audio/wav;base64,UklGR...",
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const eventListener = vi.fn();
    window.addEventListener("kanoha-coach-praise", eventListener);

    const chosenPhrase = await playEncourageVoice();

    expect(ENCOURAGE_PHRASES).toContain(chosenPhrase);
    expect(eventListener).toHaveBeenCalled();
    const eventDetail = eventListener.mock.calls[0][0].detail;
    expect(eventDetail.message).toBe(chosenPhrase);
    expect(eventDetail.mood).toBe("think");
  });

  it("preloadCoachVoices triggers background prefetching", () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        audioDataUrl: "data:audio/wav;base64,UklGR...",
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    preloadCoachVoices(["テストフレーズ"]);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/ai/tts",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("テストフレーズ"),
      })
    );
  });
});
