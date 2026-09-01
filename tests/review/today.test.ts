import { describe, expect, it } from "vitest";

import { findRecentMistake, getTodayRecommendations } from "@/lib/review/today";
import { addDaysJst, todayKeyJst } from "@/lib/utils/date";
import { callsFor, fakeSupabase, type QueryCall, type Row } from "@/tests/review/fakeSupabase";

const CHILD = "11111111-1111-4111-8111-111111111111";

const problem = (id: string, unit: string, subUnit = ""): Row => ({
  id, problem_text: `${id} text`, unit, sub_unit: subUnit, difficulty: "standard",
});

const tables = (overrides: Partial<Record<string, (call: QueryCall) => Row[]>> = {}) => ({
  problems: () => [problem("p-add", "たし算", "くり上がり"), problem("p-sub", "ひき算"), problem("p-len", "長さ")],
  review_schedule: () => [{ problem_id: "p-len", scheduled_for: todayKeyJst(), status: "pending" }],
  weakness_map: () => [{ unit: "ひき算", sub_unit: "", accuracy_rate: 0.2, mastery_level: "learning" }],
  attempts: () => [
    { problem_id: null, similar_problem_id: "s-add", mistake_type: "carry_error", is_correct: false },
  ],
  app_settings: () => [{ daily_limit_minutes: 15 }],
  learning_sessions: () => [],
  generated_similar_problems: () => [
    { id: "s-add", source_problem_id: "p-add", unit: "たし算", sub_unit: "くり上がり", difficulty: "basic" },
  ],
  ...overrides,
});

describe("findRecentMistake", () => {
  it("returns the newest incorrect attempt with a curriculum mistake type", () => {
    const attempts = [
      { problem_id: "a", similar_problem_id: null, mistake_type: null, is_correct: true },
      { problem_id: "b", similar_problem_id: null, mistake_type: "nonsense", is_correct: false },
      { problem_id: "c", similar_problem_id: null, mistake_type: "time_error", is_correct: false },
    ];
    expect(findRecentMistake(attempts, (attempt) => `unit-${attempt.problem_id}`)).toEqual({
      mistakeType: "time_error", unit: "unit-c",
    });
    expect(findRecentMistake(attempts, () => undefined)).toBeNull();
  });
});

describe("getTodayRecommendations", () => {
  it("orders problems and attempts by created_at desc with bounded limits", async () => {
    const fake = fakeSupabase({ tables: tables() });
    await getTodayRecommendations(fake.client, CHILD);

    const problems = callsFor(fake.calls, "problems")[0];
    expect(problems.order).toEqual({ column: "created_at", ascending: false });
    expect(problems.limit).toBe(100);
    const attempts = callsFor(fake.calls, "attempts")[0];
    expect(attempts.order).toEqual({ column: "created_at", ascending: false });
    expect(attempts.limit).toBe(300);
    const similar = callsFor(fake.calls, "generated_similar_problems")[0];
    expect(similar.order).toEqual({ column: "created_at", ascending: false });
    const sessions = callsFor(fake.calls, "learning_sessions")[0];
    expect(sessions.filters.map((filter) => filter.op)).toEqual(["eq", "gte", "lt"]);
  });

  it("ranks due review, weak unit, then the recent-mistake unit resolved from its similar problem", async () => {
    const fake = fakeSupabase({ tables: tables() });
    const result = await getTodayRecommendations(fake.client, CHILD);

    expect(result.error).toBe(false);
    expect(result.problems.map(({ id }) => id)).toEqual(["p-len", "p-sub", "p-add"]);
    expect(result.problems[0]).toMatchObject({ problem_text: "p-len text", estimatedMinutes: 3 });
  });

  it("uses the minutes remaining today as the time budget", async () => {
    const now = new Date();
    const startedAt = new Date(now.getTime() - 10 * 60_000).toISOString();
    const fake = fakeSupabase({
      tables: tables({
        learning_sessions: () => [{ started_at: startedAt, ended_at: null, duration_seconds: 0 }],
      }),
    });
    const result = await getTodayRecommendations(fake.client, CHILD, now);

    expect(result.remainingMinutes).toBe(5);
    expect(result.limitReached).toBe(false);
    expect(result.problems).toHaveLength(1);
  });

  it("recommends nothing once the daily limit is used up", async () => {
    const fake = fakeSupabase({
      tables: tables({
        learning_sessions: () => [{ started_at: "x", ended_at: "y", duration_seconds: 15 * 60 }],
      }),
    });
    const result = await getTodayRecommendations(fake.client, CHILD);

    expect(result.limitReached).toBe(true);
    expect(result.problems).toEqual([]);
  });

  it("ignores reviews scheduled for a later day", async () => {
    const fake = fakeSupabase({
      tables: tables({
        review_schedule: () => [{ problem_id: "p-len", scheduled_for: addDaysJst(todayKeyJst(), 3), status: "pending" }],
        attempts: () => [],
      }),
    });
    const result = await getTodayRecommendations(fake.client, CHILD);
    expect(result.problems[0].id).toBe("p-sub");
  });

  it("reports an error when any source query fails", async () => {
    const broken = fakeSupabase({
      tables: { ...tables(), attempts: () => ({ error: { message: "down" } }) },
    });
    const result = await getTodayRecommendations(broken.client, CHILD);
    expect(result).toEqual({ error: true, problems: [], limitReached: false, remainingMinutes: 0 });
  });
});
