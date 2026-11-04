import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SimilarProblemCard } from "@/components/child/SimilarProblemCard";

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

describe("SimilarProblemCard: 英語の声は 教科が決める(isEnglish)", () => {
  const measure = { question: "3cm2mm は なんmm ですか？", choices: ["32mm", "23mm", "302mm", "5mm"] };

  it("算数など英語でない教科: 単位の英字(mm)を 英語の声で読まず、スピーカーも出さない", async () => {
    const user = userEvent.setup();
    render(<SimilarProblemCard problem={measure} index={0} total={5} score={0} isEnglish={false} onAnswer={async () => ({ correct: true })} onComplete={vi.fn()} />);
    for (const choice of measure.choices) expect(screen.getByRole("button", { name: choice }).querySelector("svg")).toBeNull();
    await user.click(screen.getByRole("button", { name: "32mm" }));
    expect(speakCoachVoice).not.toHaveBeenCalled();
  });

  it("英語の教科: 英語の選択肢は声で読み、スピーカーを出す", async () => {
    const user = userEvent.setup();
    render(<SimilarProblemCard problem={{ question: "どれが「いぬ」?", choices: ["dog", "cat", "bird", "fish"] }} index={0} total={5} score={0} isEnglish onAnswer={async () => ({ correct: true })} onComplete={vi.fn()} />);
    expect(screen.getByRole("button", { name: "dog" }).querySelector("svg")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "dog" }));
    expect(speakCoachVoice).toHaveBeenCalledWith("dog", expect.anything());
  });

  it("教科が分からないとき(isEnglish なし)は、これまでどおり 英字があれば英語あつかい", async () => {
    render(<SimilarProblemCard problem={{ question: "q", choices: ["dog", "cat"] }} index={0} total={5} score={0} onComplete={vi.fn()} />);
    expect(screen.getByRole("button", { name: "dog" }).querySelector("svg")).not.toBeNull();
  });
});

describe("SimilarProblemCard", () => {
  it("reports a correct answer only after the child selects it", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onAnswer = vi.fn(async () => ({ correct: true, explanation: null }));
    render(<SimilarProblemCard problem={{ question: "1 + 1?", choices: ["1", "2"] }} index={0} total={5} score={0} onAnswer={onAnswer} onComplete={onComplete} />);
    expect(screen.queryByText(/せいかい/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "2" }));
    expect(await screen.findByText(/せいかい/)).toBeInTheDocument();
    expect(onAnswer).toHaveBeenCalledWith("2");
    await user.click(screen.getByRole("button", { name: "つぎの もんだい" }));
    expect(onComplete).toHaveBeenCalledWith(true, "2");
  });

  it("checks demo answers on the server and never holds the answer itself", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, data: { correct: false, explanation: "たしざんだよ" } }), { status: 200 }),
    );
    const user = userEvent.setup();
    render(<SimilarProblemCard problem={{ question: "1 + 1?", choices: ["1", "2"], checkId: "demo:addition-1:0" }} index={0} total={5} score={0} onComplete={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "1" }));
    expect(await screen.findByText(/たしざんだよ/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/demo/check",
      expect.objectContaining({ body: JSON.stringify({ checkId: "demo:addition-1:0", answer: "1" }) }),
    );
  });
});
