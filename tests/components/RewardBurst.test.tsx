import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RewardBurst } from "@/components/child/RewardBurst";

describe("RewardBurst", () => {
  it("shows a readable mastery announcement with decorative particles", () => {
    const { container } = render(<RewardBurst unit="かさ" />);

    expect(screen.getByText("かさ マスター！")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-reward-particle]")).toHaveLength(12);
    expect(container.querySelector("[aria-hidden='true']")).toBeInTheDocument();
  });
});
