import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LearningFlow } from "@/components/child/LearningFlow";

describe("LearningFlow simpler hints", () => {
  it("replaces staged hints with the very easy response", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: { id: "33333333-3333-4333-8333-333333333333", limitReached: false },
      }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: {
          hint1: "もっと みじかい ヒント",
          hint2: "ふたつめ",
          solution: "ときかた",
          answer: "1000mL",
        },
      }), { status: 200 }));
    const user = userEvent.setup();
    render(<LearningFlow persisted={{
      childId: "11111111-1111-4111-8111-111111111111",
      problemId: "22222222-2222-4222-8222-222222222222",
      question: "1L は なんmL？",
      correctAnswer: "1000mL",
      unit: "かさ",
      hints: ["もとのヒント", "2", "3", "1000mL"],
    }} />);

    await screen.findByRole("button", { name: "もっと かんたんに" });
    await user.click(screen.getByRole("button", { name: "ヒントを みる" }));
    await user.click(screen.getByRole("button", { name: "もっと かんたんに" }));

    expect(await screen.findByText("もっと みじかい ヒント")).toBeInTheDocument();
    expect(screen.queryByText("1000mL", { exact: true })).not.toBeInTheDocument();
  });
});
