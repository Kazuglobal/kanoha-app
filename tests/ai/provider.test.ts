import { describe, expect, it } from "vitest";

import { getAiProvider, parsedProblemSchema } from "@/lib/ai";

describe("getAiProvider", () => {
  it("selects deterministic mock data", async () => {
    const provider = getAiProvider({ AI_PROVIDER_TEXT: "mock" });
    const problems = await provider.analyzeProblems([]);

    expect(provider.name).toBe("mock");
    expect(problems).toHaveLength(3);
    expect(problems.map(({ unit }) => unit)).toEqual(["水のかさ", "たし算", "かけ算"]);
    expect(problems.every((problem) => parsedProblemSchema.safeParse(problem).success)).toBe(true);
    expect(problems[0].recommendedVisualTemplate).toBe("volume");
  });

  it("falls back to mock outside production when AI_PROVIDER_TEXT is unset", () => {
    expect(getAiProvider({ NODE_ENV: "test" }).name).toBe("mock");
    expect(getAiProvider({}).name).toBe("mock");
  });

  it("requires AI_PROVIDER_TEXT in production", () => {
    expect(() => getAiProvider({ NODE_ENV: "production" })).toThrow(
      "AI_PROVIDER_TEXT is required in production",
    );
    expect(getAiProvider({ NODE_ENV: "production", AI_PROVIDER_TEXT: "mock" }).name).toBe("mock");
  });

  it("rejects unsupported provider names", () => {
    expect(() => getAiProvider({ AI_PROVIDER_TEXT: "other" })).toThrow();
  });

  it("returns a fixed handwriting answer in mock mode", async () => {
    const provider = getAiProvider({ AI_PROVIDER_TEXT: "mock" });
    await expect(provider.recognizeHandwriting([], "1Lは何mLですか。")).resolves.toEqual({
      answer: "1000mL",
    });
  });

  it("generates exactly five similar problems in mock mode", async () => {
    const provider = getAiProvider({ AI_PROVIDER_TEXT: "mock" });
    const problems = await provider.generateSimilarProblems({
      difficulty: "standard",
      problemText: "1Lは何mLですか。",
      subUnit: "LとmL",
      unit: "水のかさ",
    });

    expect(problems).toHaveLength(5);
    expect(problems.every((item) => item.unit === "水のかさ")).toBe(true);
    expect(problems.every((item) => item.subUnit === "LとmL")).toBe(true);
    expect(problems.every((item) => item.difficulty === "standard")).toBe(true);
    expect(problems.every((item) => item.answer.length > 0)).toBe(true);
    expect(problems.every((item) => item.explanation.length > 0)).toBe(true);
  });
});
