import { beforeEach, describe, expect, it, vi } from "vitest";
import { callsFor, fakeSupabase, type QueryCall, type Row } from "@/tests/review/fakeSupabase";

const state = vi.hoisted(() => ({
  supabase: null as unknown,
  rateLimitAllowed: true,
}));

vi.mock("@/lib/utils/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/utils/api")>();
  return {
    ...original,
    requireUser: vi.fn(async () => ({ supabase: state.supabase, user: { id: "user-1" } })),
  };
});

vi.mock("@/lib/utils/rateLimit", () => ({
  checkRateLimit: () => true,
  checkRateLimitDb: vi.fn(async () => state.rateLimitAllowed),
}));

const post = (body: Row) =>
  new Request("http://localhost/api/children", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const input = { nickname: "はな", grade: 2, readingMode: "hiragana" };

const profileRows = (count: number): Row[] =>
  Array.from({ length: count }, (_, index) => ({ id: `child-${index}` }));

const tables = (existingCount: number) => ({
  child_profiles: (call: QueryCall) =>
    call.operation === "select"
      ? profileRows(existingCount)
      : [{ id: "child-new", ...(call.payload as Row) }],
  app_settings: () => [{ child_id: "child-new" }],
});

const loadRoute = async () => (await import("@/app/api/children/route")).POST;

describe("POST /api/children (rate limit + profile cap)", () => {
  beforeEach(() => {
    state.rateLimitAllowed = true;
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  });

  it("returns 429 when the DB rate limit rejects the call", async () => {
    state.rateLimitAllowed = false;
    const fake = fakeSupabase({ tables: tables(0) });
    state.supabase = fake.client;

    const response = await (await loadRoute())(post(input));

    expect(response.status).toBe(429);
    expect(callsFor(fake.calls, "child_profiles", "insert")).toHaveLength(0);
  });

  it("rejects the 9th profile with 400 (doc.md §14.2 cap of 8)", async () => {
    const fake = fakeSupabase({ tables: tables(8) });
    state.supabase = fake.client;

    const response = await (await loadRoute())(post(input));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Child profile limit reached");
    expect(callsFor(fake.calls, "child_profiles", "insert")).toHaveLength(0);
  });

  it("creates the profile when under the cap", async () => {
    const fake = fakeSupabase({ tables: tables(7) });
    state.supabase = fake.client;

    const response = await (await loadRoute())(post(input));

    expect(response.status).toBe(201);
    expect(callsFor(fake.calls, "child_profiles", "insert")).toHaveLength(1);
  });
});
