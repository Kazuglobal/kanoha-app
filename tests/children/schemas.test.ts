import { describe, expect, it } from "vitest";
import { childProfileInput } from "@/lib/children/schemas";

describe("childProfileInput", () => {
  it("trims valid nicknames and supplies the default reading mode", () => {
    expect(childProfileInput.parse({ nickname: "  かのは  ", grade: 2 })).toEqual({
      nickname: "かのは",
      grade: 2,
      readingMode: "kanji_with_ruby",
    });
  });

  it("rejects empty nicknames and unsupported grades", () => {
    expect(childProfileInput.safeParse({ nickname: " ", grade: 2 }).success).toBe(false);
    expect(childProfileInput.safeParse({ nickname: "かのは", grade: 7 }).success).toBe(false);
  });
});
