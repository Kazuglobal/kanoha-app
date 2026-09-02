import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RewardBurst } from "@/components/child/RewardBurst";

describe("RewardBurst", () => {
  it("shows a readable mastery announcement with decorative particles", () => {
    const { container } = render(<RewardBurst unit="かさ" />);

    // 単元名は RubyAuto で要素が分かれるため、strong の textContent 全体で照合する。
    expect(
      screen.getByText((_, element) =>
        element?.tagName === "STRONG" && element.textContent?.replace(/\s+/g, " ").trim() === "かさ マスター！",
      ),
    ).toBeInTheDocument();
    expect(container.querySelectorAll("[data-reward-particle]")).toHaveLength(12);
    expect(container.querySelector("[aria-hidden='true']")).toBeInTheDocument();
  });
});
