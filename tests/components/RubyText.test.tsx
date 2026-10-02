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

  it("does not attach ruby to target kanji inside brackets when excludeBrackets is true", () => {
    const { container } = render(
      <RubyAuto
        text="つぎの 漢字の 読み方を かきましょう。「青空」"
        readingMode="kanji_with_ruby"
        excludeBrackets
      />
    );
    // Instruction kanji have ruby
    const rubies = Array.from(container.querySelectorAll("ruby"));
    expect(rubies.some((r) => r.textContent?.includes("漢字"))).toBe(true);
    expect(rubies.some((r) => r.textContent?.includes("読み方"))).toBe(true);
    // Target kanji in brackets has NO ruby (does not spoil answer!)
    expect(rubies.some((r) => r.textContent?.includes("青空"))).toBe(false);
    expect(container).toHaveTextContent("「青空」");
  });

  it("preserves target kanji inside brackets when readingMode is hiragana and excludeBrackets is true", () => {
    const { container } = render(
      <RubyAuto
        text="つぎの 漢字の 読み方を かきましょう。「青空」"
        readingMode="hiragana"
        excludeBrackets
      />
    );
    expect(container.querySelector("rt")).toBeNull();
    // Instructions are converted to hiragana, but target kanji in brackets stays as kanji
    expect(container).toHaveTextContent("つぎの かんじの よみかたを かきましょう。「青空」");
  });
});

