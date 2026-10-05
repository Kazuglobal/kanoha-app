import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { speakCoachVoice, stopCoachVoice } from "@/lib/audio/coachSpeech";

type Handler = ((err?: unknown) => void) | null;

const created: MockAudio[] = [];

class MockAudio {
  static playImpl: (audio: MockAudio) => Promise<void> = () => Promise.resolve();
  play = vi.fn(() => MockAudio.playImpl(this));
  pause = vi.fn();
  currentTime = 0;
  volume = 1;
  onplay: Handler = null;
  onended: Handler = null;
  onerror: Handler = null;
  constructor(public src = "") {
    created.push(this);
  }
}

function okTts(url: string) {
  return { ok: true, json: async () => ({ success: true, audioDataUrl: url }) };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

// coachSpeech caches its AudioContext, so every test shares one fake context.
const source = { start: vi.fn(), stop: vi.fn(), connect: vi.fn(), onended: null as Handler, buffer: null };
const ctx = {
  state: "running",
  destination: {},
  resume: vi.fn(),
  createBufferSource: vi.fn(() => source),
  decodeAudioData: vi.fn((_buf: ArrayBuffer, ok: (b: unknown) => void) => ok({})),
};

function stubWebAudio() {
  [source.start, source.stop, source.connect, ctx.createBufferSource, ctx.decodeAudioData].forEach((fn) =>
    fn.mockClear(),
  );
  source.onended = null;
  vi.stubGlobal("AudioContext", vi.fn(function () {
    return ctx;
  }));
  return { ctx, source };
}

describe("coach voice never plays the same line twice", () => {
  beforeEach(() => {
    created.length = 0;
    MockAudio.playImpl = () => Promise.resolve();
    vi.stubGlobal("Audio", MockAudio);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    stopCoachVoice();
    vi.unstubAllGlobals();
    vi.mocked(console.warn).mockRestore();
  });

  it("starts the fallback only once when play() rejects and onerror also fires", async () => {
    const { ctx, source } = stubWebAudio();
    MockAudio.playImpl = (audio) => {
      audio.onerror?.(new Error("decode"));
      return Promise.reject(new Error("NotAllowedError"));
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okTts("data:audio/wav;base64,AAAA")));

    const done = speakCoachVoice("おしい！", "think");
    await vi.waitFor(() => expect(source.start).toHaveBeenCalled());
    source.onended?.();
    await done;

    expect(ctx.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(source.start).toHaveBeenCalledTimes(1);
  });

  it("plays only the latest line when two requests overlap", async () => {
    const first = deferred<ReturnType<typeof okTts>>();
    const second = deferred<ReturnType<typeof okTts>>();
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise));

    const a = speakCoachVoice("ひとつめ", "happy");
    const b = speakCoachVoice("ふたつめ", "happy");
    second.resolve(okTts("data:audio/wav;base64,BBBB"));
    first.resolve(okTts("data:audio/wav;base64,AAAA"));
    await vi.waitFor(() => expect(created.length).toBeGreaterThan(0));
    created.forEach((audio) => audio.onended?.());
    await Promise.all([a, b]);

    expect(created).toHaveLength(1);
    expect(created[0].src).toBe("data:audio/wav;base64,BBBB");
  });

  it("stopCoachVoice also stops fallback (Web Audio) playback", async () => {
    const { source } = stubWebAudio();
    MockAudio.playImpl = () => Promise.reject(new Error("NotAllowedError"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okTts("data:audio/wav;base64,AAAA")));

    void speakCoachVoice("やったね！", "celebrate");
    await vi.waitFor(() => expect(source.start).toHaveBeenCalled());
    stopCoachVoice();

    expect(source.stop).toHaveBeenCalled();
  });

  it("settles an interrupted line so the read-aloud button does not get stuck", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okTts("data:audio/wav;base64,AAAA")));

    const first = speakCoachVoice("もんだいを よむよ", "happy");
    await vi.waitFor(() => expect(created).toHaveLength(1));
    stopCoachVoice();

    await expect(first).resolves.toBeUndefined();
  });
});
