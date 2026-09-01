import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RubyAuto, RubyText } from "@/components/child/RubyText";

describe("RubyText", () => {
  it("renders ruby annotations", () => {
    const { container } = render(<RubyText parts={[{ text: "問題", ruby: "もんだい" }, { text: "です" }]} />);
    expect(container.querySelector("ruby")).toHaveTextContent("問題");
    expect(container.querySelector("rt")).toHaveTextContent("もんだい");
  });
});

describe("RubyAuto", () => {
  it("adds ruby for kanji when readingMode is kanji_with_ruby", () => {
    const { container } = render(<RubyAuto text="1Lは何mL" readingMode="kanji_with_ruby" />);
    expect(container.querySelector("rt")).toHaveTextContent("なん");
    expect(container.querySelector("ruby")).toHaveTextContent("何");
  });

  it("replaces kanji with hiragana and renders no ruby when readingMode is hiragana", () => {
    const { container } = render(<RubyAuto text="1Lは何mL" readingMode="hiragana" />);
    expect(container.querySelector("rt")).toBeNull();
    expect(container).toHaveTextContent("1LはなんmL");
  });
});

