import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ChildError from "@/app/child/error";

describe("child error boundary", () => {
  it("やさしい言葉で知らせ、内部のエラー文は出さない", () => {
    render(<ChildError error={new Error("secret internal detail")} retry={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("うまく ひらけなかったよ");
    expect(screen.queryByText(/secret internal detail/)).toBeNull();
  });

  it("「もういちど」を押すと retry を呼ぶ", async () => {
    const retry = vi.fn();
    render(<ChildError error={new Error("boom")} retry={retry} />);
    await userEvent.click(screen.getByRole("button", { name: "もういちど" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("ホームへもどるリンクがある", () => {
    render(<ChildError error={new Error("boom")} retry={vi.fn()} />);
    expect(screen.getByRole("link", { name: "ホームへ もどる" })).toHaveAttribute("href", "/child/home");
  });

  it("子どもモードから抜けられるよう、親の PIN ボタンを出す(ホームが壊れていても閉じ込めない)", () => {
    render(<ChildError error={new Error("boom")} retry={vi.fn()} />);
    expect(screen.getByRole("button", { name: "おうちのかた" })).toBeInTheDocument();
  });

  it("main の目印を保ち、知らせる部分(見出しとメッセージ)だけを alert にする", () => {
    render(<ChildError error={new Error("boom")} retry={vi.fn()} />);
    expect(screen.getByRole("main")).toBeInTheDocument();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("うまく ひらけなかったよ");
    expect(alert).toHaveTextContent("もういちど おしてみてね");
    expect(alert).not.toContainElement(screen.getByRole("button", { name: "もういちど" }));
  });
});
