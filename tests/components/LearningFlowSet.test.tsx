import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LearningFlow } from "@/components/child/LearningFlow";

const speakCoachVoice = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@/lib/audio/coachSpeech", () => ({
  playPraiseVoice: vi.fn(async () => ""),
  playEncourageVoice: vi.fn(async () => ""),
  preloadCoachVoices: vi.fn(),
  speakCoachVoice,
  stopCoachVoice: vi.fn(),
}));

afterEach(() => {
  vi.restoreAllMocks();
  speakCoachVoice.mockClear();
});

const inSet = (position: number, total = 5, nextProblemId: string | null = "next-problem") =>
  ({
    childId: "demo",
    problemId: `problem-${position}`,
    question: "23 + 45 = ?",
    unit: "たし算",
    subject: "math",
    choices: ["68", "58", "78", "67"],
    nextProblemId,
    setProgress: { batchId: "batch-7", position, total },
  }) as const;

/** 「68」だけが正解のデモ判定を返す(デモの答え合わせは /api/demo/check がサーバーで行う)。 */
const mockCheck = () =>
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    const { answer } = JSON.parse(String(init?.body ?? "{}"));
    return new Response(JSON.stringify({ success: true, data: { correct: answer === "68", explanation: null } }), { status: 200 });
  });

describe("LearningFlow: 「あたらしい もんだい」のセットの中の問題", () => {
  it("バッジは「あたらしい もんだい」(セットでないときは「きょうの おすすめ 1」)", () => {
    const { rerender } = render(<LearningFlow persisted={inSet(2)} />);
    expect(screen.getByText("あたらしい もんだい")).toBeInTheDocument();
    rerender(<LearningFlow persisted={{ ...inSet(2), setProgress: undefined }} />);
    expect(screen.getByText("きょうの おすすめ 1")).toBeInTheDocument();
  });

  it("途中の問題を正解したら、つぎの問題へ(セットの手がかりを引きつぐ)", async () => {
    mockCheck();
    const user = userEvent.setup();
    render(<LearningFlow persisted={inSet(2)} />);
    await user.click(screen.getByRole("button", { name: "68" }));
    const next = await screen.findByRole("link", { name: /つぎの もんだいへ/ });
    expect(next).toHaveAttribute("href", "/child/problem/next-problem?childId=demo&batch=batch-7");
    expect(screen.queryByText(/ぜんぶ できたね/)).toBeNull();
  });

  it("セットの最後の問題を正解したら、「ぜんぶ できたね」とホームへの道を出す(つぎの問題は出さない)", async () => {
    mockCheck();
    const user = userEvent.setup();
    render(<LearningFlow persisted={inSet(5, 5, null)} />);
    await user.click(screen.getByRole("button", { name: "68" }));
    expect(await screen.findByText("🎉 あたらしい もんだい ぜんぶ できたね！")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ホームへ もどる/ })).toHaveAttribute("href", "/child/home");
    expect(screen.queryByRole("link", { name: /つぎの もんだいへ/ })).toBeNull();
  });

  it("まちがえたときは、セットの最後でも「ぜんぶ できたね」を出さない", async () => {
    mockCheck();
    const user = userEvent.setup();
    render(<LearningFlow persisted={inSet(5, 5, null)} />);
    await user.click(screen.getByRole("button", { name: "58" }));
    expect((await screen.findByRole("status")).textContent).toMatch(/おしい/);
    expect(screen.queryByText(/ぜんぶ できたね/)).toBeNull();
  });
});

describe("LearningFlow: 選択肢の英語の読み上げは 教科で決める", () => {
  const measure = { childId: "demo", problemId: "m1", question: "3cm2mm は なんmm ですか？", unit: "長さ", subject: "math", choices: ["32mm", "23mm", "302mm", "5mm"] } as const;

  it("算数の選択肢に cm・mm の英字があっても、英語の声で読まず スピーカーも出さない", async () => {
    mockCheck();
    const user = userEvent.setup();
    render(<LearningFlow persisted={measure} />);
    for (const name of measure.choices) {
      const choice = screen.getByRole("button", { name });
      expect(choice).not.toHaveAttribute("lang");
      expect(choice.querySelector("svg")).toBeNull();
    }
    await user.click(screen.getByRole("button", { name: "32mm" }));
    expect(speakCoachVoice).not.toHaveBeenCalled();
  });

  it("英語の選択肢は これまでどおり 英語の声で読む", async () => {
    mockCheck();
    const user = userEvent.setup();
    render(<LearningFlow persisted={{ childId: "demo", problemId: "e1", question: "どれが「いぬ」?", unit: "どうぶつ", subject: "english", choices: ["dog", "cat", "bird", "fish"] }} />);
    await user.click(screen.getByRole("button", { name: "dog" }));
    expect(speakCoachVoice).toHaveBeenCalledWith("dog", expect.anything());
  });
});
