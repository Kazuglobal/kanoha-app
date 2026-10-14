import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CurriculumStageSection } from "@/components/child/CurriculumStageSection";

describe("CurriculumStageSection progress", () => {
  it("shows how many problems were solved and continues from the first unsolved one", () => {
    render(<CurriculumStageSection currentSubject="math" childId="c1" solvedIds={["addition-1"]} />);
    const card = screen.getByTitle("たし算をはじめよう");
    expect(card).toHaveAttribute("href", "/child/problem/addition-2?childId=c1");
    expect(card.textContent).toContain("1/7");
    expect(card.textContent).toContain("つづきから");
  });

  it("marks a fully solved unit as cleared", () => {
    render(<CurriculumStageSection currentSubject="english" solvedIds={["english-colors-1", "english-colors-2", "english-colors-3"]} />);
    const card = screen.getByTitle("いろをはじめよう");
    expect(card.textContent).toContain("クリア");
    expect(card.textContent).toContain("もういちど");
  });

  it("starts every unit from the first problem when nothing is solved", () => {
    render(<CurriculumStageSection currentSubject="japanese" />);
    expect(screen.getByTitle("漢字をはじめよう")).toHaveAttribute("href", "/child/problem/kanji-1");
  });
});
