import { describe, expect, it } from "vitest";

import { buildChoices, parseNumericAnswer, readStoredChoices } from "@/lib/review/choices";

describe("parseNumericAnswer", () => {
  it.each([
    ["1000mL", { value: 1000, suffix: "mL" }],
    ["12こ", { value: 12, suffix: "こ" }],
    ["43", { value: 43, suffix: "" }],
    [" 7 cm ", { value: 7, suffix: "cm" }],
    ["１２３ｃｍ", { value: 123, suffix: "cm" }],
  ])("parses %j", (answer, expected) => {
    expect(parseNumericAnswer(answer)).toEqual(expected);
  });

  it.each(["3L50mL", "1/2", "さんかく", "", "mL", "12.5cm", "3時20分"])("returns null for %j", (answer) => {
    expect(parseNumericAnswer(answer)).toBeNull();
  });
});

describe("buildChoices", () => {
  it("returns 4 unique choices sharing the answer's unit, including the answer", () => {
    const choices = buildChoices("1000mL", "problem-1:0");
    expect(choices).not.toBeNull();
    expect(choices).toHaveLength(4);
    expect(new Set(choices)).toHaveProperty("size", 4);
    expect(choices).toContain("1000mL");
    for (const choice of choices!) {
      expect(choice).toMatch(/^\d+mL$/);
    }
  });

  it("is deterministic for the same answer and seed, and changes with the seed", () => {
    expect(buildChoices("12こ", "seed-a")).toEqual(buildChoices("12こ", "seed-a"));
    const orders = new Set(
      Array.from({ length: 8 }, (_, index) => buildChoices("12こ", `seed-${index}`)!.join("|")),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it("never produces negative distractors for small answers", () => {
    const choices = buildChoices("0", "seed");
    expect(choices).toHaveLength(4);
    for (const choice of choices!) {
      expect(Number(choice)).toBeGreaterThanOrEqual(0);
    }
    expect(choices).toContain("0");
  });

  it("returns null for answers that are not a number plus unit", () => {
    expect(buildChoices("3L50mL", "seed")).toBeNull();
    expect(buildChoices("1/2", "seed")).toBeNull();
    expect(buildChoices("正方形", "seed")).toBeNull();
  });

  it("does not spread the answer position across a single fixed slot", () => {
    const positions = new Set(
      Array.from({ length: 12 }, (_, index) => buildChoices("43", `p:${index}`)!.indexOf("43")),
    );
    expect(positions.size).toBeGreaterThan(1);
  });
});

describe("readStoredChoices", () => {
  it("accepts only a 4-string array", () => {
    expect(readStoredChoices(["1", "2", "3", "4"])).toEqual(["1", "2", "3", "4"]);
    expect(readStoredChoices(["1", "2", "3"])).toBeNull();
    expect(readStoredChoices(["1", 2, "3", "4"])).toBeNull();
    expect(readStoredChoices(null)).toBeNull();
    expect(readStoredChoices("1,2,3,4")).toBeNull();
  });
});
