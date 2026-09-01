import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UploadMaterials } from "@/components/parent/UploadMaterials";

const childId = "11111111-1111-4111-8111-111111111111";
const materialId = "22222222-2222-4222-8222-222222222222";

describe("UploadMaterials", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads selected images and starts analysis", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: [{ id: childId, nickname: "かのは" }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: { id: materialId, page_count: 1 },
      }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: { problem_text: "1Lは何mLですか。" },
      }), { status: 201 }));
    const user = userEvent.setup();
    render(<UploadMaterials />);

    expect(await screen.findByRole("option", { name: "かのは" })).toBeInTheDocument();
    const file = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])],
      "print.png",
      { type: "image/png" },
    );
    await user.upload(screen.getByLabelText("画像を選ぶ"), file);
    await user.click(screen.getByRole("button", { name: "1ページを解析する" }));

    expect(await screen.findByRole("status")).toHaveTextContent("解析が完了しました");
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/ai/analyze-problem",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("rejects unsupported files before upload", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({
      success: true,
      data: [{ id: childId, nickname: "かのは" }],
    }), { status: 200 }));
    render(<UploadMaterials />);

    await screen.findByRole("option", { name: "かのは" });
    fireEvent.change(screen.getByLabelText("画像を選ぶ"), {
      target: {
        files: [new File(["text"], "notes.txt", { type: "text/plain" })],
      },
    });

    expect(screen.getByRole("alert")).toHaveTextContent("JPEG・PNG・WebP");
  });
});
