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

vi.mock("@/lib/utils/rateLimit", () => ({
  checkRateLimit: () => true,
  checkRateLimitDb: async () => true,
}));

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

const SIMILAR_CHOICES = ["2000mL", "200mL", "20000mL", "1000mL"];
const SIMILAR_IDS = Array.from({ length: 5 }, (_, index) => `similar-${index}`);

const baseTables = (review: Row | null) => ({
  learning_sessions: () => [{ id: SESSION }],
  problems: () => [problemRow],
  problem_hint_views: () => [{ max_level: 2 }],
  generated_similar_problems: () => [{
    id: SIMILAR, source_problem_id: PROBLEM, unit: "水のかさ", sub_unit: "LとmL", answer: "2000mL",
    explanation: "1Lは1000mLだよ。", choices: SIMILAR_CHOICES,
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
      hintLevelUsed: 4,
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    const inserted = callsFor(fake.calls, "attempts", "insert")[0].payload as Row;
    expect(inserted.is_correct).toBe(false);
    expect(inserted.mistake_type).toBe("unit_conversion_error");
    // hint_level_used はクライアント値(4)ではなく problem_hint_views の max_level(2)。
    expect(inserted.hint_level_used).toBe(2);
    const hintLookup = callsFor(fake.calls, "problem_hint_views", "select")[0];
    expect(filterValue(hintLookup, "session_id")).toBe(SESSION);
    expect(body.data.hint_level_used).toBe(2);
    expect(body.data.explanation).toBeNull();
    expect(JSON.stringify(body)).not.toContain("1000mL");
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
      similar_problem_id: SIMILAR, problem_id: null, mistake_type: "unit_conversion_error", hint_level_used: 0,
    });
    expect(fake.rpcCalls[0].args).toEqual({
      target_child_id: CHILD, target_unit: "水のかさ", target_sub_unit: "LとmL",
    });
    expect(callsFor(fake.calls, "review_schedule")).toHaveLength(0);
    expect(callsFor(fake.calls, "problem_hint_views")).toHaveLength(0);
    const body = await response.json();
    expect(body.data.is_correct).toBe(false);
    expect(body.data.explanation).toBe("1Lは1000mLだよ。");
  });

  it("similar-problem tap answers must be one of the stored choices", async () => {
    const fake = fakeSupabase({ tables: baseTables(null), rpc: () => rpcResult(1, 0) });
    state.supabase = fake.client;
    const { POST } = await import("@/app/api/attempts/route");

    const response = await POST(post("/api/attempts", {
      childId: CHILD, sessionId: SESSION, similarProblemId: SIMILAR, childAnswer: "2001mL", answerType: "tap",
    }));

    expect(response.status).toBe(400);
    expect(callsFor(fake.calls, "attempts", "insert")).toHaveLength(0);
  });

  it("a correct similar-problem answer returns no explanation", async () => {
    const fake = fakeSupabase({ tables: baseTables(null), rpc: () => rpcResult(2, 1) });
    state.supabase = fake.client;
    const { POST } = await import("@/app/api/attempts/route");

    const response = await POST(post("/api/attempts", {
      childId: CHILD, sessionId: SESSION, similarProblemId: SIMILAR, childAnswer: "2000mL", answerType: "tap",
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.is_correct).toBe(true);
    expect(body.data.explanation).toBeNull();
  });

  it("typed similar-problem answers are accepted when the problem has no choices", async () => {
    const fake = fakeSupabase({
      tables: {
        ...baseTables(null),
        generated_similar_problems: () => [{
          id: SIMILAR, source_problem_id: PROBLEM, unit: "水のかさ", sub_unit: "LとmL", answer: "3L50mL",
          explanation: "e", choices: null,
        }],
      },
      rpc: () => rpcResult(2, 1),
    });
    state.supabase = fake.client;
    const { POST } = await import("@/app/api/attempts/route");

    const response = await POST(post("/api/attempts", {
      childId: CHILD, sessionId: SESSION, similarProblemId: SIMILAR, childAnswer: "3L50mL", answerType: "text",
    }));
    expect(response.status).toBe(201);
    expect((await response.json()).data.is_correct).toBe(true);
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

  /**
   * D2: 類題の正解数はクライアントから受け取らず、そのセッションの attempts から導出する。
   * problem_id で引かれたら元問題の attempt、similar_problem_id (in) で引かれたら類題 5 問の attempt を返す。
   */
  const sessionAttempts = (similarCorrect: number, originalCorrect: boolean | null) => (call: QueryCall) => {
    if (call.operation !== "select") return [];
    if (filterValue(call, "problem_id")) return originalCorrect === null ? [] : [{ is_correct: originalCorrect }];
    return SIMILAR_IDS.map((id, index) => ({ similar_problem_id: id, is_correct: index < similarCorrect }));
  };

  const scheduleTables = (review: Row | null, similarCorrect: number, originalCorrect: boolean | null) => ({
    ...baseTables(review),
    generated_similar_problems: () => SIMILAR_IDS.map((id) => ({ id })),
    attempts: sessionAttempts(similarCorrect, originalCorrect),
  });

  const scheduleBody = { childId: CHILD, problemId: PROBLEM, sessionId: SESSION };

  it.each([
    [4, 1, 2, 3, "mastered"],
    [5, 1, 2, 7, "mastered"],
    [5, 2, 3, 7, "mastered"],
    [5, 3, 3, 7, "mastered"],
    [3, 2, 2, 1, "learning"],
    [0, 3, 3, 1, "learning"],
  ])(
    "schedule: %i/5 (derived from attempts) from stage %i → stage %i after %i days, mastery %s",
    async (similarCorrectCount, currentStage, expectedStage, days, mastery) => {
      const fake = fakeSupabase({
        tables: scheduleTables({ review_stage: currentStage, status: "pending" }, similarCorrectCount, null),
      });
      state.supabase = fake.client;
      const { POST } = await import("@/app/api/reviews/schedule/route");

      // クライアントが similarCorrectCount を送っても無視される。
      const response = await POST(post("/api/reviews/schedule", { ...scheduleBody, similarCorrectCount: 5 }));

      expect(response.status).toBe(200);
      const upsert = callsFor(fake.calls, "review_schedule", "upsert")[0];
      expect(upsert.payload).toMatchObject({
        review_stage: expectedStage,
        scheduled_for: addDaysJst(todayKeyJst(), days),
        status: "pending",
      });
      expect(upsert.options).toEqual({ onConflict: "child_id,problem_id" });
      const similarLookup = callsFor(fake.calls, "attempts", "select")
        .find((call) => call.filters.some((filter) => filter.op === "in"))!;
      expect(filterValue(similarLookup, "session_id")).toBe(SESSION);
      expect(filterValue(similarLookup, "similar_problem_id")).toEqual(SIMILAR_IDS);
      const masteryWrites = callsFor(fake.calls, "weakness_map", "upsert");
      if (mastery === "mastered") {
        expect(masteryWrites[0].payload).toMatchObject({ mastery_level: "mastered", unit: "水のかさ" });
      } else {
        expect(masteryWrites).toHaveLength(0);
      }
      const body = await response.json();
      expect(body.data.mastery_level).toBe(mastery);
      expect(body.data.scheduled).toBe(true);
      expect(body.data.similar_correct_count).toBe(similarCorrectCount);
    },
  );

  it("schedule: counts only the FIRST attempt per similar problem (re-posting the right choice cannot inflate it)", async () => {
    const attempts = (call: QueryCall) => {
      if (call.operation !== "select") return [];
      if (filterValue(call, "problem_id")) return [];
      // 古い順: similar-0 は最初が不正解(後で正解を再送)、similar-1 は最初が正解。
      return [
        { similar_problem_id: "similar-0", is_correct: false },
        { similar_problem_id: "similar-0", is_correct: true },
        { similar_problem_id: "similar-1", is_correct: true },
        { similar_problem_id: "similar-1", is_correct: false },
        { similar_problem_id: "similar-2", is_correct: true },
        { similar_problem_id: "similar-3", is_correct: true },
        { similar_problem_id: "similar-4", is_correct: false },
      ];
    };
    const fake = fakeSupabase({
      tables: { ...scheduleTables({ review_stage: 1, status: "pending" }, 0, null), attempts },
    });
    state.supabase = fake.client;
    const { POST } = await import("@/app/api/reviews/schedule/route");

    const body = await (await POST(post("/api/reviews/schedule", scheduleBody))).json();
    expect(body.data.similar_correct_count).toBe(3);
    expect(body.data.mastery_level).not.toBe("mastered");
    const attemptLookup = callsFor(fake.calls, "attempts", "select").find((call) => !filterValue(call, "problem_id"))!;
    expect(attemptLookup.order).toEqual({ column: "created_at", ascending: true });
  });

  it("schedule: scopes the count to the latest generated set of 5, so merged sets cannot reach 4 (D2b)", async () => {
    const fake = fakeSupabase({
      tables: scheduleTables({ review_stage: 1, status: "pending" }, 0, null),
    });
    state.supabase = fake.client;
    const { POST } = await import("@/app/api/reviews/schedule/route");

    await POST(post("/api/reviews/schedule", scheduleBody));
    const generated = callsFor(fake.calls, "generated_similar_problems", "select")[0];
    expect(generated.order).toEqual({ column: "created_at", ascending: false });
    expect(generated.limit).toBe(5);
  });

  it("schedule: 5/5 with no existing review and a correct original creates no review row (doc §12.1)", async () => {
    const fake = fakeSupabase({ tables: scheduleTables(null, 5, true) });
    state.supabase = fake.client;
    const { POST } = await import("@/app/api/reviews/schedule/route");

    const response = await POST(post("/api/reviews/schedule", scheduleBody));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.scheduled).toBe(false);
    expect(body.data.mastery_level).toBe("mastered");
    expect(callsFor(fake.calls, "review_schedule", "upsert")).toHaveLength(0);
    const lookup = callsFor(fake.calls, "attempts", "select")
      .find((call) => filterValue(call, "problem_id"))!;
    expect(filterValue(lookup, "problem_id")).toBe(PROBLEM);
    expect(filterValue(lookup, "session_id")).toBe(SESSION);
    expect(lookup.order).toEqual({ column: "created_at", ascending: false });
  });

  it("schedule: no original attempt at all creates no review row", async () => {
    const fake = fakeSupabase({ tables: scheduleTables(null, 4, null) });
    state.supabase = fake.client;
    const { POST } = await import("@/app/api/reviews/schedule/route");

    const response = await POST(post("/api/reviews/schedule", scheduleBody));

    expect((await response.json()).data.scheduled).toBe(false);
    expect(callsFor(fake.calls, "review_schedule", "upsert")).toHaveLength(0);
  });

  it("schedule: no similar problems at all counts as 0/5 without querying attempts for them", async () => {
    const fake = fakeSupabase({
      tables: { ...scheduleTables({ review_stage: 1, status: "pending" }, 0, null), generated_similar_problems: () => [] },
    });
    state.supabase = fake.client;
    const { POST } = await import("@/app/api/reviews/schedule/route");

    const body = await (await POST(post("/api/reviews/schedule", scheduleBody))).json();
    expect(body.data.similar_correct_count).toBe(0);
    expect(callsFor(fake.calls, "attempts", "select").some((call) => call.filters.some((f) => f.op === "in"))).toBe(false);
  });

  it("schedule: a wrong original with no existing review creates the review (stage 1 → 3 days on 4/5)", async () => {
    const fake = fakeSupabase({ tables: scheduleTables(null, 4, false) });
    state.supabase = fake.client;
    const { POST } = await import("@/app/api/reviews/schedule/route");

    const response = await POST(post("/api/reviews/schedule", scheduleBody));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.scheduled).toBe(true);
    expect(callsFor(fake.calls, "review_schedule", "upsert")[0].payload).toMatchObject({
      review_stage: 2, status: "pending", scheduled_for: addDaysJst(todayKeyJst(), 3),
    });
  });

  it("schedule: a done review with a correct original stays untouched", async () => {
    const done = { id: REVIEW, status: "done", review_stage: 2 };
    const fake = fakeSupabase({ tables: scheduleTables(done, 5, true) });
    state.supabase = fake.client;
    const { POST } = await import("@/app/api/reviews/schedule/route");

    const response = await POST(post("/api/reviews/schedule", scheduleBody));

    expect((await response.json()).data.scheduled).toBe(false);
    expect(callsFor(fake.calls, "review_schedule", "upsert")).toHaveLength(0);
  });

  it("schedule: 3/5 demotes mastered explicitly (the only demotion path)", async () => {
    const pending = { id: REVIEW, status: "pending", review_stage: 1 };
    const fake = fakeSupabase({
      tables: {
        ...scheduleTables(pending, 3, null),
        weakness_map: (call: QueryCall) => (call.operation === "select"
          ? [{ mastery_level: "mastered" }]
          : [call.payload as Row]),
      },
    });
    state.supabase = fake.client;
    const { POST } = await import("@/app/api/reviews/schedule/route");

    const response = await POST(post("/api/reviews/schedule", scheduleBody));

    expect((await response.json()).data.mastery_level).toBe("reviewing");
    expect(callsFor(fake.calls, "weakness_map", "upsert")[0].payload).toMatchObject({ mastery_level: "reviewing" });
  });

  it("schedule: rejects a session the child does not own and requires sessionId", async () => {
    const fake = fakeSupabase({ tables: { ...scheduleTables(null, 5, true), learning_sessions: () => [] } });
    state.supabase = fake.client;
    const { POST } = await import("@/app/api/reviews/schedule/route");

    expect((await POST(post("/api/reviews/schedule", scheduleBody))).status).toBe(404);
    expect((await POST(post("/api/reviews/schedule", { childId: CHILD, problemId: PROBLEM }))).status).toBe(400);
  });
});

describe("learning loop: sticky mastery through /api/attempts", () => {
  it("a wrong attempt in a mastered unit reports mastered (the RPC row is the truth)", async () => {
    const fake = fakeSupabase({
      tables: baseTables(null),
      rpc: () => ({
        data: [{ attempt_count: 6, correct_count: 4, mistake_count: 2, accuracy_rate: 0.6667, mastery_level: "mastered" }],
        error: null,
      }),
    });
    state.supabase = fake.client;
    const { POST } = await import("@/app/api/attempts/route");

    const response = await POST(post("/api/attempts", {
      childId: CHILD, sessionId: SESSION, problemId: PROBLEM, childAnswer: "100mL", answerType: "text",
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(callsFor(fake.calls, "attempts", "insert")[0].payload).toMatchObject({ is_correct: false });
    expect(body.data.mastery_level).toBe("mastered");
    expect(body.data.accuracy_rate).toBe(0.6667);
  });
});

describe("learning loop: sessions", () => {
  it("GET /api/sessions counts open sessions by elapsed time and finished sessions by duration", async () => {
    const startedAt = new Date(Date.now() - 4 * 60_000).toISOString();
    const fake = fakeSupabase({
      tables: {
        app_settings: () => [{ daily_limit_minutes: 10 }],
        learning_sessions: () => [
          { id: "open", started_at: startedAt, ended_at: null, duration_seconds: 0 },
          { id: "done", started_at: startedAt, ended_at: startedAt, duration_seconds: 300 },
        ],
        attempts: () => [],
      },
    });
    state.supabase = fake.client;
    const { GET } = await import("@/app/api/sessions/route");

    const response = await GET(new Request(`http://localhost/api/sessions?childId=${CHILD}`));
    const body = await response.json();

    expect(body.data).toEqual({ limitMinutes: 10, usedMinutes: 9, remainingMinutes: 1, limitReached: false });
    const query = callsFor(fake.calls, "learning_sessions")[0];
    expect(query.filters.map((filter) => filter.op)).toEqual(["eq", "gte", "lt"]);
    const lastAttempts = callsFor(fake.calls, "attempts")[0];
    expect(lastAttempts.columns).toBe("session_id, created_at");
    expect(filterValue(lastAttempts, "session_id")).toEqual(["open"]);
  });

  it("GET /api/sessions caps an abandoned open session at its last attempt + 10 min", async () => {
    const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
    const fake = fakeSupabase({
      tables: {
        app_settings: () => [{ daily_limit_minutes: 15 }],
        learning_sessions: () => [{ id: "open", started_at: minutesAgo(60), ended_at: null, duration_seconds: 0 }],
        attempts: () => [
          { session_id: "open", created_at: minutesAgo(55) },
          { session_id: "open", created_at: minutesAgo(50) },
        ],
      },
    });
    state.supabase = fake.client;
    const { GET } = await import("@/app/api/sessions/route");

    const body = await (await GET(new Request(`http://localhost/api/sessions?childId=${CHILD}`))).json();
    expect(body.data).toMatchObject({ usedMinutes: 20, limitReached: true });
  });

  it("GET /api/sessions skips the attempts lookup when no session is open", async () => {
    const fake = fakeSupabase({
      tables: {
        app_settings: () => [{ daily_limit_minutes: 15 }],
        learning_sessions: () => [{ id: "done", started_at: "x", ended_at: "y", duration_seconds: 60 }],
      },
    });
    state.supabase = fake.client;
    const { GET } = await import("@/app/api/sessions/route");

    const body = await (await GET(new Request(`http://localhost/api/sessions?childId=${CHILD}`))).json();
    expect(body.data.usedMinutes).toBe(1);
    expect(callsFor(fake.calls, "attempts")).toHaveLength(0);
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
    const inserted = callsFor(fake.calls, "generated_similar_problems", "insert")[0];
    const rows = inserted.payload as Row[];
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(row.choices).toHaveLength(4);
      expect(row.choices).toContain(row.answer);
      expect(new Set(row.choices as string[]).size).toBe(4);
    }
    expect(inserted.columns).toBe("id, problem_text, unit, sub_unit, difficulty, choices");
    expect(inserted.columns).not.toContain("answer");
    expect(inserted.columns).not.toContain("explanation");
    vi.doUnmock("@/lib/ai");
  });
});
