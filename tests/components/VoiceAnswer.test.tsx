import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VoiceAnswer } from "@/components/child/VoiceAnswer";

describe("VoiceAnswer", () => {
  it("stays hidden when speech recognition is unavailable", () => {
    render(<VoiceAnswer onAnswer={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "こえで こたえる" })).not.toBeInTheDocument();
  });

  it("appears when speech recognition is supported", async () => {
    Object.defineProperty(window, "webkitSpeechRecognition", {
      configurable: true,
      value: class {},
    });

    render(<VoiceAnswer onAnswer={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "こえで こたえる" })).toBeInTheDocument());

    Reflect.deleteProperty(window, "webkitSpeechRecognition");
  });
});

describe("VoiceAnswer cleanup", () => {
  it("stops listening when it unmounts and ignores a late result", async () => {
    const instances: Array<{ abort: ReturnType<typeof vi.fn>; onresult?: (e: unknown) => void }> = [];
    Object.defineProperty(window, "webkitSpeechRecognition", {
      configurable: true,
      value: class {
        lang = "";
        abort = vi.fn();
        onresult?: (e: unknown) => void;
        onerror = () => undefined;
        start = vi.fn();
        constructor() {
          instances.push(this);
        }
      },
    });
    const onAnswer = vi.fn();
    const { unmount } = render(<VoiceAnswer lang="en-US" onAnswer={onAnswer} />);
    const button = await screen.findByRole("button", { name: "こえで こたえる" });
    button.click();
    unmount();
    expect(instances[0].abort).toHaveBeenCalled();
    instances[0].onresult?.({ results: [[{ transcript: "It's a dog." }]] });
    expect(onAnswer).not.toHaveBeenCalled();
    Reflect.deleteProperty(window, "webkitSpeechRecognition");
  });

  it("can be disabled while an answer is being checked", async () => {
    Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, value: class {} });
    render(<VoiceAnswer onAnswer={vi.fn()} disabled />);
    expect(await screen.findByRole("button", { name: "こえで こたえる" })).toBeDisabled();
    Reflect.deleteProperty(window, "webkitSpeechRecognition");
  });
});
