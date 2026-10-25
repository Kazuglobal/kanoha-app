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
  preloadTalkSceneSpeech: vi.fn(),
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

  it("keeps the microphone ON when tapped even if Web Speech API immediately fails with 'network' or 'not-allowed'", async () => {
    mockCheck();
    const stopTrack = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: stopTrack }],
        }),
      },
    });

    Object.defineProperty(window, "webkitSpeechRecognition", {
      configurable: true,
      value: class {
        lang = "en-US";
        continuous = false;
        interimResults = false;
        maxAlternatives = 1;
        onresult: ((e: unknown) => void) | null = null;
        onerror: ((e?: { error?: string }) => void) | null = null;
        onend: (() => void) | null = null;
        abort = vi.fn();
        start = vi.fn(() => {
          // Simulate Chrome/Edge immediately failing Web Speech API on start()
          this.onerror?.({ error: "not-allowed" });
          this.onend?.();
        });
      },
    });

    try {
      render(<EnglishTalkStage scene={scene} />);
      await userEvent.click(screen.getByRole("button", { name: /おはなしを はじめる/ }));

      // Turn auto-mic OFF first so we can explicitly test tapping "こえで こたえる（タップでマイクON）"
      await userEvent.click(screen.getByRole("button", { name: /じどうマイク/ }));
      const micButton = await screen.findByRole("button", { name: /こえで こたえる（タップでマイクON）/ });
      await userEvent.click(micButton);

      // Even though Web Speech API fired onerror('not-allowed') + onend() synchronously, the mic MUST stay ON via getUserMedia VAD!
      expect(screen.getByRole("button", { name: /マイクON・そのまま声で話してね！/ })).toBeInTheDocument();
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(window, "webkitSpeechRecognition");
      Reflect.deleteProperty(navigator, "mediaDevices");
    }
  });

  it("shows the friend badge, toggles hint choices on demand, and records reward & scene star progress", async () => {
    mockCheck();
    const { getRewardState } = await import("@/lib/rewards/rewardStore");
    const { getEnglishTalkProgress } = await import("@/lib/englishTalk/progressStore");
    const beforeCorrect = getRewardState().totalCorrectCount;

    render(<EnglishTalkStage scene={scene} />);
    expect(screen.getByTestId("scene-friend-badge")).toHaveTextContent("リクくん");

    await userEvent.click(screen.getByRole("button", { name: /おはなしを はじめる/ }));
    await userEvent.click(screen.getByRole("button", { name: /じどうマイク/ }));

    // Open hint choices and select the correct answer by tap
    await userEvent.click(screen.getByRole("button", { name: /こたえの ヒント（えらんで こたえる）/ }));
    await userEvent.click(screen.getByRole("button", { name: "It's a dog." }));

    expect(await screen.findByText(/ばっちり つたわったよ/)).toBeInTheDocument();
    expect(getRewardState().totalCorrectCount).toBe(beforeCorrect + 1);

    await userEvent.click(await screen.findByRole("button", { name: /つぎの場面へ/ }));
    expect(await screen.findByText("おはなし できたね！")).toBeInTheDocument();
    expect(getEnglishTalkProgress().park?.stars).toBe(3);
  });

  it("dynamically adapts the second shop turn to the fruit chosen in the first turn", async () => {
    const shopData = TALK_SCENES.find(({ id }) => id === "shop")!;
    const shopScene = { ...toPublicScene(shopData), turns: toPublicScene(shopData).turns.slice(0, 2) };

    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const { turnId, answer } = JSON.parse(String(init?.body ?? "{}"));
      const t = shopData.turns.find(({ id }) => id === turnId)!;
      const correct = judgeTalkAnswer(t, answer);
      return new Response(JSON.stringify({ success: true, data: { correct } }), { status: 200 });
    });

    render(<EnglishTalkStage scene={shopScene} />);
    await userEvent.click(screen.getByRole("button", { name: /おはなしを はじめる/ }));
    await userEvent.click(screen.getByRole("button", { name: /じどうマイク/ }));

    const input = screen.getByLabelText("声でつたえることば");
    await userEvent.type(input, "Bananas, please.");
    await userEvent.click(screen.getByRole("button", { name: /はなす/ }));

    await userEvent.click(await screen.findByRole("button", { name: /つぎの場面へ/ }));
    expect(await screen.findByText("How many bananas?")).toBeInTheDocument();
    expect(screen.getByText("🍌🍌🍌")).toBeInTheDocument();
  });
});

describe("EnglishTalkStage rewards for a signed-in child", () => {
  const CHILD_ID = "cccccccc-3333-4333-8333-cccccccccccc";

  /** ログイン中のサーバー応答。reward があれば「サーバーが数えた」。 */
  const mockServerCheck = (reward?: Record<string, unknown>) =>
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const { answer } = JSON.parse(String(init?.body ?? "{}"));
      const correct = judgeTalkAnswer(turn, answer);
      return new Response(JSON.stringify({ success: true, data: { correct, ...(reward ? { reward } : {}) } }), {
        status: 200,
      });
    });

  const answerCorrectly = async () => {
    await userEvent.click(screen.getByRole("button", { name: /おはなしを はじめる/ }));
    await userEvent.click(screen.getByRole("button", { name: /じどうマイク/ }));
    await userEvent.click(screen.getByRole("button", { name: /こたえの ヒント（えらんで こたえる）/ }));
    await userEvent.click(screen.getByRole("button", { name: "It's a dog." }));
    expect(await screen.findByText(/ばっちり つたわったよ/)).toBeInTheDocument();
  };

  it("claims the reward from the server (firstTry) and shows the server's count instead of adding on the device", async () => {
    const fetchSpy = mockServerCheck({ currentCycleCount: 7, totalCorrectCount: 57, totalRewardYen: 25 });
    const { getRewardState } = await import("@/lib/rewards/rewardStore");
    const before = getRewardState().totalCorrectCount;

    render(<EnglishTalkStage scene={scene} childId={CHILD_ID} />);
    await answerCorrectly();

    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body).toMatchObject({ childId: CHILD_ID, firstTry: true });
    expect(getRewardState()).toMatchObject({ totalCorrectCount: 57, totalRewardYen: 25 });
    expect(before).not.toBe(57);
  });

  it("does not add anything on the device when the server did not count it (already cleared today)", async () => {
    mockServerCheck();
    const { getRewardState } = await import("@/lib/rewards/rewardStore");
    const before = getRewardState();

    render(<EnglishTalkStage scene={scene} childId={CHILD_ID} />);
    await answerCorrectly();

    expect(getRewardState()).toEqual(before);
  });
});
