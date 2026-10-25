import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VoiceAnswer } from "@/components/child/VoiceAnswer";

const installNoisyMic = () => {
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
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
  });
  class FakeAudioContext {
    state = "running";
    close = vi.fn(async () => undefined);
    createMediaStreamSource = () => ({ connect: vi.fn() });
    createAnalyser = () => ({
      fftSize: 0,
      frequencyBinCount: 16,
      getByteTimeDomainData: (data: Uint8Array) => data.fill(220), // ずっと大きな音(雑音)
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
};

afterEach(() => {
  vi.restoreAllMocks();
  for (const key of ["AudioContext", "MediaRecorder"]) Reflect.deleteProperty(window, key);
  Reflect.deleteProperty(navigator, "mediaDevices");
});

describe("VoiceAnswer recording length", () => {
  it("sends the recording by itself after a long utterance even if the room stays noisy", async () => {
    installNoisyMic();
    const realNow = Date.now.bind(Date);
    let offset = 0;
    vi.spyOn(Date, "now").mockImplementation(() => realNow() + offset);
    const sttBodies: unknown[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      sttBodies.push(init?.body);
      return new Response(JSON.stringify({ success: true, transcript: "12" }), { status: 200 });
    });
    const onAnswer = vi.fn();

    render(<VoiceAnswer onAnswer={onAnswer} />);
    await userEvent.click(await screen.findByRole("button", { name: "こえで こたえる" }));
    await new Promise((resolve) => setTimeout(resolve, 600)); // 声を検出するまでの数フレーム
    offset += 16_000;

    await vi.waitFor(() => expect(sttBodies).toHaveLength(1), { timeout: 3000 });
    await vi.waitFor(() => expect(onAnswer).toHaveBeenCalledWith("12"), { timeout: 3000 });
  });
});
