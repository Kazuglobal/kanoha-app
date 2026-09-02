import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearProgress,
  parseProgress,
  readProgress,
  writeProgress,
  type LearningProgress,
} from "@/lib/sessions/progress";

const progress: LearningProgress = {
  sessionId: "33333333-3333-4333-8333-333333333333",
  problemId: "22222222-2222-4222-8222-222222222222",
  practiceIndex: 2,
  score: 1,
  revealedCount: 3,
  similar: [
    { id: "sp-1", question: "2Lは 何mL？", choices: ["2000mL", "200mL", "20mL", "1200mL"] },
  ],
};

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("parseProgress (pure)", () => {
  it("round-trips valid JSON for the same problem", () => {
    expect(parseProgress(JSON.stringify(progress), progress.problemId)).toEqual(progress);
  });

  it("rejects progress stored for another problem", () => {
    expect(parseProgress(JSON.stringify(progress), "other-problem")).toBeNull();
  });

  it("rejects broken JSON, wrong shapes and null input", () => {
    expect(parseProgress("{oops", progress.problemId)).toBeNull();
    expect(parseProgress(JSON.stringify({ ...progress, revealedCount: 9 }), progress.problemId)).toBeNull();
    expect(parseProgress(JSON.stringify({ ...progress, sessionId: "" }), progress.problemId)).toBeNull();
    expect(parseProgress(null, progress.problemId)).toBeNull();
  });

  it("accepts a null practiceIndex and null similar set", () => {
    const beforePractice = { ...progress, practiceIndex: null, similar: null };
    expect(parseProgress(JSON.stringify(beforePractice), progress.problemId)).toEqual(beforePractice);
  });
});

describe("sessionStorage wrapper", () => {
  it("writes, reads and clears progress", () => {
    writeProgress(progress);
    expect(readProgress(progress.problemId)).toEqual(progress);
    clearProgress(progress.problemId);
    expect(readProgress(progress.problemId)).toBeNull();
  });

  it("swallows storage failures instead of breaking the flow", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    expect(() => writeProgress(progress)).not.toThrow();
  });
});
