import { describe, expect, it } from "vitest";
import { answersMatch } from "@/lib/utils/answers";

describe("answersMatch", () => {
  it("normalizes full-width characters and whitespace", () => {
    expect(answersMatch(" １０００ mL ", "1000mL")).toBe(true);
  });

  it("accepts hiragana and katakana equivalents", () => {
    expect(answersMatch("アオゾラ", "あおぞら")).toBe(true);
    expect(answersMatch("あおぞら", "アオゾラ")).toBe(true);
  });

  it("accepts kanji equivalents from dictionary", () => {
    expect(answersMatch("青空", "あおぞら")).toBe(true);
    expect(answersMatch("あおぞら", "青空")).toBe(true);
  });

  it("does not accept a client-selected incorrect answer", () => {
    expect(answersMatch("100mL", "1000mL")).toBe(false);
  });
});
