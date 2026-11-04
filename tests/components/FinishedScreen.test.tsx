import { cleanup, render, screen } from "@testing-library/react";
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

describe("FinishedScreen links", () => {
  it("ホームへのリンクは 渡された行き先(子ども・教科つき)へ。渡されなければ /child/home", () => {
    const { unmount } = renderFinished(5);
    expect(screen.getByRole("link", { name: /ステージマップへ もどる/ })).toHaveAttribute("href", "/child/home");
    unmount();
    render(
      <FinishedScreen score={5} unit="たし算" readingMode="kanji_with_ruby" resultHref="/child/result" homeHref="/child/home?childId=c1&subject=english" onRestart={() => undefined} />,
    );
    expect(screen.getByRole("link", { name: /ステージマップへ もどる/ })).toHaveAttribute("href", "/child/home?childId=c1&subject=english");
  });

  it("「あたらしい もんだい」のセットの最後の問題のあとは 「ぜんぶ できたね」を出す", () => {
    render(<FinishedScreen score={5} unit="たし算" readingMode="kanji_with_ruby" resultHref="/child/result" setClear onRestart={() => undefined} />);
    expect(screen.getByText("🎉 あたらしい もんだい ぜんぶ できたね！")).toBeInTheDocument();
    cleanup();
    renderFinished(5);
    expect(screen.queryByText(/ぜんぶ できたね/)).toBeNull();
  });
});

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
