import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEnglishTalk } from "@/components/child/englishTalk/useEnglishTalk";
import { TALK_SCENES } from "@/lib/curriculum/englishTalkScenes";
import { toPublicScene } from "@/lib/englishTalk/judge";
import { getEnglishTalkProgress } from "@/lib/englishTalk/progressStore";
import * as speech from "@/lib/audio/englishTalkSpeech";
import { soundManager } from "@/lib/audio/soundSystem";

vi.mock("@/lib/audio/englishTalkSpeech", () => ({
  speakTalkEnglish: vi.fn(async () => undefined),
  speakTalkJapanese: vi.fn(async () => undefined),
  stopTalkSpeech: vi.fn(),
  preloadTalkSceneSpeech: vi.fn(),
}));

vi.mock("@/lib/audio/soundSystem", () => ({
  soundManager: { playCorrect: vi.fn(), playWrong: vi.fn() },
}));

const parkScene = toPublicScene(TALK_SCENES.find(({ id }) => id === "park")!);
const SCENE = { ...parkScene, turns: parkScene.turns.slice(1, 3) };

const reply = (data: Record<string, unknown>) => new Response(JSON.stringify({ success: true, data }), { status: 200 });
const WRONG = { correct: false, feedbackEn: "Close!", modelAnswer: "It's a dog.", modelAnswerJa: "いぬだよ。" };

/** 呼ばれるまで答えを返さない fetch。release() で返す。 */
const gatedFetch = (data: Record<string, unknown>) => {
  const releases: Array<() => void> = [];
  const spy = vi.spyOn(globalThis, "fetch").mockImplementation(
    () =>
      new Promise<Response>((resolve) => {
        releases.push(() => resolve(reply(data)));
      }),
  );
  return { spy, releaseAll: () => releases.splice(0).forEach((release) => release()) };
};

type FetchCall = readonly [input: unknown, init?: RequestInit];

/** fetch に送った本文(JSON)を、呼ばれた順に取り出す。 */
const bodies = (spy: { mock: { calls: readonly FetchCall[] } }): Array<{ mode: string }> =>
  spy.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));

beforeEach(() => {
  localStorage.clear();
  vi.mocked(speech.speakTalkEnglish).mockClear();
  vi.mocked(soundManager.playCorrect).mockClear();
  vi.mocked(soundManager.playWrong).mockClear();
});

afterEach(() => vi.restoreAllMocks());

describe("useEnglishTalk: 続けて呼ばれたとき", () => {
  it("答え合わせの最中に もう一度 answer が呼ばれても、サーバーへは1回だけ送る", async () => {
    const { spy, releaseAll } = gatedFetch({ correct: true });
    const { result } = renderHook(() => useEnglishTalk(SCENE));
    act(() => result.current.begin());

    await act(async () => {
      const first = result.current.answer("It's a dog.", "choice");
      const second = result.current.answer("It's a dog.", "choice");
      releaseAll();
      await Promise.all([first, second]);
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.current.state.phase).toBe("correct");
  });

  it("まねして言うの最中に もう一度 repeat が呼ばれても、1回だけ数える", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(reply(WRONG));
    const { result } = renderHook(() => useEnglishTalk(SCENE));
    act(() => result.current.begin());
    await act(async () => {
      await result.current.answer("It's a cat.", "choice");
    });
    expect(result.current.state.phase).toBe("teach");

    const gate = gatedFetch({ correct: true });
    await act(async () => {
      const first = result.current.repeat("It's a dog.");
      const second = result.current.repeat("It's a dog.");
      gate.releaseAll();
      await Promise.all([first, second]);
    });

    expect(result.current.state.repeatCount).toBe(1);
    expect(bodies(gate.spy).filter(({ mode }) => mode === "repeat")).toHaveLength(1);
  });

  it("つぎへを続けて呼んでも、1回だけ進み、次の問いも1回だけ読む", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(reply({ correct: true }));
    const { result } = renderHook(() => useEnglishTalk(SCENE));
    act(() => result.current.begin());
    await act(async () => {
      await result.current.answer("It's a dog.", "choice");
    });

    act(() => {
      result.current.next();
      result.current.next();
    });

    expect(result.current.turn?.id).toBe("park-ball-color");
    const spoken = vi.mocked(speech.speakTalkEnglish).mock.calls.filter(([text]) => text === "What color is the ball?");
    expect(spoken).toHaveLength(1);
  });
});

describe("useEnglishTalk: 待っているあいだに やり直したとき", () => {
  it("もういちど やり直したあとに届いた古い答え合わせは使わない", async () => {
    const { releaseAll } = gatedFetch({ correct: true });
    const { result } = renderHook(() => useEnglishTalk(SCENE));
    act(() => result.current.begin());

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.answer("It's a dog.", "choice");
    });
    act(() => result.current.restart());
    await act(async () => {
      releaseAll();
      await pending;
    });

    // 新しく始めた場面は、まだ最初の問いのまま(古い正解で「できた」にならない)
    expect(result.current.state.phase).toBe("ask");
    expect(result.current.started).toBe(false);
    expect(result.current.message).toBeNull();
  });

  it("やり直したあとは、新しい場面で すぐ答えられる(古い答え合わせの待ちを引きずらない)", async () => {
    const stale = gatedFetch({ correct: true });
    const { result } = renderHook(() => useEnglishTalk(SCENE));
    act(() => result.current.begin());
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.answer("It's a dog.", "choice");
    });
    act(() => result.current.restart());
    act(() => result.current.begin());

    vi.restoreAllMocks();
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(reply({ correct: true }));
    await act(async () => {
      await result.current.answer("It's a dog.", "choice");
    });
    stale.releaseAll();
    await act(async () => {
      await pending;
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.current.state.phase).toBe("correct");
  });
});

describe("useEnglishTalk: ヘルプの記録", () => {
  it("日本語のヘルプを使ったターンは、4択と同じく ヘルプとして ★ に反映される", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(reply({ correct: true }));
    const { result } = renderHook(() => useEnglishTalk(SCENE));
    act(() => result.current.begin());
    act(() => result.current.askInJapanese());
    expect(result.current.state.helped).toEqual(["park-dog"]);
    expect(result.current.showJapanese).toBe(true);
    expect(result.current.state.phase).toBe("ask");
  });

  it("4択を開いたら(答えが見えるので)ヘルプ。4択で答えてもヘルプ", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(reply({ correct: true }));
    const opened = renderHook(() => useEnglishTalk(SCENE));
    act(() => opened.result.current.begin());
    act(() => opened.result.current.noteHelp());
    expect(opened.result.current.state.helped).toEqual(["park-dog"]);

    const answered = renderHook(() => useEnglishTalk(SCENE));
    act(() => answered.result.current.begin());
    await act(async () => {
      await answered.result.current.answer("It's a dog.", "choice");
    });
    expect(answered.result.current.state.helped).toEqual(["park-dog"]);
  });

  it("4択しか使えないとき(親の設定でオフ・マイクが使えない)は、4択で答えてもヘルプにしない(★3が取れる)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(reply({ correct: true }));
    const off = renderHook(() => useEnglishTalk(SCENE, undefined, { enableVoiceAnswer: false }));
    act(() => off.result.current.begin());
    act(() => off.result.current.noteHelp());
    await act(async () => {
      await off.result.current.answer("It's a dog.", "choice");
    });
    expect(off.result.current.state.helped).toEqual([]);

    const failed = renderHook(() => useEnglishTalk(SCENE));
    act(() => failed.result.current.begin());
    act(() => failed.result.current.markVoiceUnavailable());
    await act(async () => {
      await failed.result.current.answer("It's a dog.", "choice");
    });
    expect(failed.result.current.state.helped).toEqual([]);
  });
});

describe("useEnglishTalk: 画面を離れたとき・終わったとき", () => {
  it("画面を離れたあとに届いた答え合わせでは、音も読み上げも出さない", async () => {
    const gate = gatedFetch({ correct: true });
    const { result, unmount } = renderHook(() => useEnglishTalk(SCENE));
    act(() => result.current.begin());
    vi.mocked(speech.speakTalkEnglish).mockClear();

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.answer("It's a dog.", "choice");
    });
    unmount();
    await act(async () => {
      gate.releaseAll();
      await pending;
    });

    expect(soundManager.playCorrect).not.toHaveBeenCalled();
    expect(speech.speakTalkEnglish).not.toHaveBeenCalled();
  });

  it("最後のターンは、つぎへ を押さなくても、★ を記録する(途中で離れても きろくが残る)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(reply({ correct: true }));
    const single = { ...SCENE, turns: SCENE.turns.slice(0, 1) };
    const { result } = renderHook(() => useEnglishTalk(single));
    act(() => result.current.begin());
    expect(getEnglishTalkProgress().park).toBeUndefined();

    await act(async () => {
      await result.current.answer("It's a dog.", "voice");
    });

    expect(result.current.isLastStep).toBe(true);
    expect(getEnglishTalkProgress().park?.stars).toBe(3);
  });

  it("まだ次のターンがあるあいだは、記録しない", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(reply({ correct: true }));
    const { result } = renderHook(() => useEnglishTalk(SCENE));
    act(() => result.current.begin());
    await act(async () => {
      await result.current.answer("It's a dog.", "voice");
    });
    expect(result.current.isLastStep).toBe(false);
    expect(getEnglishTalkProgress().park).toBeUndefined();
  });
});

describe("useEnglishTalk: サーバーへのクリア記録(ログイン中の子)", () => {
  const CHILD = "11111111-1111-4111-8111-111111111111";
  const single = { ...SCENE, turns: SCENE.turns.slice(0, 1) };

  /** 答え合わせは正解、クリアの記録は 3★ で返す fetch。 */
  const talkFetch = (completeBehavior: () => Promise<Response> = async () => reply({ stars: 3, bestStars: 3, clearCount: 1 })) =>
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => (String(url) === "/api/english-talk/complete" ? completeBehavior() : reply({ correct: true })));
  const completes = (spy: ReturnType<typeof talkFetch>) => spy.mock.calls.filter(([url]) => String(url) === "/api/english-talk/complete");

  it("最後のターンに答えたとき、ターンごとの結果を 1 回だけ送る(つぎへ を押して終わっても 2 回目は送らない)", async () => {
    const spy = talkFetch();
    const { result } = renderHook(() => useEnglishTalk(single, CHILD));
    act(() => result.current.begin());
    await act(async () => {
      await result.current.answer("It's a dog.", "voice");
    });
    await act(async () => {
      result.current.next();
    });
    expect(result.current.state.phase).toBe("done");
    const sent = completes(spy);
    expect(sent).toHaveLength(1);
    expect(JSON.parse(String(sent[0][1]?.body))).toEqual({
      childId: CHILD,
      sceneId: "park",
      runId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
      outcomes: [{ turnId: single.turns[0].id, outcome: "clean" }],
    });
  });

  it("ヘルプを使ったターンは help として送る(★の計算はサーバーがやりなおす)", async () => {
    const spy = talkFetch();
    const { result } = renderHook(() => useEnglishTalk(single, CHILD));
    act(() => result.current.begin());
    act(() => result.current.noteHelp());
    await act(async () => {
      await result.current.answer("It's a dog.", "choice");
    });
    expect(JSON.parse(String(completes(spy)[0][1]?.body)).outcomes).toEqual([{ turnId: single.turns[0].id, outcome: "help" }]);
  });

  it("デモ(子どもがいない)・まだ次のターンがあるあいだは、送らない", async () => {
    const spy = talkFetch();
    const demo = renderHook(() => useEnglishTalk(single));
    act(() => demo.result.current.begin());
    await act(async () => {
      await demo.result.current.answer("It's a dog.", "voice");
    });
    const middle = renderHook(() => useEnglishTalk(SCENE, CHILD));
    act(() => middle.result.current.begin());
    await act(async () => {
      await middle.result.current.answer("It's a dog.", "voice");
    });
    expect(completes(spy)).toHaveLength(0);
  });

  it("やり直して もう一度おわったら、もう一度だけ送る", async () => {
    const spy = talkFetch();
    const { result } = renderHook(() => useEnglishTalk(single, CHILD));
    for (let run = 0; run < 2; run += 1) {
      act(() => result.current.begin());
      await act(async () => {
        await result.current.answer("It's a dog.", "voice");
      });
      act(() => result.current.restart());
    }
    expect(completes(spy)).toHaveLength(2);
    // 挑戦ごとに別の ID(同じ挑戦の再送だけが 同じ ID)
    const [first, second] = completes(spy).map(([, init]) => JSON.parse(String(init?.body)).runId);
    expect(first).not.toBe(second);
  });

  it("送れなかったときも画面は止まらない。フックは送りなおさない(通信の関数が、同じ挑戦の ID で 1 回だけ送りなおす)", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    try {
      const spy = talkFetch(async () => {
        throw new TypeError("offline");
      });
      const { result } = renderHook(() => useEnglishTalk(single, CHILD));
      act(() => result.current.begin());
      await act(async () => {
        await result.current.answer("It's a dog.", "voice");
      });
      expect(result.current.isLastStep).toBe(true);
      await act(async () => {
        result.current.next();
      });
      expect(result.current.state.phase).toBe("done");
      // 送りなおしは時間がたってから(通信の関数の中)。フックが つぎへ のたびに送ることはない
      expect(completes(spy)).toHaveLength(1);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000);
      });
      expect(completes(spy)).toHaveLength(2);
      const [first, retry] = completes(spy).map(([, init]) => JSON.parse(String(init?.body)));
      expect(retry).toEqual(first);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("useEnglishTalk: まねして言うで進めないとき", () => {
  const toTeach = async (result: { current: ReturnType<typeof useEnglishTalk> }) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(reply(WRONG));
    act(() => result.current.begin());
    await act(async () => {
      await result.current.answer("It's a cat.", "choice");
    });
  };

  it("まねして言うが2回 合わなかったら数えておく(画面は「いえたよ！」で進めるようにする)。その後 合っても、終わるまで消えない", async () => {
    const { result } = renderHook(() => useEnglishTalk(SCENE));
    await toTeach(result);
    // Response の本文は1回しか読めないので、呼ばれるたびに新しく作る
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => reply({ correct: false }));
    expect(result.current.repeatMisses).toBe(0);

    await act(async () => {
      await result.current.repeat("dog");
    });
    await act(async () => {
      await result.current.repeat("dog");
    });
    expect(result.current.repeatMisses).toBe(2);

    vi.spyOn(globalThis, "fetch").mockImplementation(async () => reply({ correct: true }));
    await act(async () => {
      await result.current.repeat("It's a dog.");
    });
    expect(result.current.state.repeatCount).toBe(1);
    expect(result.current.repeatMisses).toBe(2);

    // 次のターンの まねして言うでは、また0から数える
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => reply({ correct: true }));
    await act(async () => {
      await result.current.repeat("It's a dog.");
    });
    act(() => result.current.next());
    expect(result.current.repeatMisses).toBe(0);
  });

  it("「いえたよ！」を続けて2回押しても、1回ぶんだけ数える", async () => {
    const { result } = renderHook(() => useEnglishTalk(SCENE));
    await toTeach(result);

    await act(async () => {
      await result.current.repeat(null);
      await result.current.repeat(null);
    });
    expect(result.current.state.repeatCount).toBe(1);
  });
});

describe("useEnglishTalk: 聞き取れなかった・日本語だけ・通信の失敗のあと", () => {
  it.each([
    ["聞き取れなかった", { correct: false, unclear: true }, /ききとれなかった/],
    ["日本語だけ", { correct: false, needsEnglish: true }, /にほんごだね/],
  ])("%s ときは、まちがいにせず、もう一度言えるようにマイクを入れなおす", async (_name, data, message) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(reply(data));
    const { result } = renderHook(() => useEnglishTalk(SCENE, "cccccccc-3333-4333-8333-cccccccccccc"));
    act(() => result.current.begin());
    const before = result.current.micKey;

    await act(async () => {
      await result.current.answer("いぬ", "voice");
    });

    expect(result.current.message).toMatch(message);
    expect(result.current.state.phase).toBe("ask");
    expect(result.current.state.missed).toEqual([]);
    expect(result.current.micKey).toBe(before + 1);
  });

  it("通信が失敗したときも、マイクを入れなおす", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useEnglishTalk(SCENE, "cccccccc-3333-4333-8333-cccccccccccc"));
    act(() => result.current.begin());
    const before = result.current.micKey;
    await act(async () => {
      await result.current.answer("It's a dog.", "voice");
    });
    expect(result.current.micKey).toBe(before + 1);
  });
});
