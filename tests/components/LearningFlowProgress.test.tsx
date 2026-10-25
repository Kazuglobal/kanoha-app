import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LearningFlow } from "@/components/child/LearningFlow";
import { writeProgress } from "@/lib/sessions/progress";

const persisted = {
  childId: "11111111-1111-4111-8111-111111111111",
  problemId: "22222222-2222-4222-8222-222222222222",
  question: "1L は なんmL？",
  unit: "水のかさ",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ success: true, data }), { status });

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LearningFlow progress persistence (W6)", () => {
  it("restores a stored open session and practice position instead of starting a new one", async () => {
    writeProgress({
      sessionId: "33333333-3333-4333-8333-333333333333",
      problemId: persisted.problemId,
      practiceIndex: 2,
      score: 2,
      revealedCount: 0,
      similar: Array.from({ length: 5 }, (_, index) => ({
        id: `sp-${index}`,
        question: `もんだい ${index + 1}`,
        choices: ["1", "2", "3", "4"],
      })),
    });
    const fetchMock = vi.spyOn(globalThis, "fetch");

    render(<LearningFlow persisted={persisted} />);

    expect(await screen.findByText("れんしゅう 3 / 5")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("offers もういちど ためす when the session cannot start, and retries", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(json({ id: "33333333-3333-4333-8333-333333333333", limitReached: false }, 201));
    const user = userEvent.setup();

    render(<LearningFlow persisted={persisted} />);

    expect(await screen.findByText("がくしゅうの きろくを はじめられなかったよ。")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "もういちど ためす" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByText("がくしゅうの きろくを はじめられなかったよ。")).not.toBeInTheDocument(),
    );
  });

  it("records elapsed time with a keepalive PATCH when the page hides", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValue(json({ id: "33333333-3333-4333-8333-333333333333", limitReached: false }, 201));

    render(<LearningFlow persisted={persisted} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await waitFor(() => {
      window.dispatchEvent(new Event("pagehide"));
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/sessions/33333333-3333-4333-8333-333333333333",
        expect.objectContaining({ method: "PATCH", keepalive: true }),
      );
    });
  });
});

describe("LearningFlow rewards on similar problems", () => {
  const similar = Array.from({ length: 5 }, (_, index) => ({
    id: `sp-${index}`,
    question: `もんだい ${index + 1}`,
    choices: ["1", "2", "3", "4"],
  }));

  const restoreAt = (practiceIndex: number) =>
    writeProgress({
      sessionId: "33333333-3333-4333-8333-333333333333",
      problemId: persisted.problemId,
      practiceIndex,
      score: 0,
      revealedCount: 0,
      similar,
    });

  it("does not add a device-only reward for a signed-in child (the server counts original problems only)", async () => {
    restoreAt(0);
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      String(input).includes("/api/attempts")
        ? json({ is_correct: true, reward: null }, 201)
        : json({ limitReached: false }),
    );
    const { getRewardState } = await import("@/lib/rewards/rewardStore");
    const before = getRewardState();

    render(<LearningFlow persisted={persisted} />);
    await userEvent.click(await screen.findByRole("button", { name: "1" }));
    await userEvent.click(await screen.findByRole("button", { name: /つぎの もんだい/ }));

    await screen.findByText("れんしゅう 2 / 5");
    expect(getRewardState()).toEqual(before);
  });

  it("still makes the character react to a correct similar answer for a signed-in child", async () => {
    restoreAt(0);
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      String(input).includes("/api/attempts")
        ? json({ is_correct: true, reward: null }, 201)
        : json({ limitReached: false }),
    );
    const solved = vi.fn();
    window.addEventListener("kanoha-problem-solved", solved);
    try {
      render(<LearningFlow persisted={persisted} />);
      await userEvent.click(await screen.findByRole("button", { name: "1" }));
      await userEvent.click(await screen.findByRole("button", { name: /つぎの もんだい/ }));
      await screen.findByText("れんしゅう 2 / 5");
      expect(solved).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener("kanoha-problem-solved", solved);
    }
  });
});
