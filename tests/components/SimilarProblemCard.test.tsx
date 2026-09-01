import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SimilarProblemCard } from "@/components/child/SimilarProblemCard";

describe("SimilarProblemCard", () => {
  it("reports a correct answer only after the child selects it", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<SimilarProblemCard problem={{ question: "1 + 1?", choices: ["1", "2"], answer: "2", explanation: "たそう" }} index={0} total={5} score={0} onComplete={onComplete} />);
    expect(screen.queryByText(/せいかい/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "2" }));
    expect(screen.getByText(/せいかい/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "つぎの もんだい" }));
    expect(onComplete).toHaveBeenCalledWith(true, "2");
  });
});
