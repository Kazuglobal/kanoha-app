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

describe("LearningFlow visual hint", () => {
  it("shows えで おしえて only after two hints, then displays the visual template", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ id: "33333333-3333-4333-8333-333333333333", limitReached: false }, 201))
      .mockResolvedValueOnce(json({ level: 1, text: "ヒント いちだんめ" }))
      .mockResolvedValueOnce(json({ level: 2, text: "ヒント にだんめ" }))
      .mockResolvedValueOnce(json({ kind: "template", url: "/visuals/volume.svg" }));
    const user = userEvent.setup();
    render(<LearningFlow persisted={{
      childId: "11111111-1111-4111-8111-111111111111",
      problemId: "22222222-2222-4222-8222-222222222222",
      question: "1L は なんmL？",
      unit: "水のかさ",
    }} />);

    // ヒント2を開くまでは「えで おしえて」を出さない(doc §7 手順6)。
    await screen.findByRole("button", { name: "ヒントを みる" });
    expect(screen.queryByRole("button", { name: "えで おしえて" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "ヒントを みる" }));
    await screen.findByText("ヒント いちだんめ");
    expect(screen.queryByRole("button", { name: "えで おしえて" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /つぎの ヒント 2/ }));
    await screen.findByText("ヒント にだんめ");

    await user.click(await screen.findByRole("button", { name: "えで おしえて" }));

    expect(await screen.findByRole("img", { name: "もんだいの えヒント" })).toHaveAttribute(
      "src",
      "/visuals/volume.svg",
    );
    expect(fetchMock).toHaveBeenLastCalledWith("/api/ai/generate-image", expect.objectContaining({
      method: "POST",
    }));
  });
});
