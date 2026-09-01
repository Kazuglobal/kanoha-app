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
    const user = userEvent.setup();

    render(
      <HandwritingPad
        childId="11111111-1111-4111-8111-111111111111"
        onAnswer={onAnswer}
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
    expect(await screen.findByText("「1000mL」と よみとったよ。")).toBeInTheDocument();
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
});
