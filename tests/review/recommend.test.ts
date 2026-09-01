import { describe, expect, it } from "vitest";

import {
  lowerDifficultyForRepeatedMistake,
  recommendToday,
  type RecommendationCandidate,
} from "@/lib/review/recommend";

const candidate = (
  id: string,
  overrides: Partial<RecommendationCandidate> = {},
): RecommendationCandidate => ({
  id,
  difficulty: "standard",
  estimatedMinutes: 2,
  isMastered: false,
  matchesRecentMistake: false,
  studyCount: 3,
  unit: id,
  weaknessAccuracyRate: null,
  ...overrides,
});

describe("recommendToday", () => {
  it("prioritizes due reviews over all other branches", () => {
    const results = recommendToday(
      [
        candidate("understudied", { studyCount: 0 }),
        candidate("mistake", { matchesRecentMistake: true }),
        candidate("weak", { weaknessAccuracyRate: 0.1 }),
        candidate("due", {
          review: { scheduledFor: "2026-06-12", status: "pending" },
        }),
      ],
      { today: "2026-06-12", maxItems: 4, maxMinutes: 15 },
    );

    expect(results.map(({ id }) => id)).toEqual([
      "due",
      "weak",
      "mistake",
      "understudied",
    ]);
  });

  it("orders weak units by lowest accuracy and excludes mastered weakness", () => {
    const results = recommendToday(
      [
        candidate("medium", { weaknessAccuracyRate: 0.5 }),
        candidate("lowest", { weaknessAccuracyRate: 0.2 }),
        candidate("mastered", {
          isMastered: true,
          weaknessAccuracyRate: 0.1,
        }),
      ],
      { today: "2026-06-12", maxItems: 3, maxMinutes: 15 },
    );

    expect(results.map(({ id }) => id)).toEqual([
      "lowest",
      "medium",
      "mastered",
    ]);
  });

  it("prioritizes recent mistake matches before understudied units", () => {
    const results = recommendToday(
      [
        candidate("new", { studyCount: 0 }),
        candidate("mistake", { matchesRecentMistake: true, studyCount: 10 }),
      ],
      { today: "2026-06-12", maxItems: 2, maxMinutes: 15 },
    );

    expect(results[0].id).toBe("mistake");
  });

  it("orders understudied units by study count", () => {
    const results = recommendToday(
      [candidate("seen-twice", { studyCount: 2 }), candidate("new", { studyCount: 0 })],
      { today: "2026-06-12", maxItems: 2, maxMinutes: 15 },
    );

    expect(results[0].id).toBe("new");
  });

  it("respects both item and time limits without mutating input", () => {
    const candidates = [
      candidate("one", { estimatedMinutes: 4, studyCount: 0 }),
      candidate("two", { estimatedMinutes: 4, studyCount: 1 }),
      candidate("three", { estimatedMinutes: 4, studyCount: 2 }),
    ];

    expect(
      recommendToday(candidates, {
        today: "2026-06-12",
        maxItems: 2,
        maxMinutes: 7,
      }).map(({ id }) => id),
    ).toEqual(["one"]);
    expect(candidates.map(({ id }) => id)).toEqual(["one", "two", "three"]);
  });
});

describe("lowerDifficultyForRepeatedMistake", () => {
  it.each([
    ["advanced", 2, "standard"],
    ["standard", 2, "basic"],
    ["basic", 3, "basic"],
    ["advanced", 1, "advanced"],
  ] as const)("maps %s with %i repeats to %s", (difficulty, count, expected) => {
    expect(lowerDifficultyForRepeatedMistake(difficulty, count)).toBe(expected);
  });
});
