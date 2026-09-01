import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LearningFlow } from "@/components/child/LearningFlow";

describe("LearningFlow daily limit", () => {
  it("shows a gentle stop screen when today's limit is already reached", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({
      success: true,
      data: { limitReached: true, limitMinutes: 15, usedMinutes: 16 },
    }), { status: 200 }));

    render(<LearningFlow persisted={{
      childId: "11111111-1111-4111-8111-111111111111",
      problemId: "22222222-2222-4222-8222-222222222222",
      question: "1L は なんmL？",
      correctAnswer: "1000mL",
      unit: "かさ",
      hints: ["1", "2", "3", "1000mL"],
    }} />);

    expect(await screen.findByRole("heading", { name: "きょうは ここまで！" })).toBeInTheDocument();
    expect(screen.queryByLabelText("こたえ")).not.toBeInTheDocument();
  });
});
