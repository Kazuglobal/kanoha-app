import { describe, expect, it, vi } from "vitest";
import { completeLearningSession } from "@/lib/sessions/complete";

describe("completeLearningSession", () => {
  it("requests a Slack report after saving the completed session", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 422 }));

    await completeLearningSession({
      answerCorrect: true,
      childId: "11111111-1111-4111-8111-111111111111",
      durationSeconds: 600,
      sessionId: "22222222-2222-4222-8222-222222222222",
      problemId: "33333333-3333-4333-8333-333333333333",
      score: 4,
      similarProblemCount: 5,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/reports/slack",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ childId: "11111111-1111-4111-8111-111111111111" }),
      }),
    );
  });
});
