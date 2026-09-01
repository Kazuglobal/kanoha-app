import { beforeEach, describe, expect, it, vi } from "vitest";

import { addDaysJst, todayKeyJst } from "@/lib/utils/date";
import {
  callsFor,
  fakeSupabase,
  filterValue,
  type QueryCall,
  type Row,
} from "@/tests/review/fakeSupabase";

const CHILD = "11111111-1111-4111-8111-111111111111";
const SESSION = "22222222-2222-4222-8222-222222222222";
const PROBLEM = "33333333-3333-4333-8333-333333333333";
const SIMILAR = "44444444-4444-4444-8444-444444444444";
const REVIEW = "55555555-5555-4555-8555-555555555555";

const problemRow: Row = {
  id: PROBLEM,
  child_id: CHILD,
  problem_text: "1L は なんmL ですか？",
  correct_answer: "1000mL",
  unit: "水のかさ",
  sub_unit: "LとmL",
  difficulty: "standard",
  explanation_json: { mistakeType: "unit_conversion_error", hint1: "h1" },
};

const state = vi.hoisted(() => ({ supabase: null as unknown }));

vi.mock("@/lib/utils/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/utils/api")>();
  return {
    ...original,
    requireOwnedChild: vi.fn(async () => ({
      supabase: state.supabase,
      user: { id: "user-1" },
      response: null,
    })),
  };
});

const post = (path: string, body: Row) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const rpcResult = (attempts: number, correct: number) => ({
  data: [{
    attempt_count: attempts,
    correct_count: correct,
    mistake_count: attempts - correct,
    accuracy_rate: correct / attempts,
    mastery_level: "learning",
  }],
  error: null,
});

const baseTables = (review: Row | null) => ({
  learning_sessions: () => [{ id: SESSION }],
  problems: () => [problemRow],
  generated_similar_problems: () => [{
    id: SIMILAR, source_problem_id: PROBLEM, unit: "水のかさ", sub_unit: "LとmL", answer: "2000mL",
  }],
  attempts: (call: QueryCall) => (call.operation === "insert"
    ? [{ id: "attempt-1", is_correct: (call.payload as Row).is_correct, created_at: "now" }]
    : []),
  review_schedule: (call: QueryCall) => (call.operation === "select"
    ? (review ? [review] : [])
    : [{ id: REVIEW, ...(call.payload as Row) }]),
  weakness_map: (call: QueryCall) => (call.operation === "select" ? [] : [call.payload as Row]),
});

describe("learning loop: attempts → weakness → review → schedule", () => {
  beforeEach(() => {
    state.supabase = null;
  });

  it("wrong first attempt: inherits AI mistakeType, recomputes the unit via RPC, creates a stage-1 review", async () => {
    const fake = fakeSupabase({ tables: baseTables(null), rpc: () => rpcResult(1, 0) });
    state.supabase = fake.client;
    const { POST } = await import("@/app/api/attempts/route");

    const response = await POST(post("/api/attempts", {
      childId: CHILD, sessionId: SESSION, problemId: PROBLEM, childAnswer: "100mL", answerType: "text",
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    const inserted = callsFor(fake.calls, "attempts", "insert")[0].payload as Row;
    expect(inserted.is_correct).toBe(false);
    expect(inserted.mistake_type).toBe("unit_conversion_error");
    expect(fake.rpcCalls).toEqual([{
      name: "recompute_weakness",
      args: { target_child_id: CHILD, target_unit: "水のかさ", target_sub_unit: "LとmL" },
    }]);
    const review = callsFor(fake.calls, "review_schedule", "upsert")[0];
    expect(review.payload).toMatchObject({
      child_id: CHILD, problem_id: PROBLEM, unit: "水のかさ", review_stage: 1, status: "pending",
      scheduled_for: addDaysJst(todayKeyJst(), 1),
    });
    expect(review.options).toEqual({ onConflict: "child_id,problem_id" });
    expect(body.data.mastery_level).toBe("learning");
    expect(body.data.review.action).toBe("created");
  });

  it("second wrong attempt while a review is pending does not create another review", async () => {
    const pending = { id: REVIEW, status: "pending", scheduled_for: addDaysJst(todayKeyJst(), 1), review_stage: 1 };
    const fake = fakeSupabase({ tables: baseTables(pending), rpc: () => rpcResult(2, 0) });
    state.supabase = fake.client;
    const { POST } = await import("@/app/api/attempts/route");

    const response = await POST(post("/api/attempts", {
      childId: CHILD, sessionId: SESSION, problemId: PROBLEM, childAnswer: "10mL", answerType: "text",
    }));

    expect(response.status).toBe(201);
    expect(callsFor(fake.calls, "review_schedule", "upsert")).toHaveLength(0);
    expect((await response.json()).data.review).toEqual({ action: "none" });
  });

  it("correct attempt on a review due today marks it done and keeps the request mistakeType null", async () => {
    const due = { id: REVIEW, status: "pending", scheduled_for: todayKeyJst(), review_stage: 1 };
    const fake = fakeSupabase({ tables: baseTables(due), rpc: () => rpcResult(3, 1) });
    state.supabase = fake.client;
    const { POST } = await import("@/app/api/attempts/route");

    const response = await POST(post("/api/attempts", {
      childId: CHILD, sessionId: SESSION, problemId: PROBLEM, childAnswer: "1000 mL", answerType: "voice",
      mistakeType: "careless_error",
    }));

    expect(response.status).toBe(201);
    const inserted = callsFor(fake.calls, "attempts", "insert")[0].payload as Row;
    expect(inserted).toMatchObject({ is_correct: true, mistake_type: null });
    const done = callsFor(fake.calls, "review_schedule", "update")[0];
    expect(done.payload).toEqual({ status: "done" });
    expect(filterValue(done, "id")).toBe(REVIEW);
    expect((await response.json()).data.review).toEqual({ action: "completed", reviewId: REVIEW });
  });

  it("similar-problem attempt recomputes the same unit and inherits the source problem's mistakeType", async () => {
    const fake = fakeSupabase({ tables: baseTables(null), rpc: () => rpcResult(4, 1) });
    state.supabase = fake.client;
    const { POST } = await import("@/app/api/attempts/route");

    const response = await POST(post("/api/attempts", {
      childId: CHILD, sessionId: SESSION, similarProblemId: SIMILAR, childAnswer: "200mL", answerType: "tap",
    }));

    expect(response.status).toBe(201);
    expect(callsFor(fake.calls, "attempts", "insert")[0].payload).toMatchObject({
      similar_problem_id: SIMILAR, problem_id: null, mistake_type: "unit_conversion_error",
    });
    expect(fake.rpcCalls[0].args).toEqual({
      target_child_id: CHILD, target_unit: "水のかさ", target_sub_unit: "LとmL",
    });
    expect(callsFor(fake.calls, "review_schedule")).toHaveLength(0);
  });

  it("fails closed when the RPC errors", async () => {
    const fake = fakeSupabase({
      tables: baseTables(null),
      rpc: () => ({ data: null, error: { message: "boom" } }),
    });
    state.supabase = fake.client;
    const { POST } = await import("@/app/api/attempts/route");

    const response = await POST(post("/api/attempts", {
      childId: CHILD, sessionId: SESSION, problemId: PROBLEM, childAnswer: "1", answerType: "text",
    }));
    expect(response.status).toBe(500);
  });

  it.each([
    [4, 1, 2, 3, "mastered"],
    [5, 1, 2, 7, "mastered"],
    [5, 2, 3, 7, "mastered"],
    [5, 3, 3, 7, "mastered"],
    [3, 2, 2, 1, "learning"],
    [0, 3, 3, 1, "learning"],
  ])(
    "schedule: %i/5 from stage %i → stage %i after %i days, mastery %s",
    async (similarCorrectCount, currentStage, expectedStage, days, mastery) => {
      const fake = fakeSupabase({ tables: baseTables({ review_stage: currentStage }) });
      state.supabase = fake.client;
      const { POST } = await import("@/app/api/reviews/schedule/route");

      const response = await POST(post("/api/reviews/schedule", {
        childId: CHILD, problemId: PROBLEM, similarCorrectCount,
      }));

      expect(response.status).toBe(200);
      const upsert = callsFor(fake.calls, "review_schedule", "upsert")[0];
      expect(upsert.payload).toMatchObject({
        review_stage: expectedStage,
        scheduled_for: addDaysJst(todayKeyJst(), days),
        status: "pending",
      });
      expect(upsert.options).toEqual({ onConflict: "child_id,problem_id" });
      const masteryWrites = callsFor(fake.calls, "weakness_map", "upsert");
      if (mastery === "mastered") {
        expect(masteryWrites[0].payload).toMatchObject({ mastery_level: "mastered", unit: "水のかさ" });
      } else {
        expect(masteryWrites).toHaveLength(0);
      }
      expect((await response.json()).data.mastery_level).toBe(mastery);
    },
  );
});

describe("learning loop: sessions", () => {
  it("GET /api/sessions counts open sessions by elapsed time and finished sessions by duration", async () => {
    const startedAt = new Date(Date.now() - 4 * 60_000).toISOString();
    const fake = fakeSupabase({
      tables: {
        app_settings: () => [{ daily_limit_minutes: 10 }],
        learning_sessions: () => [
          { started_at: startedAt, ended_at: null, duration_seconds: 0 },
          { started_at: startedAt, ended_at: startedAt, duration_seconds: 300 },
        ],
      },
    });
    state.supabase = fake.client;
    const { GET } = await import("@/app/api/sessions/route");

    const response = await GET(new Request(`http://localhost/api/sessions?childId=${CHILD}`));
    const body = await response.json();

    expect(body.data).toEqual({ limitMinutes: 10, usedMinutes: 9, remainingMinutes: 1, limitReached: false });
    const query = callsFor(fake.calls, "learning_sessions")[0];
    expect(query.filters.map((filter) => filter.op)).toEqual(["eq", "gte", "lt"]);
  });

  it("POST /api/sessions refuses to start once the limit is reached", async () => {
    const fake = fakeSupabase({
      tables: {
        app_settings: () => [{ daily_limit_minutes: 5 }],
        learning_sessions: () => [{ started_at: "x", ended_at: "y", duration_seconds: 300 }],
      },
    });
    state.supabase = fake.client;
    const { POST } = await import("@/app/api/sessions/route");

    const response = await POST(post("/api/sessions", { childId: CHILD }));
    expect((await response.json()).data.limitReached).toBe(true);
    expect(callsFor(fake.calls, "learning_sessions", "insert")).toHaveLength(0);
  });

  it("PATCH /api/sessions/[id] clamps duration to server time and derives counts from attempts", async () => {
    const startedAt = new Date(Date.now() - 90_000).toISOString();
    const fake = fakeSupabase({
      tables: {
        learning_sessions: (call: QueryCall) => (call.operation === "select"
          ? [{ id: SESSION, started_at: startedAt, ended_at: null }]
          : [{ id: SESSION, ...(call.payload as Row) }]),
        attempts: () => [{ is_correct: true }, { is_correct: false }, { is_correct: true }],
      },
    });
    state.supabase = fake.client;
    const { PATCH } = await import("@/app/api/sessions/[id]/route");

    const response = await PATCH(
      new Request(`http://localhost/api/sessions/${SESSION}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ childId: CHILD, durationSeconds: 3600, totalQuestions: 99, correctCount: 99 }),
      }),
      { params: Promise.resolve({ id: SESSION }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    const update = callsFor(fake.calls, "learning_sessions", "update")[0].payload as Row;
    expect(update.total_questions).toBe(3);
    expect(update.correct_count).toBe(2);
    expect(update.duration_seconds).toBeGreaterThanOrEqual(89);
    expect(update.duration_seconds).toBeLessThanOrEqual(91);
    expect(body.data.correct_count).toBe(2);
  });
});

describe("learning loop: repeated mistakes lower similar-problem difficulty", () => {
  it("passes one difficulty lower and the repeated mistakeType to the provider", async () => {
    const generate = vi.fn(async (input: { difficulty: string; unit: string; subUnit: string }) =>
      Array.from({ length: 5 }, (_, index) => ({
        problemText: `もんだい ${index + 1}`,
        answer: `${index + 1}L`,
        unit: input.unit,
        subUnit: input.subUnit,
        difficulty: input.difficulty,
        explanation: "せつめい",
      })));
    vi.doMock("@/lib/ai", () => ({
      getAiProvider: () => ({ name: "mock", generateSimilarProblems: generate }),
    }));
    const fake = fakeSupabase({
      tables: {
        problems: () => [problemRow],
        generated_similar_problems: (call: QueryCall) => (call.operation === "insert"
          ? (call.payload as Row[]).map((row, index) => ({ id: `similar-${index}`, ...row }))
          : [{ id: SIMILAR }]),
        attempts: () => [
          { problem_id: null, similar_problem_id: SIMILAR, mistake_type: "unit_conversion_error", is_correct: false },
          { problem_id: PROBLEM, similar_problem_id: null, mistake_type: "unit_conversion_error", is_correct: false },
          { problem_id: PROBLEM, similar_problem_id: null, mistake_type: null, is_correct: true },
        ],
      },
    });
    state.supabase = fake.client;
    const { POST } = await import("@/app/api/ai/generate-similar-problems/route");

    const response = await POST(post("/api/ai/generate-similar-problems", { childId: CHILD, problemId: PROBLEM }));

    expect(response.status).toBe(201);
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      difficulty: "basic",
      mistakeType: "unit_conversion_error",
      unit: "水のかさ",
    }));
    vi.doUnmock("@/lib/ai");
  });
});
