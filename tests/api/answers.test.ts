import { describe, expect, it } from "vitest";
import { answersMatch } from "@/lib/utils/answers";

describe("answersMatch", () => {
  it("normalizes full-width characters and whitespace", () => {
    expect(answersMatch(" １０００ mL ", "1000mL")).toBe(true);
  });

  it("does not accept a client-selected incorrect answer", () => {
    expect(answersMatch("100mL", "1000mL")).toBe(false);
  });
});
