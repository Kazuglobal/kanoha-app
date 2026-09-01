import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { callsFor, fakeSupabase, filterValue, type QueryCall, type Row } from "@/tests/review/fakeSupabase";

const CHILD = "11111111-1111-4111-8111-111111111111";
const SESSION = "22222222-2222-4222-8222-222222222222";
const PROBLEM = "33333333-3333-4333-8333-333333333333";

const problemRow: Row = {
  id: PROBLEM,
  child_id: CHILD,
  problem_text: "1L は なんmL ですか？",
  correct_answer: "1000mL",
  unit: "水のかさ",
  sub_unit: "LとmL",
  explanation_json: { hint1: "h1", hint2: "h2", solution: "s", answer: "1000mL", praise: "p" },
};

const state = vi.hoisted(() => ({ supabase: null as unknown }));

vi.mock("@/lib/utils/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/utils/api")>();
  return {
    ...original,
    requireOwnedChild: vi.fn(async () => ({ supabase: state.supabase, user: { id: "user-1" }, response: null })),
  };
});

const post = (path: string, body: Row, cookie?: string) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });

const context = (id: string) => ({ params: Promise.resolve({ id }) });

const tables = (maxLevel: number | null) => ({
  problems: () => [problemRow],
  learning_sessions: () => [{ id: SESSION }],
  problem_hint_views: (call: QueryCall) => (call.operation === "select"
    ? (maxLevel === null ? [] : [{ max_level: maxLevel }])
    : [call.payload as Row]),
});

describe("POST /api/problems/[id]/hint (staged reveal)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("returns only hint 1 the first time and records max_level=1", async () => {
    const fake = fakeSupabase({ tables: tables(null) });
    state.supabase = fake.client;
    const { POST } = await import("@/app/api/problems/[id]/hint/route");

    const response = await POST(post(`/api/problems/${PROBLEM}/hint`, { childId: CHILD, sessionId: SESSION, level: 1 }), context(PROBLEM));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ level: 1, label: "ヒント 1", text: "h1", maxLevel: 1 });
    expect(JSON.stringify(body)).not.toContain("1000mL");
    expect(JSON.stringify(body)).not.toContain("h2");
    const upsert = callsFor(fake.calls, "problem_hint_views", "upsert")[0];
    expect(upsert.payload).toEqual({ child_id: CHILD, problem_id: PROBLEM, session_id: SESSION, max_level: 1 });
    expect(upsert.options).toEqual({ onConflict: "child_id,problem_id,session_id" });
    const lookup = callsFor(fake.calls, "problem_hint_views", "select")[0];
    expect(filterValue(lookup, "session_id")).toBe(SESSION);
  });

  it("refuses to skip ahead (level 3 when only level 1 is open) and records nothing", async () => {
    const fake = fakeSupabase({ tables: tables(1) });
    state.supabase = fake.client;
    const { POST } = await import("@/app/api/problems/[id]/hint/route");

    const response = await POST(post(`/api/problems/${PROBLEM}/hint`, { childId: CHILD, sessionId: SESSION, level: 3 }), context(PROBLEM));

    expect(response.status).toBe(400);
    expect(callsFor(fake.calls, "problem_hint_views", "upsert")).toHaveLength(0);
    expect(JSON.stringify(await response.json())).not.toContain("1000mL");
  });

  it("returns the answer only at level 4 after level 3 is open", async () => {
    const fake = fakeSupabase({ tables: tables(3) });
    state.supabase = fake.client;
    const { POST } = await import("@/app/api/problems/[id]/hint/route");

    const response = await POST(post(`/api/problems/${PROBLEM}/hint`, { childId: CHILD, sessionId: SESSION, level: 4 }), context(PROBLEM));
    const body = await response.json();

    expect(body.data).toEqual({ level: 4, label: "こたえ", text: "1000mL", maxLevel: 4 });
    expect(callsFor(fake.calls, "problem_hint_views", "upsert")[0].payload).toMatchObject({ max_level: 4 });
  });

  it("re-reading an already open level does not lower max_level", async () => {
    const fake = fakeSupabase({ tables: tables(3) });
    state.supabase = fake.client;
    const { POST } = await import("@/app/api/problems/[id]/hint/route");

    const body = await (await POST(post(`/api/problems/${PROBLEM}/hint`, { childId: CHILD, sessionId: SESSION, level: 2 }), context(PROBLEM))).json();

    expect(body.data).toMatchObject({ level: 2, text: "h2", maxLevel: 3 });
    expect(callsFor(fake.calls, "problem_hint_views", "upsert")[0].payload).toMatchObject({ max_level: 3 });
  });

  it("falls back to the correct_answer column when explanation_json has no answer", async () => {
    const fake = fakeSupabase({
      tables: { ...tables(3), problems: () => [{ ...problemRow, explanation_json: {} }] },
    });
    state.supabase = fake.client;
    const { POST } = await import("@/app/api/problems/[id]/hint/route");

    const body = await (await POST(post(`/api/problems/${PROBLEM}/hint`, { childId: CHILD, sessionId: SESSION, level: 4 }), context(PROBLEM))).json();
    expect(body.data.text).toBe("1000mL");
  });

  it.each([
    [{ childId: CHILD, sessionId: SESSION, level: 0 }],
    [{ childId: CHILD, sessionId: SESSION, level: 5 }],
    [{ childId: CHILD, level: 1 }],
    [{ childId: CHILD, sessionId: SESSION, level: "1" }],
  ])("rejects invalid input %j", async (payload) => {
    state.supabase = fakeSupabase({ tables: tables(0) }).client;
    const { POST } = await import("@/app/api/problems/[id]/hint/route");
    expect((await POST(post(`/api/problems/${PROBLEM}/hint`, payload), context(PROBLEM))).status).toBe(400);
  });

  it("returns 404 for a session or problem the child does not own", async () => {
    state.supabase = fakeSupabase({ tables: { ...tables(0), learning_sessions: () => [] } }).client;
    const { POST } = await import("@/app/api/problems/[id]/hint/route");
    expect((await POST(post(`/api/problems/${PROBLEM}/hint`, { childId: CHILD, sessionId: SESSION, level: 1 }), context(PROBLEM))).status).toBe(404);
    expect((await POST(post("/api/problems/not-a-uuid/hint", { childId: CHILD, sessionId: SESSION, level: 1 }), context("not-a-uuid"))).status).toBe(404);
  });
});

describe("POST /api/problems/[id]/hint (demo without Supabase)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("serves the mock problem one level at a time and tracks the level in a cookie", async () => {
    const { POST } = await import("@/app/api/problems/[id]/hint/route");
    const first = await POST(post("/api/problems/volume-1/hint", { level: 1 }), context("volume-1"));
    const firstBody = await first.json();

    expect(first.status).toBe(200);
    expect(firstBody.data).toMatchObject({ level: 1, text: "1Lの中には、100mLがいくつあるかな。", maxLevel: 1 });
    expect(JSON.stringify(firstBody)).not.toContain("1000mL");
    expect(first.headers.get("set-cookie")).toContain("kanoha_demo_hint=volume-1%3A1");

    const skip = await POST(post("/api/problems/volume-1/hint", { level: 3 }, "kanoha_demo_hint=volume-1%3A1"), context("volume-1"));
    expect(skip.status).toBe(400);

    const answer = await POST(post("/api/problems/volume-1/hint", { level: 4 }, "kanoha_demo_hint=volume-1%3A3"), context("volume-1"));
    expect((await answer.json()).data).toMatchObject({ level: 4, text: "1000mL" });
  });

  it("returns 404 for unknown demo ids", async () => {
    const { POST } = await import("@/app/api/problems/[id]/hint/route");
    expect((await POST(post("/api/problems/other/hint", { level: 1 }), context("other"))).status).toBe(404);
  });
});
