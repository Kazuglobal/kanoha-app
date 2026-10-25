import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FinishedScreen } from "@/components/child/PracticeFlow";
import { speakCoachVoice } from "@/lib/audio/coachSpeech";

vi.mock("@/lib/audio/coachSpeech", () => ({
  speakCoachVoice: vi.fn(async () => undefined),
  playPraiseVoice: vi.fn(async () => ""),
  playEncourageVoice: vi.fn(async () => ""),
  preloadCoachVoices: vi.fn(),
  stopCoachVoice: vi.fn(),
}));

vi.mock("@/lib/audio/soundSystem", () => ({
  soundManager: { playCelebrate: vi.fn(), playCorrect: vi.fn(), playWrong: vi.fn(), playTap: vi.fn() },
}));

afterEach(() => {
  vi.clearAllMocks();
});

const renderFinished = (score: number) =>
  render(
    <FinishedScreen
      score={score}
      unit="水のかさ"
      readingMode="kanji_with_ruby"
      resultHref="/child/result"
      onRestart={() => undefined}
    />,
  );

describe("FinishedScreen voice", () => {
  it.each([5, 2])("does not speak by itself when it appears (score %i): voice is manual-play only", (score) => {
    renderFinished(score);
    expect(speakCoachVoice).not.toHaveBeenCalled();
  });

  it("speaks when the child taps the coach's speech bubble", async () => {
    renderFinished(5);
    await userEvent.click(screen.getByTitle(/声を きいてみてね/));
    expect(speakCoachVoice).toHaveBeenCalledTimes(1);
  });
});
