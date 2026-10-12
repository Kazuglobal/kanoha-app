import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CurriculumStageSection } from "@/components/child/CurriculumStageSection";

describe("CurriculumStageSection progress", () => {
  it("shows how many problems were solved and continues from the first unsolved one", () => {
    render(<CurriculumStageSection currentSubject="math" childId="c1" solvedIds={["order-of-operations-1"]} />);
    const card = screen.getByTitle("計算のきまりをはじめよう");
    expect(card).toHaveAttribute("href", "/child/problem/order-of-operations-2?childId=c1");
    expect(card.textContent).toContain("1/4");
    expect(card.textContent).toContain("つづきから");
  });

  it("marks a fully solved unit as cleared", () => {
    render(<CurriculumStageSection currentSubject="english" solvedIds={["english-colors-1", "english-animals-1", "english-shopping-3"]} />);
    const card = screen.getByTitle("ほしいものとお買い物をはじめよう");
    expect(card.textContent).toContain("クリア");
    expect(card.textContent).toContain("もういちど");
  });

  it("starts every unit from the first problem when nothing is solved", () => {
    render(<CurriculumStageSection currentSubject="japanese" />);
    expect(screen.getByTitle("漢字をはじめよう")).toHaveAttribute("href", "/child/problem/kanji-1");
  });
});
