import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EnglishTalkStage } from "@/components/child/englishTalk/EnglishTalkStage";
import { TALK_SCENES } from "@/lib/curriculum/englishTalkScenes";
import { judgeTalkAnswer, toPublicScene } from "@/lib/englishTalk/judge";
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
    const correct = judgeTalkAnswer(turn, answer);
    const data = correct
      ? { correct }
      : { correct, modelAnswer: turn.modelAnswer, modelAnswerJa: turn.modelAnswerJa };
    return new Response(JSON.stringify({ success: true, data }), { status: 200 });
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EnglishTalkStage", () => {
  it("does not speak until the child taps start, then asks in English", async () => {
    render(<EnglishTalkStage scene={scene} />);
    expect(speech.speakTalkEnglish).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /おはなしを はじめる/ }));
    expect(screen.getByText("Look! What's this?")).toBeInTheDocument();
    expect(speech.speakTalkEnglish).toHaveBeenCalledWith("Look! What's this?");
  });

  it("asks again in Japanese when the child does not understand", async () => {
    render(<EnglishTalkStage scene={scene} />);
    await userEvent.click(screen.getByRole("button", { name: /おはなしを はじめる/ }));
    await userEvent.click(screen.getByRole("button", { name: /えいごが わからない/ }));
    expect(screen.getByText(turn.promptJa)).toBeInTheDocument();
    expect(speech.speakTalkJapanese).toHaveBeenCalled();
  });

  it("teaches the right answer after a mistake and asks the child to repeat it twice", async () => {
    mockCheck();
    render(<EnglishTalkStage scene={scene} />);
    await userEvent.click(screen.getByRole("button", { name: /おはなしを はじめる/ }));
    await userEvent.click(await screen.findByRole("button", { name: "It's a cat." }));

    expect(await screen.findByText("ただしい いいかた")).toBeInTheDocument();
    expect(screen.getByText("It's a dog.")).toBeInTheDocument();
    expect(screen.getByText(/いってみよう\(\d/)).toHaveTextContent("0 / 2");

    await userEvent.click(screen.getByRole("button", { name: "いえたよ！" }));
    expect(screen.getByText(/いってみよう\(\d/)).toHaveTextContent("1 / 2");
    await userEvent.click(screen.getByRole("button", { name: "いえたよ！" }));

    // まちがえた質問は最後にもう1回出る
    await userEvent.click(await screen.findByRole("button", { name: /つぎへ/ }));
    expect(screen.getByText("もういちど チャレンジ！")).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "It's a dog." }));
    await userEvent.click(await screen.findByRole("button", { name: /つぎへ/ }));
    expect(await screen.findByText("おはなし できたね！")).toBeInTheDocument();
    expect(screen.getByText(/さいしょで つたわった/)).toHaveTextContent("0 / 1");
  });
});
