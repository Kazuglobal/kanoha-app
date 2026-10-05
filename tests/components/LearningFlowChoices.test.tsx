import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LearningFlow } from "@/components/child/LearningFlow";

vi.mock("@/lib/audio/coachSpeech", () => ({
  playPraiseVoice: vi.fn(async () => ""),
  playEncourageVoice: vi.fn(async () => ""),
  preloadCoachVoices: vi.fn(),
  speakCoachVoice: vi.fn(async () => undefined),
  stopCoachVoice: vi.fn(),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

const englishDemo = {
  childId: "demo",
  problemId: "english-animals-2",
  question: "「dog」は どの どうぶつかな？",
  unit: "どうぶつ",
  subject: "english",
  correctAnswer: "🐶 いぬ",
  choices: ["🐶 いぬ", "🐱 ねこ", "🐰 うさぎ", "🐻 くま"],
  listenText: "dog",
} as const;

describe("LearningFlow with choices (english)", () => {
  it("shows an english badge, a listen button and tappable choices instead of a keypad", () => {
    render(<LearningFlow persisted={englishDemo} />);
    expect(screen.getByText("🔤 えいご")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "えいごの おとを きく" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /いぬ|ねこ|うさぎ|くま/ })).toHaveLength(4);
    expect(screen.queryByLabelText("数字キーパッド")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "こたえ" })).not.toBeInTheDocument();
  });

  it("hides practice until the child answers correctly, and lets them retry after a miss", async () => {
    const user = userEvent.setup();
    render(<LearningFlow persisted={englishDemo} />);
    expect(screen.queryByRole("button", { name: "れんしゅう 5もんへ" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "🐱 ねこ" }));
    expect((await screen.findByRole("status")).textContent).toMatch(/おしい/);
    expect(screen.queryByRole("button", { name: "れんしゅう 5もんへ" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "🐶 いぬ" }));
    expect((await screen.findByRole("status")).textContent).toMatch(/せいかい/);
    expect(screen.getByRole("button", { name: "れんしゅう 5もんへ" })).toBeInTheDocument();
  });

  it("speaks the english text in en-US when the listen button is pressed", async () => {
    const speak = vi.fn((utterance: { onend?: () => void }) => utterance.onend?.());
    vi.stubGlobal("speechSynthesis", { speak, cancel: vi.fn(), getVoices: () => [] });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        lang = "";
        rate = 1;
        onend?: () => void;
        constructor(public text: string) {}
      },
    );
    const user = userEvent.setup();
    render(<LearningFlow persisted={englishDemo} />);
    await user.click(screen.getByRole("button", { name: "えいごの おとを きく" }));
    expect(speak).toHaveBeenCalledWith(expect.objectContaining({ text: "dog", lang: "en-US" }));
    vi.unstubAllGlobals();
  });
});

describe("LearningFlow math keypad", () => {
  it("does not pop up the device keyboard while the on-screen keypad is shown", () => {
    render(<LearningFlow persisted={{ childId: "demo", problemId: "addition-1", question: "28 + 15 は いくつですか。", unit: "たし算", subject: "math", correctAnswer: "43" }} />);
    expect(screen.getByLabelText("数字キーパッド")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "こたえ" })).toHaveAttribute("inputmode", "none");
  });
});
