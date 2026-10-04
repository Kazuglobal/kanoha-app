import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { VoiceButton } from "@/components/child/VoiceButton";
import * as coachSpeech from "@/lib/audio/coachSpeech";

vi.mock("@/lib/audio/coachSpeech", () => ({
  speakCoachVoice: vi.fn(),
  stopCoachVoice: vi.fn(),
}));

describe("VoiceButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with initial label and calls speakCoachVoice on click", async () => {
    vi.mocked(coachSpeech.speakCoachVoice).mockResolvedValue();

    render(<VoiceButton text="りんごが 3こ あります。" />);

    const button = screen.getByRole("button", { name: /もんだいを かのはちゃんの声で よみあげる/i });
    expect(button).toBeDefined();
    expect(button.textContent).toContain("よみあげる");

    await act(async () => {
      fireEvent.click(button);
    });

    expect(coachSpeech.speakCoachVoice).toHaveBeenCalledWith("りんごが 3こ あります。", "happy");
    expect(button.textContent).toContain("もういちど よむ");
  });

  it("stops voice when clicked while playing", async () => {
    let finishSpeech: () => void = () => {};
    const speechPromise = new Promise<void>((resolve) => {
      finishSpeech = resolve;
    });

    vi.mocked(coachSpeech.speakCoachVoice).mockReturnValue(speechPromise);

    render(<VoiceButton text="みかんが 5こ" />);
    const button = screen.getByRole("button");

    // Start speaking
    act(() => {
      fireEvent.click(button);
    });

    expect(button.textContent).toContain("よんでいるよ♪");

    // Click again while playing -> calls stopCoachVoice
    act(() => {
      fireEvent.click(button);
    });

    expect(coachSpeech.stopCoachVoice).toHaveBeenCalled();
    expect(button.textContent).toContain("もういちど よむ");

    // Finish original speech promise
    await act(async () => {
      finishSpeech();
    });
  });
});
