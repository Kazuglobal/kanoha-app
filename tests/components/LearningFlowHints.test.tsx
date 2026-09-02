import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LearningFlow } from "@/components/child/LearningFlow";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ success: true, data }), { status });

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LearningFlow simpler hints", () => {
  it("fetches hints one level at a time and replaces only the revealed levels", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ id: "33333333-3333-4333-8333-333333333333", limitReached: false }, 201))
      .mockResolvedValueOnce(json({ level: 1, text: "もとのヒント" }))
      .mockResolvedValueOnce(json({ hint1: "もっと みじかい ヒント" }));
    const user = userEvent.setup();
    render(<LearningFlow persisted={{
      childId: "11111111-1111-4111-8111-111111111111",
      problemId: "22222222-2222-4222-8222-222222222222",
      question: "1L は なんmL？",
      unit: "水のかさ",
    }} />);

    await screen.findByRole("button", { name: "もっと かんたんに" });
    await user.click(screen.getByRole("button", { name: "ヒントを みる" }));
    expect(await screen.findByText("もとのヒント")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/problems/22222222-2222-4222-8222-222222222222/hint",
      expect.objectContaining({ method: "POST", body: expect.stringContaining('"level":1') }),
    );

    await user.click(screen.getByRole("button", { name: "もっと かんたんに" }));

    expect(await screen.findByText("もっと みじかい ヒント")).toBeInTheDocument();
    expect(screen.queryByText("もとのヒント")).not.toBeInTheDocument();
    expect(screen.queryByText("1000mL", { exact: true })).not.toBeInTheDocument();
  });

  it("never renders an answer before any hint is requested", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ id: "33333333-3333-4333-8333-333333333333", limitReached: false }, 201));
    const { container } = render(<LearningFlow persisted={{
      childId: "11111111-1111-4111-8111-111111111111",
      problemId: "22222222-2222-4222-8222-222222222222",
      question: "1L は なんmL？",
      unit: "水のかさ",
    }} />);

    await screen.findByRole("button", { name: "ヒントを みる" });
    expect(container.innerHTML).not.toContain("1000mL");
  });
});
