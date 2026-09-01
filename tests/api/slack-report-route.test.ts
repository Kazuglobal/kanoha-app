import { beforeEach, describe, expect, it, vi } from "vitest";
import { callsFor, fakeSupabase, type QueryCall, type Row, type TableHandler } from "@/tests/review/fakeSupabase";

const CHILD = "11111111-1111-4111-8111-111111111111";

const state = vi.hoisted(() => ({
  supabase: null as unknown,
  rateLimitAllowed: true,
  sent: [] as string[],
  sendError: false,
}));

vi.mock("@/lib/utils/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/utils/api")>();
  return {
    ...original,
    requireOwnedChild: vi.fn(async () => ({ supabase: state.supabase, user: { id: "user-1" }, response: null })),
  };
});

vi.mock("@/lib/utils/rateLimit", () => ({
  checkRateLimit: () => true,
  checkRateLimitDb: vi.fn(async () => state.rateLimitAllowed),
}));

vi.mock("@/lib/slack/sendReport", () => ({
  sendSlackReport: vi.fn(async (_url: string, message: string) => {
    if (state.sendError) throw new Error("Slack delivery failed");
    state.sent.push(message);
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: async () => ({
      data: [{ enable_slack: true, webhook_url: "https://hooks.slack.com/services/a/b/c" }],
      error: null,
    }),
  }),
}));

const post = (body: Row) =>
  new Request("http://localhost/api/reports/slack", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const today = new Date().toISOString();

const baseTables = (overrides: Record<string, TableHandler> = {}): Record<string, TableHandler> => ({
  parent_reports: (call: QueryCall) => {
    if (call.operation === "select") return [];
    if (call.operation === "upsert") return [{ id: "report-1", slack_sent_at: null }];
    return [{ id: "report-1" }];
  },
  learning_sessions: () => [{ started_at: today, duration_seconds: 600 }],
  attempts: () => [
    { created_at: today, hint_level_used: 1, is_correct: true, mistake_type: null, problem_id: "p1", similar_problem_id: null },
    { created_at: today, hint_level_used: 0, is_correct: false, mistake_type: "carry_error", problem_id: "p1", similar_problem_id: null },
  ],
  weakness_map: () => [
    { unit: "たし算", sub_unit: "くり上がり", accuracy_rate: 0.5, mistake_count: 1, mastery_level: "learning" },
  ],
  review_schedule: () => [],
  problems: () => [{ id: "p1", problem_text: "3+9は？", unit: "たし算" }],
  ...overrides,
});

const loadRoute = async () => (await import("@/app/api/reports/slack/route")).POST;

describe("POST /api/reports/slack (real daily report)", () => {
  beforeEach(() => {
    state.rateLimitAllowed = true;
    state.sent = [];
    state.sendError = false;
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  });

  it("builds the report from real aggregates, saves it, and sends the §17 message", async () => {
    const fake = fakeSupabase({ tables: baseTables() });
    state.supabase = fake.client;

    const response = await (await loadRoute())(post({ childId: CHILD }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ sent: true, alreadySent: false });
    const upsert = callsFor(fake.calls, "parent_reports", "upsert")[0];
    const payload = upsert.payload as Row;
    expect(payload.child_id).toBe(CHILD);
    expect(payload.accuracy_rate).toBe(0.5);
    expect(payload.weak_units).toEqual(["たし算・くり上がり"]);
    expect(upsert.options).toEqual({ onConflict: "child_id,report_date" });
    expect(state.sent).toHaveLength(1);
    expect(state.sent[0]).toContain("学習時間:10分");
    expect(state.sent[0]).toContain("正答率:1/2");
    expect(state.sent[0]).toContain("・たし算・くり上がり");
  });

  it("returns 429 when the DB rate limit rejects the call", async () => {
    state.rateLimitAllowed = false;
    const fake = fakeSupabase({ tables: baseTables() });
    state.supabase = fake.client;

    const response = await (await loadRoute())(post({ childId: CHILD }));

    expect(response.status).toBe(429);
    expect(state.sent).toHaveLength(0);
  });

  it("does not send twice for the same day", async () => {
    const fake = fakeSupabase({
      tables: baseTables({
        parent_reports: () => [{ id: "report-1", slack_sent_at: "2026-06-13T12:00:00Z" }],
      }),
    });
    state.supabase = fake.client;

    const response = await (await loadRoute())(post({ childId: CHILD }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ sent: false, alreadySent: true });
    expect(state.sent).toHaveLength(0);
  });

  it("releases the claim and returns 502 when Slack delivery fails", async () => {
    state.sendError = true;
    const fake = fakeSupabase({ tables: baseTables() });
    state.supabase = fake.client;

    const response = await (await loadRoute())(post({ childId: CHILD }));

    expect(response.status).toBe(502);
    const updates = callsFor(fake.calls, "parent_reports", "update");
    expect(updates).toHaveLength(2);
    expect((updates[1].payload as Row).slack_sent_at).toBeNull();
  });
});
