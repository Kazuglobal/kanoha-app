import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EnglishTalkStage } from "@/components/child/englishTalk/EnglishTalkStage";
import { TALK_SCENES } from "@/lib/curriculum/englishTalkScenes";
import { toPublicScene } from "@/lib/englishTalk/judge";

vi.mock("@/lib/audio/englishTalkSpeech", () => ({
  speakTalkEnglish: vi.fn(async () => undefined),
  speakTalkJapanese: vi.fn(async () => undefined),
  stopTalkSpeech: vi.fn(),
  preloadTalkSceneSpeech: vi.fn(),
}));

vi.mock("@/lib/audio/soundSystem", () => ({
  soundManager: { playCorrect: vi.fn(), playWrong: vi.fn() },
}));

const sceneData = TALK_SCENES.find(({ id }) => id === "park")!;
const scene = { ...toPublicScene(sceneData), turns: toPublicScene(sceneData).turns.slice(1, 2) };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RealtimeTalkMic recording fallback when the server speech API refuses", () => {
  const installRecordingMocks = ({ loud = true }: { loud?: boolean } = {}) => {
    // jsdom の Blob には arrayBuffer() が無い
    if (typeof Blob.prototype.arrayBuffer !== "function") {
      Object.defineProperty(Blob.prototype, "arrayBuffer", {
        configurable: true,
        value(this: Blob) {
          return new Promise<ArrayBuffer>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(this);
          });
        },
      });
    }
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
    // 大きな音が鳴り続けているマイクを再現する(音量しきい値を超える)
    class FakeAudioContext {
      state = "running";
      resume = vi.fn(async () => undefined);
      close = vi.fn(async () => undefined);
      createMediaStreamSource = () => ({ connect: vi.fn() });
      createAnalyser = () => ({
        fftSize: 0,
        frequencyBinCount: 16,
        getByteTimeDomainData: (data: Uint8Array) => data.fill(loud ? 220 : 128),
      });
    }
    class FakeMediaRecorder {
      mimeType = "audio/webm";
      state = "inactive";
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start = vi.fn(() => {
        this.state = "recording";
        this.ondataavailable?.({ data: new Blob([new Uint8Array(400)]) });
      });
      stop = vi.fn(() => {
        this.state = "inactive";
        this.onstop?.();
      });
    }
    Object.defineProperty(window, "AudioContext", { configurable: true, value: FakeAudioContext });
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: FakeMediaRecorder });
    return getUserMedia;
  };

  afterEach(() => {
    for (const key of ["AudioContext", "MediaRecorder"]) Reflect.deleteProperty(window, key);
    Reflect.deleteProperty(navigator, "mediaDevices");
  });

  it.each([401, 429])("stops listening and points to the buttons on HTTP %i instead of retrying forever", async (status) => {
    const getUserMedia = installRecordingMocks();
    const sttCalls: unknown[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (String(url).includes("/api/ai/stt")) {
        sttCalls.push(url);
        return new Response(JSON.stringify({ success: false, error: "nope" }), { status });
      }
      return new Response(JSON.stringify({ success: true, data: { correct: false } }), { status: 200 });
    });

    render(<EnglishTalkStage scene={scene} />);
    await userEvent.click(screen.getByRole("button", { name: /おはなしを はじめる/ }));

    // Web Speech API が無い環境: ボタンでマイクを入れると録音(VAD)で始まり、声を検出して「ききとっています」になる
    await userEvent.click(screen.getByRole("button", { name: /じどうマイク/ }));
    await userEvent.click(await screen.findByRole("button", { name: /こえで こたえる（タップでマイクON）/ }));
    await screen.findByText(/声をききとっています/, undefined, { timeout: 3000 });
    const startsBeforeSend = getUserMedia.mock.calls.length;
    // ボタンをタップして録音を確定 → サーバーへ送る
    await userEvent.click(screen.getByRole("button", { name: /タップですぐ送信/ }));

    expect(await screen.findByText(/ボタンか もじで こたえてね/)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /タップでマイクON/ })).toBeInTheDocument();

    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(sttCalls).toHaveLength(1);
    expect(getUserMedia).toHaveBeenCalledTimes(startsBeforeSend);
  });

  it("keeps using Web Speech after the server refused the recording (Chrome path), instead of staying off", async () => {
    installRecordingMocks();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) =>
      String(url).includes("/api/ai/stt")
        ? new Response(JSON.stringify({ success: false }), { status: 401 })
        : new Response(JSON.stringify({ success: true, data: { correct: false } }), { status: 200 }),
    );

    const instances: Array<{ start: ReturnType<typeof vi.fn>; onerror: ((e?: { error?: string }) => void) | null }> = [];
    Object.defineProperty(window, "webkitSpeechRecognition", {
      configurable: true,
      value: class {
        lang = "en-US";
        continuous = false;
        interimResults = false;
        maxAlternatives = 1;
        onresult: ((e: unknown) => void) | null = null;
        onerror: ((e?: { error?: string }) => void) | null = null;
        onend: (() => void) | null = null;
        abort = vi.fn();
        start = vi.fn(() => {
          // 最初の1回だけ Web Speech が失敗して、録音(VAD)に切り替わる
          if (instances.length === 1) this.onerror?.({ error: "network" });
        });
        constructor() {
          instances.push(this);
        }
      },
    });

    try {
      render(<EnglishTalkStage scene={scene} />);
      await userEvent.click(screen.getByRole("button", { name: /おはなしを はじめる/ }));
      // 自動マイクで始まり、最初の Web Speech が失敗して録音(VAD)に切り替わる
      await screen.findByText(/声をききとっています/, undefined, { timeout: 3000 });
      await userEvent.click(screen.getByRole("button", { name: /タップですぐ送信/ }));
      expect(await screen.findByText(/ボタンか もじで こたえてね/)).toBeInTheDocument();

      // もう一度マイクを入れると Web Speech で聞き始める。そこで no-speech になっても、録音には戻らず Web Speech をやり直す
      await userEvent.click(await screen.findByRole("button", { name: /タップでマイクON/ }));
      const before = instances.length;
      instances[instances.length - 1].onerror?.({ error: "no-speech" });
      await vi.waitFor(() => expect(instances.length).toBeGreaterThan(before), { timeout: 2000 });
    } finally {
      Reflect.deleteProperty(window, "webkitSpeechRecognition");
    }
  });

  describe("recording length limits", () => {
    afterEach(() => vi.restoreAllMocks());

    /** 実際の時計に「進めた時間」を足す(VAD は Date.now で経過を測る) */
    const skewClock = () => {
      const realNow = Date.now.bind(Date);
      let offset = 0;
      vi.spyOn(Date, "now").mockImplementation(() => realNow() + offset);
      return (ms: number) => {
        offset += ms;
      };
    };

    it("sends the recording by itself after a long utterance, even if the room stays noisy (no silence to detect)", async () => {
      const getUserMedia = installRecordingMocks({ loud: true });
      const advance = skewClock();
      const sttCalls: unknown[] = [];
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        if (String(url).includes("/api/ai/stt")) {
          sttCalls.push(url);
          return new Response(JSON.stringify({ success: true, transcript: "It's a dog." }), { status: 200 });
        }
        return new Response(JSON.stringify({ success: true, data: { correct: true } }), { status: 200 });
      });

      render(<EnglishTalkStage scene={scene} />);
      await userEvent.click(screen.getByRole("button", { name: /おはなしを はじめる/ }));
      await userEvent.click(screen.getByRole("button", { name: /じどうマイク/ }));
      await userEvent.click(await screen.findByRole("button", { name: /こえで こたえる（タップでマイクON）/ }));
      await screen.findByText(/声をききとっています/, undefined, { timeout: 3000 });
      expect(getUserMedia).toHaveBeenCalled();

      advance(16_000);
      await vi.waitFor(() => expect(sttCalls).toHaveLength(1), { timeout: 3000 });
    });

    it("restarts the recording when nobody speaks for a long time, so it does not buffer silence forever", async () => {
      const getUserMedia = installRecordingMocks({ loud: false });
      const advance = skewClock();
      const sttCalls: unknown[] = [];
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        if (String(url).includes("/api/ai/stt")) sttCalls.push(url);
        return new Response(JSON.stringify({ success: true, data: { correct: false } }), { status: 200 });
      });

      render(<EnglishTalkStage scene={scene} />);
      await userEvent.click(screen.getByRole("button", { name: /おはなしを はじめる/ }));
      await userEvent.click(screen.getByRole("button", { name: /じどうマイク/ }));
      await userEvent.click(await screen.findByRole("button", { name: /こえで こたえる（タップでマイクON）/ }));
      await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalled(), { timeout: 3000 });
      await new Promise((resolve) => setTimeout(resolve, 600));
      const startsBefore = getUserMedia.mock.calls.length;

      advance(11_000);
      await vi.waitFor(() => expect(getUserMedia.mock.calls.length).toBeGreaterThan(startsBefore), { timeout: 3000 });
      expect(sttCalls).toHaveLength(0);
    });
  });
});
