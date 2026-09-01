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
