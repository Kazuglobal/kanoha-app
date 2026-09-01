import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HintStepper } from "@/components/child/HintStepper";

describe("HintStepper", () => {
  it("reveals hints in order and never shows the answer before the final click", async () => {
    const user = userEvent.setup();
    render(<HintStepper hints={["first hint", "second hint", "solution text", "secret answer"]} />);

    expect(screen.queryByText("secret answer")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "ヒントを みる" }));
    expect(screen.getByText("first hint")).toBeInTheDocument();
    expect(screen.queryByText("secret answer")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /つぎの ヒント 2/ }));
    await user.click(screen.getByRole("button", { name: /つぎの ときかた/ }));
    expect(screen.queryByText("secret answer")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /つぎの こたえ/ }));
    expect(screen.getByText("secret answer")).toBeInTheDocument();
  });

  it("requests simpler hints without revealing another step", async () => {
    const simplify = vi.fn();
    const user = userEvent.setup();
    render(<HintStepper hints={["first hint", "second hint", "solution text", "secret answer"]} onSimplify={simplify} />);

    await user.click(screen.getByRole("button", { name: "ヒントを みる" }));
    await user.click(screen.getByRole("button", { name: "もっと かんたんに" }));

    expect(simplify).toHaveBeenCalledTimes(1);
    expect(screen.getByText("first hint")).toBeInTheDocument();
    expect(screen.queryByText("second hint")).not.toBeInTheDocument();
    expect(screen.queryByText("secret answer")).not.toBeInTheDocument();
  });
});
