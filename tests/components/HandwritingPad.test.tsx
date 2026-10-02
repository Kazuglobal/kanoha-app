import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HandwritingPad } from "@/components/child/HandwritingPad";

const fakeContext = {
  beginPath: vi.fn(),
  clearRect: vi.fn(),
  lineTo: vi.fn(),
  moveTo: vi.fn(),
  stroke: vi.fn(),
} as unknown as CanvasRenderingContext2D;

beforeEach(() => {
  // getContext is overloaded; cast through never to bypass the inferred GPU-context overload in the mock.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(fakeContext as never);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,AAA");
});

describe("HandwritingPad", () => {
  it("opens the canvas, lets the child draw, and submits the recognized answer", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, data: { answer: "1000mL" } }), { status: 200 }),
    );
    const onAnswer = vi.fn();
    const onSubmitAnswer = vi.fn();
    const user = userEvent.setup();

    render(
      <HandwritingPad
        childId="11111111-1111-4111-8111-111111111111"
        onAnswer={onAnswer}
        onSubmitAnswer={onSubmitAnswer}
        problemId="22222222-2222-4222-8222-222222222222"
      />,
    );

    await user.click(screen.getByRole("button", { name: /てがきで こたえる/ }));
    const canvas = screen.getByLabelText("てがき入力");
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(canvas, { clientX: 20, clientY: 20 });
    fireEvent.pointerUp(canvas);
    expect(fakeContext.stroke).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "これで こたえる" }));

    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith("1000mL"));
    await waitFor(() => expect(onSubmitAnswer).toHaveBeenCalledWith("1000mL"));
    expect(await screen.findByText(/「1000mL」と よみとっ/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/ai/recognize-handwriting", expect.objectContaining({
      method: "POST",
    }));
  });

  it("clears the canvas and shows a fallback message when recognition fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, error: "AI error" }), { status: 502 }),
    );
    const user = userEvent.setup();

    render(
      <HandwritingPad
        childId="11111111-1111-4111-8111-111111111111"
        onAnswer={vi.fn()}
        problemId="22222222-2222-4222-8222-222222222222"
      />,
    );

    await user.click(screen.getByRole("button", { name: /てがきで こたえる/ }));
    await user.click(screen.getByRole("button", { name: "けす" }));
    expect(fakeContext.clearRect).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "これで こたえる" }));
    expect(await screen.findByText("うまく よみとれなかったよ。すうじで にゅうりょくしてね。")).toBeInTheDocument();
  });

  it("shows appropriate fallback message for japanese subject without asking for numbers", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, error: "AI error" }), { status: 502 }),
    );
    const user = userEvent.setup();

    render(
      <HandwritingPad
        childId="demo"
        onAnswer={vi.fn()}
        problemId="kanji-1"
        subject="japanese"
      />,
    );

    await user.click(screen.getByRole("button", { name: /てがきで こたえる/ }));
    await user.click(screen.getByRole("button", { name: "これで こたえる" }));
    expect(
      await screen.findByText("うまく よみとれなかったよ。もういちど かくか、キーボードで にゅうりょくしてね。"),
    ).toBeInTheDocument();
  });

  it("supports undo, grid switching, and close button", async () => {
    const user = userEvent.setup();
    render(
      <HandwritingPad
        childId="11111111-1111-4111-8111-111111111111"
        onAnswer={vi.fn()}
        problemId="22222222-2222-4222-8222-222222222222"
        subject="japanese"
      />,
    );

    // Open pad
    await user.click(screen.getByRole("button", { name: /てがきで こたえる/ }));
    expect(screen.getByText("漢字・ことば てがきノート")).toBeInTheDocument();

    // Mode switch
    await user.click(screen.getByRole("button", { name: "2文字マス" }));
    await user.click(screen.getByRole("button", { name: "ふとい" }));

    // Draw a stroke
    const canvas = screen.getByLabelText("てがき入力");
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 30 });
    fireEvent.pointerMove(canvas, { clientX: 50, clientY: 50 });
    fireEvent.pointerUp(canvas);

    // Undo button should be enabled and clear/redraw
    const undoButton = screen.getByRole("button", { name: /1つもどす/ });
    expect(undoButton).toBeEnabled();
    await user.click(undoButton);
    expect(fakeContext.clearRect).toHaveBeenCalled();

    // Close button
    await user.click(screen.getByRole("button", { name: /とじる/ }));
    expect(screen.getByRole("button", { name: /てがきで こたえる/ })).toBeInTheDocument();
  });
});
