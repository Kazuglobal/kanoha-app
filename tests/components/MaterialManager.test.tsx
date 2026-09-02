import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MaterialManager } from "@/components/parent/MaterialManager";

afterEach(() => vi.restoreAllMocks());

describe("MaterialManager", () => {
  it("lists a child's uploads and deletes one after confirmation", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: [{ id: "child-1", nickname: "かのは" }],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: [{
          id: "material-1",
          page_count: 2,
          source_type: "school_print",
          status: "done",
          expires_at: "2026-07-01T00:00:00.000Z",
          created_at: "2026-06-01T00:00:00.000Z",
        }],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: { deleted: true },
      })));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    render(<MaterialManager />);

    expect(await screen.findByText("学校のプリント / 2ページ")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "画像を削除" }));

    expect(fetchMock).toHaveBeenLastCalledWith("/api/materials/material-1", { method: "DELETE" });
    expect(screen.queryByText("学校のプリント / 2ページ")).not.toBeInTheDocument();
    expect(screen.getByText("画像を削除しました。")).toBeInTheDocument();
  });

  it("re-analyzes a failed material with もういちど かいせき", async () => {
    const failedMaterial = {
      id: "material-2",
      page_count: 1,
      source_type: "school_print",
      status: "failed",
      expires_at: "2026-10-01T00:00:00.000Z",
      created_at: "2026-09-01T00:00:00.000Z",
    };
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: [{ id: "child-1", nickname: "かのは" }],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: [failedMaterial],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: { id: "problem-1", problem_text: "1Lは何mLですか。" },
      }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: [{ ...failedMaterial, status: "done" }],
      })));
    const user = userEvent.setup();

    render(<MaterialManager />);

    await user.click(await screen.findByRole("button", { name: "もういちど かいせき" }));

    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/ai/analyze-problem",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("material-2"),
      }),
    );
    expect(await screen.findByText("もう一度解析しました。")).toBeInTheDocument();
    expect(screen.getByText(/解析済み/)).toBeInTheDocument();
  });
});
