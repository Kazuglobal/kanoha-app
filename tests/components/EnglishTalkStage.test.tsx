import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EnglishTalkStage } from "@/components/child/englishTalk/EnglishTalkStage";
import { TALK_SCENES } from "@/lib/curriculum/englishTalkScenes";
import { judgeTalkAnswer, toPublicScene } from "@/lib/englishTalk/judge";
import * as speech from "@/lib/audio/englishTalkSpeech";

vi.mock("@/lib/audio/englishTalkSpeech", () => ({
  speakTalkEnglish: vi.fn(async () => undefined),
  speakTalkJapanese: vi.fn(async () => undefined),
  stopTalkSpeech: vi.fn(),
}));

vi.mock("@/lib/audio/coachSpeech", () => ({
  preloadCoachVoices: vi.fn(),
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

/** 音声認識のにせもの: start() すると、次に話すことば(nextSpeech)を結果として返す。 */
let nextSpeech = "";
class FakeRecognition {
  lang = "";
  onresult: (event: { results: { transcript: string }[][] }) => void = () => undefined;
  onerror = () => undefined;
  start() {
    queueMicrotask(() => this.onresult({ results: [[{ transcript: nextSpeech }]] }));
  }
  abort() {}
}

const say = async (name: RegExp, speech: string) => {
  nextSpeech = speech;
  await userEvent.click(await screen.findByRole("button", { name }));
};

beforeEach(() => {
  vi.stubGlobal("SpeechRecognition", FakeRecognition);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.mocked(speech.speakTalkEnglish).mockClear();
  vi.mocked(speech.speakTalkJapanese).mockClear();
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

  it("answers by voice only (no 4 choices) when speech recognition is available", async () => {
    render(<EnglishTalkStage scene={scene} />);
    await userEvent.click(screen.getByRole("button", { name: /おはなしを はじめる/ }));
    expect(await screen.findByRole("button", { name: /こえで こたえる/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "It's a cat." })).not.toBeInTheDocument();
  });

  it("falls back to choices when speech recognition is not available", async () => {
    vi.unstubAllGlobals();
    render(<EnglishTalkStage scene={scene} />);
    await userEvent.click(screen.getByRole("button", { name: /おはなしを はじめる/ }));
    expect(screen.queryByRole("button", { name: /こえで こたえる/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "It's a cat." })).toBeInTheDocument();
  });

  it("encourages right away after a wrong voice answer, has the child repeat by voice, then asks again", async () => {
    mockCheck();
    render(<EnglishTalkStage scene={scene} />);
    await userEvent.click(screen.getByRole("button", { name: /おはなしを はじめる/ }));
    await say(/こえで こたえる/, "It's a cat");

    // すぐに はげまして、正しい言い方を声で聞かせる
    expect(await screen.findByText("ただしい いいかた")).toBeInTheDocument();
    expect(screen.getByText(/おしい|だいじょうぶ/)).toBeInTheDocument();
    expect(screen.getByText(/きこえた ことば/)).toHaveTextContent("It's a cat");
    expect(speech.speakTalkJapanese).toHaveBeenCalled();
    await vi.waitFor(() => expect(speech.speakTalkEnglish).toHaveBeenCalledWith("It's a dog.", "think"));
    // 声が使えるときは、さいしょは自己申告できない
    expect(screen.queryByRole("button", { name: "いえたよ！" })).not.toBeInTheDocument();

    // 聞き取れなかったら、もういちど(はげましつき)
    await say(/まねして いう/, "hello");
    expect(await screen.findByText(/もう いちど|まねしてね/)).toBeInTheDocument();
    expect(screen.getByText(/まねして いおう \d/)).toHaveTextContent("0 / 2");

    await say(/もういちど いう/, "It's a dog");
    await vi.waitFor(() => expect(screen.getByText(/まねして いおう \d/)).toHaveTextContent("1 / 2"));
    await say(/まねして いう/, "It is a dog");

    // まねできたら、おなじ質問をすぐにもう1回きく
    expect(await screen.findByText("もういちど チャレンジ！")).toBeInTheDocument();
    expect(screen.getByText(/もういちど きくね/)).toBeInTheDocument();
    await say(/こえで こたえる/, "It's a dog");
    expect(await screen.findByText("できた！ ちゃんと いえたね！")).toBeInTheDocument();

    // まちがえた質問は最後にもう1回出る
    await userEvent.click(await screen.findByRole("button", { name: /つぎへ/ }));
    expect(screen.getByText("もういちど チャレンジ！")).toBeInTheDocument();
    await say(/こえで こたえる/, "It's a dog");
    await userEvent.click(await screen.findByRole("button", { name: /つぎへ/ }));
    expect(await screen.findByText("おはなし できたね！")).toBeInTheDocument();
    expect(screen.getByText(/さいしょで つたわった/)).toHaveTextContent("0 / 1");
  });

  it("lets the child move on with いえたよ after the voice repeat keeps failing", async () => {
    mockCheck();
    render(<EnglishTalkStage scene={scene} />);
    await userEvent.click(screen.getByRole("button", { name: /おはなしを はじめる/ }));
    await say(/こえで こたえる/, "cat");
    await say(/まねして いう/, "hmm");
    await say(/もういちど いう/, "hmm");
    await userEvent.click(await screen.findByRole("button", { name: "いえたよ！" }));
    expect(screen.getByText(/まねして いおう \d/)).toHaveTextContent("1 / 2");
  });
});
