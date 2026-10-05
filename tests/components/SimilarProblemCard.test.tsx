import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SimilarProblemCard } from "@/components/child/SimilarProblemCard";

afterEach(() => {
  vi.restoreAllMocks();
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
