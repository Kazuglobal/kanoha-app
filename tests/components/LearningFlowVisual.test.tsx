import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LearningFlow } from "@/components/child/LearningFlow";

describe("LearningFlow visual hint", () => {
  it("requests and displays the problem's visual template", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: { id: "33333333-3333-4333-8333-333333333333", limitReached: false },
      }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: { kind: "template", url: "/visuals/volume-l-ml.svg" },
      }), { status: 200 }));
    const user = userEvent.setup();
    render(<LearningFlow persisted={{
      childId: "11111111-1111-4111-8111-111111111111",
      problemId: "22222222-2222-4222-8222-222222222222",
      question: "1L は なんmL？",
      unit: "水のかさ",
    }} />);

    await user.click(await screen.findByRole("button", { name: "えで おしえて" }));

    expect(await screen.findByRole("img", { name: "もんだいの えヒント" })).toHaveAttribute(
      "src",
      "/visuals/volume-l-ml.svg",
    );
    expect(fetchMock).toHaveBeenLastCalledWith("/api/ai/generate-image", expect.objectContaining({
      method: "POST",
    }));
  });
});
