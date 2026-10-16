import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EnglishTalkStage } from "@/components/child/englishTalk/EnglishTalkStage";
import { TALK_SCENES } from "@/lib/curriculum/englishTalkScenes";
import { buildCorrectiveFeedbackEn, isDontKnowAnswer, judgeTalkAnswer, toPublicScene } from "@/lib/englishTalk/judge";
import * as speech from "@/lib/audio/englishTalkSpeech";

vi.mock("@/lib/audio/englishTalkSpeech", () => ({
  speakTalkEnglish: vi.fn(async () => undefined),
  speakTalkJapanese: vi.fn(async () => undefined),
  stopTalkSpeech: vi.fn(),
}));

vi.mock("@/lib/audio/soundSystem", () => ({
  soundManager: { playCorrect: vi.fn(), playWrong: vi.fn() },
}));

const sceneData = TALK_SCENES.find(({ id }) => id === "park")!;
const scene = { ...toPublicScene(sceneData), turns: toPublicScene(sceneData).turns.slice(1, 2) };
const turn = sceneData.turns[1];

/** サーバーの判定(/api/english-talk/check)をテスト内で再現する。 */
const mockCheck = () =>
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    const { answer } = JSON.parse(String(init?.body ?? "{}"));
    if (isDontKnowAnswer(answer)) {
      return new Response(JSON.stringify({ success: true, data: { correct: false, isDontKnow: true } }), { status: 200 });
    }
    const correct = judgeTalkAnswer(turn, answer);
    const data = correct
      ? { correct }
      : {
          correct,
          feedbackEn: buildCorrectiveFeedbackEn(turn),
          modelAnswer: turn.modelAnswer,
          modelAnswerJa: turn.modelAnswerJa,
        };
    return new Response(JSON.stringify({ success: true, data }), { status: 200 });
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EnglishTalkStage", () => {
  it("renders the Three.js 3D stage, does not show 4-choice buttons, and speaks in English after start", async () => {
    render(<EnglishTalkStage scene={scene} />);
    expect(screen.getByTestId("three-talk-stage")).toBeInTheDocument();
    expect(speech.speakTalkEnglish).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /おはなしを はじめる/ }));
    expect(screen.getByText("Look! What's this?")).toBeInTheDocument();
    expect(speech.speakTalkEnglish).toHaveBeenCalledWith("Look! What's this?");
    // 選択肢(4択ボタン)は出さず、声で対話する
    expect(screen.queryByRole("button", { name: "It's a cat." })).not.toBeInTheDocument();
  });

  it("translates to Japanese when the child says 'I don't know' or 'わからない'", async () => {
    render(<EnglishTalkStage scene={scene} />);
    await userEvent.click(screen.getByRole("button", { name: /おはなしを はじめる/ }));

    const input = screen.getByLabelText("声でつたえることば");
    await userEvent.type(input, "I don't know");
    await userEvent.click(screen.getByRole("button", { name: /はなす/ }));

    expect(screen.getByText(turn.promptJa)).toBeInTheDocument();
    expect(speech.speakTalkJapanese).toHaveBeenCalled();
    // 不正解(teachフェーズ)にはならず、そのまま英語で答えられる
    expect(screen.queryByText("ただしい いいかた")).not.toBeInTheDocument();
  });

  it("immediately gives English corrective feedback when wrong and asks the child to repeat it", async () => {
    mockCheck();
    render(<EnglishTalkStage scene={scene} />);
    await userEvent.click(screen.getByRole("button", { name: /おはなしを はじめる/ }));
    // 自動進行タイマーを止めてステップごとに検証する
    await userEvent.click(screen.getByRole("button", { name: /じどうマイク/ }));

    const input = screen.getByLabelText("声でつたえることば");
    await userEvent.type(input, "It's a cat.");
    await userEvent.click(screen.getByRole("button", { name: /はなす/ }));

    expect(await screen.findByText("ただしい いいかた")).toBeInTheDocument();
    expect(screen.getByText("It's a dog.")).toBeInTheDocument();
    expect(screen.getByTestId("english-feedback-bubble")).toHaveTextContent(
      "Close! Look closely, this is a dog! Say: It's a dog.",
    );
    expect(speech.speakTalkEnglish).toHaveBeenCalledWith(
      "Close! Look closely, this is a dog! Say: It's a dog.",
      "think",
    );
    expect(screen.getByText(/まねして いおう \d/)).toHaveTextContent("0 / 2");

    await userEvent.click(screen.getByRole("button", { name: "いえたよ！" }));
    expect(screen.getByText(/まねして いおう \d/)).toHaveTextContent("1 / 2");
    await userEvent.click(screen.getByRole("button", { name: "いえたよ！" }));

    // まちがえた質問は最後にもう1回出る
    await userEvent.click(await screen.findByRole("button", { name: /つぎの場面へ/ }));
    expect(screen.getByText("もういちど チャレンジ！")).toBeInTheDocument();

    const retryInput = screen.getByLabelText("声でつたえることば");
    await userEvent.type(retryInput, "It's a dog.");
    await userEvent.click(screen.getByRole("button", { name: /はなす/ }));

    await userEvent.click(await screen.findByRole("button", { name: /つぎの場面へ/ }));
    expect(await screen.findByText("おはなし できたね！")).toBeInTheDocument();
    expect(screen.getByText(/さいしょで つたわった/)).toHaveTextContent("0 / 1");
  });
});
