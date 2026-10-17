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

  it("turns on the microphone when tapped even if auto-mic was OFF and submits spoken answers smoothly", async () => {
    mockCheck();
    const instances: Array<{
      lang: string;
      start: ReturnType<typeof vi.fn>;
      abort: ReturnType<typeof vi.fn>;
      onresult: ((e: unknown) => void) | null;
      onerror: ((e?: { error?: string }) => void) | null;
      onend: (() => void) | null;
    }> = [];

    Object.defineProperty(window, "webkitSpeechRecognition", {
      configurable: true,
      value: class {
        lang = "en-US";
        continuous = false;
        interimResults = false;
        maxAlternatives = 1;
        start = vi.fn();
        abort = vi.fn();
        onresult: ((e: unknown) => void) | null = null;
        onerror: ((e?: { error?: string }) => void) | null = null;
        onend: (() => void) | null = null;
        constructor() {
          instances.push(this);
        }
      },
    });

    try {
      render(<EnglishTalkStage scene={scene} />);
      await userEvent.click(screen.getByRole("button", { name: /おはなしを はじめる/ }));

      // じどうマイクを一度OFFにしてから「こえで こたえる（タップでマイクON）」をタップ
      await userEvent.click(screen.getByRole("button", { name: /じどうマイク/ }));
      const micButton = await screen.findByRole("button", { name: /こえで こたえる（タップでマイクON）/ });
      await userEvent.click(micButton);

      expect(screen.getByRole("button", { name: /マイクON・そのまま声で話してね！/ })).toBeInTheDocument();
      const activeRecognition = instances[instances.length - 1];
      expect(activeRecognition.start).toHaveBeenCalled();

      // 音声認識結果を送信してリアルタイムに対話が進むことを確認
      activeRecognition.onresult?.({
        results: [[{ transcript: "It's a dog." }]],
      });

      expect(await screen.findByTestId("heard-utterance")).toHaveTextContent("It's a dog.");
      expect(await screen.findByText(/ばっちり つたわったよ/)).toBeInTheDocument();
    } finally {
      Reflect.deleteProperty(window, "webkitSpeechRecognition");
    }
  });

  it("recovers and turns on the microphone on user tap even after an initial auto-start 'not-allowed' error", async () => {
    mockCheck();
    const instances: Array<{
      lang: string;
      start: ReturnType<typeof vi.fn>;
      abort: ReturnType<typeof vi.fn>;
      onresult: ((e: unknown) => void) | null;
      onerror: ((e?: { error?: string }) => void) | null;
      onend: (() => void) | null;
    }> = [];

    Object.defineProperty(window, "webkitSpeechRecognition", {
      configurable: true,
      value: class {
        lang = "en-US";
        continuous = false;
        interimResults = false;
        maxAlternatives = 1;
        start = vi.fn();
        abort = vi.fn();
        onresult: ((e: unknown) => void) | null = null;
        onerror: ((e?: { error?: string }) => void) | null = null;
        onend: (() => void) | null = null;
        constructor() {
          instances.push(this);
        }
      },
    });

    try {
      render(<EnglishTalkStage scene={scene} />);
      await userEvent.click(screen.getByRole("button", { name: /おはなしを はじめる/ }));

      // Wait for auto-start instance and simulate browser blocking non-gesture auto-start with 'not-allowed'
      await vi.waitFor(() => expect(instances.length).toBeGreaterThan(0));
      const firstInstance = instances[instances.length - 1];
      firstInstance.onerror?.({ error: "not-allowed" });

      // Button should show "こえで こたえる（タップでマイクON）" and hint
      const micButton = await screen.findByRole("button", { name: /こえで こたえる（タップでマイクON）/ });
      expect(screen.getByText(/マイクボタンを1回タップしてマイクをONにしてね/)).toBeInTheDocument();

      // Now user taps the button directly -> must synchronously start recognition and turn ON
      await userEvent.click(micButton);
      expect(screen.getByRole("button", { name: /マイクON・そのまま声で話してね！/ })).toBeInTheDocument();
      const secondInstance = instances[instances.length - 1];
      expect(secondInstance).not.toBe(firstInstance);
      expect(secondInstance.start).toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(window, "webkitSpeechRecognition");
    }
  });
});
