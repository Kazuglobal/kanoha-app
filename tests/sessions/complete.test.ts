import { afterEach, describe, expect, it, vi } from "vitest";
import { completeLearningSession } from "@/lib/sessions/complete";

const input = {
  childId: "11111111-1111-4111-8111-111111111111",
  durationSeconds: 600,
  sessionId: "22222222-2222-4222-8222-222222222222",
  problemId: "33333333-3333-4333-8333-333333333333",
  score: 4,
};

afterEach(() => vi.restoreAllMocks());

describe("completeLearningSession", () => {
  it("saves the session, then the review schedule, then requests the Slack report in order", async () => {
    const order: string[] = [];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      order.push(String(url));
      await new Promise((resolve) => setTimeout(resolve, 5));
      return new Response(null, { status: 200 });
    });

    const result = await completeLearningSession(input);

    expect(order).toEqual([
      "/api/sessions/22222222-2222-4222-8222-222222222222",
      "/api/reviews/schedule",
      "/api/reports/slack",
    ]);
    expect(result).toEqual({ sessionSaved: true, reviewScheduled: true, reportSent: true });
    expect(fetchMock).toHaveBeenNthCalledWith(1, expect.any(String), expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ childId: input.childId, durationSeconds: 600 }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/reviews/schedule", expect.objectContaining({
      body: JSON.stringify({ childId: input.childId, problemId: input.problemId, similarCorrectCount: 4 }),
    }));
  });

  it("does not send counts the server derives itself", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    await completeLearningSession(input);
    const patchBody = String((fetchMock.mock.calls[0][1] as RequestInit).body);
    expect(patchBody).not.toContain("correctCount");
    expect(patchBody).not.toContain("totalQuestions");
  });

  it("still sends the report when an earlier step fails, and reports each outcome", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(new Response(null, { status: 422 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    await expect(completeLearningSession(input)).resolves.toEqual({
      sessionSaved: false,
      reviewScheduled: false,
      reportSent: true,
    });
  });
});
