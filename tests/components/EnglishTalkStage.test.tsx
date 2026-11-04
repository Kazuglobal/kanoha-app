import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EnglishTalkStage } from "@/components/child/englishTalk/EnglishTalkStage";
import { TALK_SCENES } from "@/lib/curriculum/englishTalkScenes";
import { buildCorrectiveFeedbackEn, isDontKnowAnswer, judgeTalk, toPublicScene } from "@/lib/englishTalk/judge";
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

const CHILD_ID = "cccccccc-3333-4333-8333-cccccccccccc";

const sceneOf = (id: string, from: number, to: number) => {
  const data = TALK_SCENES.find((scene) => scene.id === id)!;
  const publicScene = toPublicScene(data);
  return { ...publicScene, turns: publicScene.turns.slice(from, to) };
};
const DOG_SCENE = sceneOf("park", 1, 2);
const DOG_TURN = TALK_SCENES.find(({ id }) => id === "park")!.turns[1];
const TWO_TURN_SCENE = sceneOf("park", 1, 3);
const SHOP_SCENE = sceneOf("shop", 0, 2);

const TURNS_BY_ID = new Map(TALK_SCENES.flatMap(({ turns }) => turns).map((turn) => [turn.id, turn]));
const reply = (data: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify({ success: true, data }), { status });

/** サーバーの判定(/api/english-talk/check)をテスト内で再現する。override が Response を返したらそれを使う。 */
const mockCheck = (override?: (body: Record<string, unknown>) => Response | undefined) =>
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    const custom = override?.(body);
    if (custom) return custom;
    const turn = TURNS_BY_ID.get(body.turnId)!;
    if (body.mode === "voice" && isDontKnowAnswer(body.answer)) return reply({ correct: false, isDontKnow: true });
    const judged = judgeTalk(turn, body.answer, body.mode);
    if (judged.correct) return reply({ correct: true });
    if (judged.needsEnglish) return reply({ correct: false, needsEnglish: true });
    return reply({
      correct: false,
      ...(body.mode === "voice" ? { feedbackEn: buildCorrectiveFeedbackEn(turn) } : {}),
      modelAnswer: turn.modelAnswer,
      modelAnswerJa: turn.modelAnswerJa,
    });
  });

interface FakeRecognition {
  start: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event?: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

/** Web Speech API のにせもの。say() で「いま聞いているマイクに声が聞こえた」ことにする。 */
const installSpeechRecognition = () => {
  const instances: FakeRecognition[] = [];
  Object.defineProperty(window, "webkitSpeechRecognition", {
    configurable: true,
    value: class {
      lang = "en-US";
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      start = vi.fn();
      abort = vi.fn();
      onresult: FakeRecognition["onresult"] = null;
      onerror: FakeRecognition["onerror"] = null;
      onend: FakeRecognition["onend"] = null;
      constructor() {
        instances.push(this as unknown as FakeRecognition);
      }
    },
  });
  return {
    instances,
    say: async (transcript: string) => {
      await act(async () => {
        instances[instances.length - 1].onresult?.({ results: [[{ transcript }]] });
      });
    },
  };
};

const startButton = () => screen.getByRole("button", { name: /おはなしを はじめる/ });
const micButton = () => screen.getByRole("button", { name: /こえで こたえる（タップでマイクON）/ });
const nextButton = () => screen.findByRole("button", { name: /^(つぎへ|おわる) ▶$/ });
const spokenPrompts = (prompt: string) =>
  vi.mocked(speech.speakTalkEnglish).mock.calls.filter(([text]) => text === prompt);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => {
  localStorage.clear();
  vi.mocked(speech.speakTalkEnglish).mockClear();
  vi.mocked(speech.speakTalkJapanese).mockClear();
  vi.mocked(speech.preloadTalkSceneSpeech).mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "webkitSpeechRecognition");
  Reflect.deleteProperty(navigator, "mediaDevices");
});

describe("EnglishTalkStage: 話しかけるまで", () => {
  it("3Dステージを出し、はじめるを押すまで何も読まない。文字を打つ欄も4択もない", async () => {
    render(<EnglishTalkStage scene={DOG_SCENE} />);
    expect(screen.getByTestId("three-talk-stage")).toBeInTheDocument();
    expect(speech.speakTalkEnglish).not.toHaveBeenCalled();

    await userEvent.click(startButton());
    expect(screen.getByText("Look! What's this?")).toBeInTheDocument();
    expect(speech.speakTalkEnglish).toHaveBeenCalledWith("Look! What's this?");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "It's a cat." })).not.toBeInTheDocument();
  });

  it("デモ(ログインなし)は、マイクのボタンを押した1回だけ聞く。じどうマイクの切りかえは出さない", async () => {
    const mic = installSpeechRecognition();
    render(<EnglishTalkStage scene={DOG_SCENE} />);
    await userEvent.click(startButton());

    expect(screen.queryByRole("button", { name: /じどうマイク/ })).not.toBeInTheDocument();
    await wait(300);
    expect(mic.instances).toHaveLength(0);

    await userEvent.click(micButton());
    expect(mic.instances).toHaveLength(1);
    expect(mic.instances[0].start).toHaveBeenCalled();
  });

  it("ログイン中の子は、いままでどおりマイクが自動で入る", async () => {
    const mic = installSpeechRecognition();
    render(<EnglishTalkStage scene={DOG_SCENE} childId={CHILD_ID} />);
    await userEvent.click(startButton());

    await vi.waitFor(() => expect(mic.instances.length).toBeGreaterThan(0));
    expect(screen.getByRole("button", { name: /じどうマイク: ON/ })).toBeInTheDocument();
  });
});

describe("EnglishTalkStage: こたえる", () => {
  it("「I don't know」と言うと日本語にして教える。まちがいにはしない", async () => {
    mockCheck();
    const mic = installSpeechRecognition();
    render(<EnglishTalkStage scene={DOG_SCENE} />);
    await userEvent.click(startButton());
    await userEvent.click(micButton());
    await mic.say("I don't know");

    expect(await screen.findByText(DOG_TURN.promptJa)).toBeInTheDocument();
    expect(speech.speakTalkJapanese).toHaveBeenCalled();
    expect(screen.queryByText("ただしい いいかた")).not.toBeInTheDocument();
  });

  it("まちがえたら英語ですぐ正しい言い方を教え、まねして言ってもらう。つぎへを押すと もういちど 出る", async () => {
    mockCheck();
    const mic = installSpeechRecognition();
    render(<EnglishTalkStage scene={DOG_SCENE} />);
    await userEvent.click(startButton());
    await userEvent.click(micButton());
    await mic.say("It's a cat.");

    expect(await screen.findByText("ただしい いいかた")).toBeInTheDocument();
    expect(screen.getByText("It's a dog.")).toBeInTheDocument();
    expect(screen.getByTestId("english-feedback-bubble")).toHaveTextContent(
      "Close! Look closely, this is a dog! Say: It's a dog.",
    );
    expect(speech.speakTalkEnglish).toHaveBeenCalledWith("Close! Look closely, this is a dog! Say: It's a dog.", "think");
    expect(screen.getByText(/まねして いおう \d/)).toHaveTextContent("0 / 2");
    // 声が使えるあいだは、自己申告の「いえたよ！」は出さない
    expect(screen.queryByRole("button", { name: "いえたよ！" })).not.toBeInTheDocument();

    for (const expected of ["1 / 2"]) {
      await userEvent.click(micButton());
      await mic.say("It's a dog.");
      expect(await screen.findByText(/まねして いおう \d/)).toHaveTextContent(expected);
    }
    await userEvent.click(micButton());
    await mic.say("It's a dog.");

    await userEvent.click(await nextButton());
    expect(screen.getByText("もういちど チャレンジ！")).toBeInTheDocument();

    await userEvent.click(micButton());
    await mic.say("It's a dog.");
    await userEvent.click(await nextButton());

    expect(await screen.findByText("おはなし できたね！")).toBeInTheDocument();
    expect(screen.getByText(/さいしょで つたわった/)).toHaveTextContent("0 / 1");

    // おてほんを見たフレーズを見なおせる。聞くのはタップしたときだけ
    const review = screen.getByRole("region", { name: "きょう れんしゅうした ことば" });
    expect(within(review).getByText("It's a dog.")).toBeInTheDocument();
    expect(within(review).getByText("いぬだよ。")).toBeInTheDocument();
    vi.mocked(speech.speakTalkEnglish).mockClear();
    await userEvent.click(within(review).getByRole("button", { name: "It's a dog. を きく" }));
    expect(speech.speakTalkEnglish).toHaveBeenCalledWith("It's a dog.");
  });

  it("日本語だけの答えはまちがいにせず、英語で言ってもらう(おてほんも出さない)", async () => {
    mockCheck();
    const mic = installSpeechRecognition();
    render(<EnglishTalkStage scene={DOG_SCENE} />);
    await userEvent.click(startButton());
    await userEvent.click(micButton());
    await mic.say("いぬ");

    expect(await screen.findByText(/にほんごだね/)).toBeInTheDocument();
    expect(screen.queryByText("ただしい いいかた")).not.toBeInTheDocument();
    expect(micButton()).toBeInTheDocument();
  });

  it("おみせで選んだ くだものに合わせて2つ目の問いが変わり、その文脈をサーバーへ送る", async () => {
    const fetchSpy = mockCheck();
    const mic = installSpeechRecognition();
    render(<EnglishTalkStage scene={SHOP_SCENE} />);
    await userEvent.click(startButton());
    await userEvent.click(micButton());
    await mic.say("Bananas, please.");

    await userEvent.click(await nextButton());
    expect(await screen.findByText("How many bananas?")).toBeInTheDocument();
    expect(screen.getByText("🍌🍌🍌")).toBeInTheDocument();
    expect(speech.speakTalkEnglish).toHaveBeenCalledWith("How many bananas?");

    await userEvent.click(screen.getByRole("button", { name: /こたえの ヒント（えらんで こたえる）/ }));
    await userEvent.click(screen.getByRole("button", { name: "Three, please." }));
    await screen.findByText(/ばっちり つたわったよ/);
    const lastBody = JSON.parse(String(fetchSpy.mock.calls.at(-1)?.[1]?.body));
    expect(lastBody).toMatchObject({ turnId: "shop-how-many", context: { fruit: "banana" } });
  });
});

describe("EnglishTalkStage: つぎへ(次の問いは、タップしたときだけ読む)", () => {
  it("正解しても、自動では次へ進まず次の問いも読まない。つぎへを押すと読む", async () => {
    mockCheck();
    const mic = installSpeechRecognition();
    render(<EnglishTalkStage scene={TWO_TURN_SCENE} />);
    await userEvent.click(startButton());
    await userEvent.click(micButton());
    await mic.say("It's a dog.");
    expect(await screen.findByText(/ばっちり つたわったよ/)).toBeInTheDocument();

    await wait(1500);
    expect(spokenPrompts("What color is the ball?")).toHaveLength(0);
    expect(screen.getByText("Look! What's this?")).toBeInTheDocument();

    await userEvent.click(await nextButton());
    expect(screen.getByText("What color is the ball?")).toBeInTheDocument();
    expect(spokenPrompts("What color is the ball?")).toHaveLength(1);
  });

  it("つぎへを続けて2回押しても、次の問いは1回だけ読む", async () => {
    mockCheck();
    const mic = installSpeechRecognition();
    render(<EnglishTalkStage scene={TWO_TURN_SCENE} />);
    await userEvent.click(startButton());
    await userEvent.click(micButton());
    await mic.say("It's a dog.");

    await userEvent.dblClick(await nextButton());
    expect(spokenPrompts("What color is the ball?")).toHaveLength(1);
  });
});

describe("EnglishTalkStage: ヘルプ(4択・日本語)と ★", () => {
  it("4択で答えると、ごほうびは数えるが ★ は3から2に下がる", async () => {
    mockCheck();
    const { getRewardState } = await import("@/lib/rewards/rewardStore");
    const { getEnglishTalkProgress } = await import("@/lib/englishTalk/progressStore");
    const before = getRewardState().totalCorrectCount;

    render(<EnglishTalkStage scene={DOG_SCENE} />);
    expect(screen.getByTestId("scene-friend-badge")).toHaveTextContent("リクくん");
    await userEvent.click(startButton());
    await userEvent.click(screen.getByRole("button", { name: /こたえの ヒント（えらんで こたえる）/ }));
    await userEvent.click(screen.getByRole("button", { name: "It's a dog." }));

    expect(await screen.findByText(/ばっちり つたわったよ/)).toBeInTheDocument();
    expect(getRewardState().totalCorrectCount).toBe(before + 1);

    await userEvent.click(await nextButton());
    expect(await screen.findByText("おはなし できたね！")).toBeInTheDocument();
    expect(getEnglishTalkProgress().park?.stars).toBe(2);
  });

  it("ヘルプを使わず1回で言えたら ★3", async () => {
    mockCheck();
    const { getEnglishTalkProgress } = await import("@/lib/englishTalk/progressStore");
    const mic = installSpeechRecognition();
    render(<EnglishTalkStage scene={DOG_SCENE} />);
    await userEvent.click(startButton());
    await userEvent.click(micButton());
    await mic.say("It's a dog.");
    await userEvent.click(await nextButton());
    await screen.findByText("おはなし できたね！");
    expect(getEnglishTalkProgress().park?.stars).toBe(3);
  });
});

describe("EnglishTalkStage: 声が使えないとき・親の設定", () => {
  it("マイクが使えない端末では、4択をはじめから出す(ヒントの出し入れボタンは要らない)", async () => {
    mockCheck();
    render(<EnglishTalkStage scene={DOG_SCENE} />);
    await userEvent.click(startButton());
    await userEvent.click(micButton());

    const group = await screen.findByRole("group", { name: "こたえの ヒント せんたくし" });
    expect(within(group).getByRole("button", { name: "It's a dog." })).toBeInTheDocument();
    expect(screen.getByText(/マイクが つかえないよ/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /こたえの ヒント（えらんで こたえる）/ })).not.toBeInTheDocument();
  });

  it("マイクが使えないとわかったあとの まねして言うでは、「いえたよ！」でも進められる", async () => {
    mockCheck();
    render(<EnglishTalkStage scene={DOG_SCENE} />);
    await userEvent.click(startButton());
    await userEvent.click(micButton());
    await userEvent.click(await screen.findByRole("button", { name: "It's a cat." }));
    await screen.findByText("ただしい いいかた");

    await userEvent.click(screen.getByRole("button", { name: "いえたよ！" }));
    await wait(400); // 続けて押した2回は1回ぶん(ダブルタップ対策)
    await userEvent.click(screen.getByRole("button", { name: "いえたよ！" }));
    expect(await nextButton()).toBeInTheDocument();
  });

  it("ログイン中でマイクが使えないときも、自動で4択に切りかわる", async () => {
    render(<EnglishTalkStage scene={DOG_SCENE} childId={CHILD_ID} />);
    await userEvent.click(startButton());
    expect(await screen.findByRole("group", { name: "こたえの ヒント せんたくし" })).toBeInTheDocument();
  });

  it("親の設定で声のこたえがオフなら、マイクは出さず4択だけ", async () => {
    mockCheck();
    render(<EnglishTalkStage scene={DOG_SCENE} settings={{ enableVoiceAnswer: false }} />);
    await userEvent.click(startButton());
    expect(screen.queryByRole("button", { name: /こえで こたえる/ })).not.toBeInTheDocument();
    await userEvent.click(within(screen.getByRole("group", { name: "こたえの ヒント せんたくし" })).getByRole("button", { name: "It's a dog." }));
    expect(await screen.findByText(/ばっちり つたわったよ/)).toBeInTheDocument();
  });

  it("声が使えず まねして言えないときだけ「いえたよ！」で進める", async () => {
    mockCheck();
    render(<EnglishTalkStage scene={DOG_SCENE} settings={{ enableVoiceAnswer: false }} />);
    await userEvent.click(startButton());
    await userEvent.click(screen.getByRole("button", { name: "It's a cat." }));
    await screen.findByText("ただしい いいかた");

    await userEvent.click(screen.getByRole("button", { name: "いえたよ！" }));
    await wait(400); // 続けて押した2回は1回ぶん(ダブルタップ対策)
    await userEvent.click(screen.getByRole("button", { name: "いえたよ！" }));
    expect(await nextButton()).toBeInTheDocument();
  });

  it("親の設定で音がオフなら、読み上げを一度も呼ばず、聞くボタンも出さない", async () => {
    mockCheck();
    render(<EnglishTalkStage scene={DOG_SCENE} settings={{ enableAudio: false, enableVoiceAnswer: false }} />);
    await userEvent.click(startButton());
    expect(screen.queryByRole("button", { name: /もういちど きく/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "It's a cat." }));
    await screen.findByText("ただしい いいかた");
    expect(screen.queryByRole("button", { name: /おてほんを きく/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "いえたよ！" }));
    await wait(400); // 続けて押した2回は1回ぶん(ダブルタップ対策)
    await userEvent.click(screen.getByRole("button", { name: "いえたよ！" }));
    await userEvent.click(await nextButton());
    await userEvent.click(screen.getByRole("button", { name: "It's a dog." }));
    await screen.findByText(/ばっちり つたわったよ/);

    expect(speech.speakTalkEnglish).not.toHaveBeenCalled();
    expect(speech.speakTalkJapanese).not.toHaveBeenCalled();
    expect(speech.preloadTalkSceneSpeech).not.toHaveBeenCalled();
  });
});

describe("EnglishTalkStage: 通信がうまくいかないとき", () => {
  const answerByChoice = async () => {
    await userEvent.click(startButton());
    await userEvent.click(screen.getByRole("button", { name: /こたえの ヒント（えらんで こたえる）/ }));
    await userEvent.click(screen.getByRole("button", { name: "It's a dog." }));
  };

  it("回数の上限(429)は「やすもう」と伝える", async () => {
    mockCheck(() => new Response(JSON.stringify({ success: false }), { status: 429 }));
    render(<EnglishTalkStage scene={DOG_SCENE} />);
    await answerByChoice();
    expect(await screen.findByText(/ちょっと やすもう/)).toBeInTheDocument();
  });

  it("つながらないときは、それを伝える", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    render(<EnglishTalkStage scene={DOG_SCENE} />);
    await answerByChoice();
    expect(await screen.findByText(/つながらなかったよ/)).toBeInTheDocument();
  });

  it("サーバーのエラーは、聞こえなかったとは言わない", async () => {
    mockCheck(() => new Response(JSON.stringify({ success: false }), { status: 500 }));
    render(<EnglishTalkStage scene={DOG_SCENE} />);
    await answerByChoice();
    expect(await screen.findByText(/うまく いかなかったよ/)).toBeInTheDocument();
    expect(screen.queryByText(/きこえなかった/)).not.toBeInTheDocument();
  });
});

describe("EnglishTalkStage: ログイン中のごほうび", () => {
  /** ログイン中のサーバー応答。reward があれば「サーバーが数えた」。 */
  const mockServerCheck = (reward?: Record<string, unknown>) =>
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const { answer, mode } = JSON.parse(String(init?.body ?? "{}"));
      const correct = judgeTalk(DOG_TURN, answer, mode).correct;
      return reply({ correct, ...(reward ? { reward } : {}) });
    });

  const answerCorrectly = async () => {
    await userEvent.click(startButton());
    await userEvent.click(await screen.findByRole("button", { name: "It's a dog." }));
    expect(await screen.findByText(/ばっちり つたわったよ/)).toBeInTheDocument();
  };

  it("サーバーが数えた分を表示へ反映する(1回目の申告つき)。端末では足さない", async () => {
    const fetchSpy = mockServerCheck({ currentCycleCount: 7, totalCorrectCount: 57, totalRewardYen: 25 });
    const { getRewardState } = await import("@/lib/rewards/rewardStore");
    const before = getRewardState().totalCorrectCount;

    render(<EnglishTalkStage scene={DOG_SCENE} childId={CHILD_ID} />);
    await answerCorrectly();

    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body).toMatchObject({ childId: CHILD_ID, firstTry: true, mode: "choice" });
    expect(getRewardState()).toMatchObject({ totalCorrectCount: 57, totalRewardYen: 25 });
    expect(before).not.toBe(57);
  });

  it("サーバーが数えなかったとき(今日はもう数えた・上限)は、端末にも足さない", async () => {
    mockServerCheck();
    const { getRewardState } = await import("@/lib/rewards/rewardStore");
    const before = getRewardState();

    render(<EnglishTalkStage scene={DOG_SCENE} childId={CHILD_ID} />);
    await answerCorrectly();

    expect(getRewardState()).toEqual(before);
  });
});

describe("EnglishTalkStage: 抜けの見直し", () => {
  it("最後のターンのボタンは「おわる ▶」、まだ次があるときは「つぎへ ▶」", async () => {
    mockCheck();
    const mic = installSpeechRecognition();
    render(<EnglishTalkStage scene={TWO_TURN_SCENE} />);
    await userEvent.click(startButton());
    await userEvent.click(micButton());
    await mic.say("It's a dog.");
    expect(await screen.findByRole("button", { name: "つぎへ ▶" })).toBeInTheDocument();
    await userEvent.click(await nextButton());

    await userEvent.click(micButton());
    await mic.say("It's red.");
    expect(await screen.findByRole("button", { name: "おわる ▶" })).toBeInTheDocument();
  });

  it("マイクで まねして言うのが2回続けて合わなかったら、「いえたよ！」でも進められる(行き止まりにならない)", async () => {
    mockCheck();
    const mic = installSpeechRecognition();
    render(<EnglishTalkStage scene={DOG_SCENE} />);
    await userEvent.click(startButton());
    await userEvent.click(micButton());
    await mic.say("It's a cat.");
    await screen.findByText("ただしい いいかた");

    await userEvent.click(micButton());
    await mic.say("dog");
    await screen.findByText(/Almost! Try saying/);
    expect(screen.queryByRole("button", { name: "いえたよ！" })).not.toBeInTheDocument();

    await userEvent.click(micButton());
    await mic.say("dog");
    const said = await screen.findByRole("button", { name: "いえたよ！" });
    await userEvent.click(said);
    await wait(400);
    await userEvent.click(screen.getByRole("button", { name: "いえたよ！" }));
    expect(await nextButton()).toBeInTheDocument();
  });

  it("ログイン中は、日本語だけの答えのあとも、マイクが自動で入りなおす", async () => {
    mockCheck();
    const mic = installSpeechRecognition();
    render(<EnglishTalkStage scene={DOG_SCENE} childId={CHILD_ID} />);
    await userEvent.click(startButton());
    await vi.waitFor(() => expect(mic.instances.length).toBeGreaterThan(0));
    const before = mic.instances.length;

    await mic.say("いぬ");
    expect(await screen.findByText(/にほんごだね/)).toBeInTheDocument();
    await vi.waitFor(() => expect(mic.instances.length).toBeGreaterThan(before));
  });

  it("4択を開いたら(答えが見えるので)ヘルプ。声で答えても ★ は3にならない", async () => {
    mockCheck();
    const { getEnglishTalkProgress } = await import("@/lib/englishTalk/progressStore");
    const mic = installSpeechRecognition();
    render(<EnglishTalkStage scene={DOG_SCENE} />);
    await userEvent.click(startButton());
    await userEvent.click(screen.getByRole("button", { name: /こたえの ヒント（えらんで こたえる）/ }));
    await userEvent.click(micButton());
    await mic.say("It's a dog.");
    await userEvent.click(await nextButton());
    await screen.findByText("おはなし できたね！");
    expect(getEnglishTalkProgress().park?.stars).toBe(2);
  });

  it("4択しか使えないとき(親の設定でオフ)は、4択で答えても ★3 が取れる", async () => {
    mockCheck();
    const { getEnglishTalkProgress } = await import("@/lib/englishTalk/progressStore");
    render(<EnglishTalkStage scene={DOG_SCENE} settings={{ enableVoiceAnswer: false }} />);
    await userEvent.click(startButton());
    await userEvent.click(screen.getByRole("button", { name: "It's a dog." }));
    await userEvent.click(await nextButton());
    await screen.findByText("おはなし できたね！");
    expect(getEnglishTalkProgress().park?.stars).toBe(3);
  });

  it("声のこたえがオフのときは、はじめの案内もマイクの話をしない", async () => {
    render(<EnglishTalkStage scene={DOG_SCENE} settings={{ enableVoiceAnswer: false }} />);
    expect(screen.queryByText(/こえで はなしかけよう/)).not.toBeInTheDocument();
    expect(screen.queryByText(/I don't know/)).not.toBeInTheDocument();
    expect(screen.getByText(/ボタンを えらんで/)).toBeInTheDocument();
  });

  it("聞き取れなかったときは、まちがいにせず もう一度言ってもらう", async () => {
    mockCheck(() => reply({ correct: false, unclear: true }));
    const mic = installSpeechRecognition();
    render(<EnglishTalkStage scene={DOG_SCENE} />);
    await userEvent.click(startButton());
    await userEvent.click(micButton());
    await mic.say("dog");
    expect(await screen.findByText(/ききとれなかった/)).toBeInTheDocument();
    expect(screen.queryByText("ただしい いいかた")).not.toBeInTheDocument();
  });
});
