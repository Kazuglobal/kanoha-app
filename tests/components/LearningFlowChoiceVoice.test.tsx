import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LearningFlow } from "@/components/child/LearningFlow";

vi.mock("@/lib/audio/coachSpeech", () => ({
  playPraiseVoice: vi.fn(async () => ""),
  playEncourageVoice: vi.fn(async () => ""),
  preloadCoachVoices: vi.fn(),
  speakCoachVoice: vi.fn(async () => undefined),
  stopCoachVoice: vi.fn(),
}));

/** 声の入力は 本物の Web Speech を使わず、「ことばを言う」ボタンで 決まった文を渡す。認識の言語は data-lang に出す。 */
vi.mock("@/components/child/VoiceAnswer", () => ({
  VoiceAnswer: ({ onAnswer, lang }: { onAnswer: (text: string) => void; lang?: string }) => (
    <div data-testid="voice" data-lang={lang}>
      <button type="button" onClick={() => onAnswer((globalThis as { __spoken?: string }).__spoken ?? "")}>
        ことばを いう
      </button>
    </div>
  ),
}));

const CHILD = "11111111-1111-4111-8111-111111111111";
const PROBLEM = "22222222-2222-4222-8222-222222222222";
const SESSION = "33333333-3333-4333-8333-333333333333";

const english = (choices: readonly string[]) => ({ childId: CHILD, problemId: PROBLEM, question: "どれが「いぬ」?", unit: "どうぶつ", subject: "english", choices });
const math = { childId: CHILD, problemId: PROBLEM, question: "3cm2mm は なんmm ですか？", unit: "長さ", subject: "math", choices: ["32mm", "23mm", "302mm", "5mm"] } as const;

const json = (data: unknown, status = 200) => new Response(JSON.stringify({ success: true, data }), { status });

let attempts: Record<string, unknown>[] = [];
let judgedCorrect = false;

beforeEach(() => {
  sessionStorage.clear();
  attempts = [];
  judgedCorrect = false;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    if (String(url) === "/api/sessions") return json({ id: SESSION, limitReached: false }, 201);
    if (String(url) === "/api/attempts") {
      attempts.push(JSON.parse(String(init?.body ?? "{}")));
      return json({ id: "a1", is_correct: judgedCorrect, hint_level_used: 0, review: { action: "none" }, reward: null }, 201);
    }
    return json(null);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as { __spoken?: string }).__spoken;
});

const ready = async () => {
  // 学習の記録の準備(/api/sessions)が終わるまで 答えは送れない
  await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith("/api/sessions", expect.anything()));
};

describe("LearningFlow: 選択肢の答え方(タップ・声)は 答えの種類をそのまま記録する", () => {
  it("選択肢をタップしたら answerType は tap(手書きとして記録しない)", async () => {
    const user = userEvent.setup();
    render(<LearningFlow persisted={english(["dog", "cat", "bird", "fish"])} />);
    await ready();
    await user.click(screen.getByRole("button", { name: "dog" }));
    await waitFor(() => expect(attempts).toHaveLength(1));
    expect(attempts[0]).toMatchObject({ childId: CHILD, problemId: PROBLEM, sessionId: SESSION, childAnswer: "dog", answerType: "tap" });
  });

  it("声が 選択肢に合ったときは、その選択肢を voice として記録する", async () => {
    (globalThis as { __spoken?: string }).__spoken = "dog";
    const user = userEvent.setup();
    render(<LearningFlow persisted={english(["dog", "cat", "bird", "fish"])} />);
    await ready();
    await user.click(screen.getByRole("button", { name: "ことばを いう" }));
    await waitFor(() => expect(attempts).toHaveLength(1));
    expect(attempts[0]).toMatchObject({ childAnswer: "dog", answerType: "voice" });
  });

  it("声が どの選択肢にも合わないときは、まちがいとして送らない。やさしく もういちど 言ってもらう", async () => {
    (globalThis as { __spoken?: string }).__spoken = "ぶた";
    const user = userEvent.setup();
    render(<LearningFlow persisted={english(["いぬ", "ねこ", "とり", "さかな"])} />);
    await ready();
    await user.click(screen.getByRole("button", { name: "ことばを いう" }));
    expect(await screen.findByText("もういちど いってみてね。")).toBeInTheDocument();
    expect(attempts).toEqual([]);
  });

  it("選択肢が日本語の英語問題は 日本語で聞き取る。英字の選択肢のときだけ 英語で聞き取る", async () => {
    const { unmount } = render(<LearningFlow persisted={english(["いぬ", "ねこ", "とり", "さかな"])} />);
    expect(screen.getByTestId("voice")).toHaveAttribute("data-lang", "ja-JP");
    unmount();
    render(<LearningFlow persisted={english(["dog", "cat", "bird", "fish"])} />);
    expect(screen.getByTestId("voice")).toHaveAttribute("data-lang", "en-US");
  });

  it("セットの最後の問題を正解したら、ホームへの道は 子どもと教科を引きつぐ(英語のセットから 算数のホームへ飛ばさない)", async () => {
    judgedCorrect = true;
    const user = userEvent.setup();
    render(<LearningFlow persisted={{ ...english(["dog", "cat", "bird", "fish"]), nextProblemId: null, setProgress: { batchId: "batch-9", position: 5, total: 5 } }} />);
    await ready();
    await user.click(screen.getByRole("button", { name: "dog" }));
    expect(await screen.findByText("🎉 あたらしい もんだい ぜんぶ できたね！")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ホームへ もどる/ })).toHaveAttribute("href", `/child/home?childId=${CHILD}&subject=english`);
  });

  it("算数の選択肢(32mm など)は、英字があっても 日本語で聞き取る", () => {
    render(<LearningFlow persisted={math} />);
    expect(screen.getByTestId("voice")).toHaveAttribute("data-lang", "ja-JP");
  });
});
