import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { hashPin } from "@/lib/auth/pin";
import { fakeSupabase, type QueryCall, type Row } from "@/tests/review/fakeSupabase";

const USER = "user-1";

const state = vi.hoisted(() => ({
  admin: null as unknown,
  user: { id: "user-1" } as { id: string } | null,
}));

vi.mock("@/lib/utils/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/utils/api")>();
  return {
    ...original,
    requireUser: vi.fn(async () => ({ supabase: null, user: state.user })),
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => state.admin,
}));

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: vi.fn(async () => new Response("session", { status: 200 })),
}));

const post = (path: string, body?: Row, init: RequestInit = {}) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    ...init,
  });

const usersTable = (row: Row) => (call: QueryCall) => (call.operation === "select" ? [row] : [call.payload as Row]);

const setCookieOf = (response: Response) => response.headers.get("set-cookie") ?? "";

describe("proxy: child mode gating runs before session refresh", () => {
  const request = (path: string, method = "GET", cookie?: string) =>
    new NextRequest(`http://localhost:3000${path}`, {
      method,
      headers: cookie ? { cookie } : {},
    });

  it("redirects /parent/* to /child/home with the child cookie", async () => {
    const { proxy } = await import("@/proxy");
    const response = await proxy(request("/parent/settings?tab=pin", "GET", "kanoha_mode=child"));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("http://localhost:3000/child/home");
  });

  it("returns 403 JSON for parent-only APIs with the child cookie", async () => {
    const { proxy } = await import("@/proxy");
    const response = await proxy(request("/api/children", "POST", "kanoha_mode=child"));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ success: false, error: "Not available in child mode" });
  });

  it("lets child-allowed APIs and pages through to the session refresh", async () => {
    const { proxy } = await import("@/proxy");
    const { updateSession } = await import("@/lib/supabase/middleware");
    for (const [path, method] of [["/api/attempts", "POST"], ["/api/parent/pin/verify", "POST"], ["/child/home", "GET"], ["/api/child-mode", "DELETE"]]) {
      const response = await proxy(request(path, method, "kanoha_mode=child"));
      expect(response.status, `${method} ${path}`).toBe(200);
    }
    expect(updateSession).toHaveBeenCalled();
  });

  it("does not gate anything without the cookie", async () => {
    const { proxy } = await import("@/proxy");
    expect((await proxy(request("/parent/settings"))).status).toBe(200);
    expect((await proxy(request("/api/children", "POST"))).status).toBe(200);
  });

  it("still rejects cross-origin mutations", async () => {
    const { proxy } = await import("@/proxy");
    const response = await proxy(new NextRequest("http://localhost:3000/api/attempts", {
      method: "POST",
      headers: { origin: "http://evil.example", host: "localhost:3000" },
    }));
    expect(response.status).toBe(403);
  });

  it("compares the Origin against the Host header, not the normalized URL (127.0.0.1 under next start)", async () => {
    const { proxy } = await import("@/proxy");
    const response = await proxy(new NextRequest("http://localhost:3107/api/problems/volume-1/hint", {
      method: "POST",
      headers: { origin: "http://127.0.0.1:3107", host: "127.0.0.1:3107" },
    }));
    expect(response.status).toBe(200);
  });

  it("rejects an unparseable Origin on mutations", async () => {
    const { proxy } = await import("@/proxy");
    const response = await proxy(new NextRequest("http://localhost:3000/api/attempts", {
      method: "POST",
      headers: { origin: "not a url", host: "localhost:3000" },
    }));
    expect(response.status).toBe(403);
  });
});

describe("POST/DELETE /api/child-mode", () => {
  beforeEach(() => {
    state.user = { id: USER };
  });

  it("sets the httpOnly child cookie when a PIN exists", async () => {
    state.admin = fakeSupabase({ tables: { users: usersTable({ parent_pin_hash: "scrypt$a$b" }) } }).client;
    const { POST } = await import("@/app/api/child-mode/route");
    const response = await POST();
    expect(response.status).toBe(200);
    const cookie = setCookieOf(response);
    expect(cookie).toContain("kanoha_mode=child");
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toContain("Max-Age=86400");
    expect(cookie).toContain("Path=/");
  });

  it("refuses to start child mode without a PIN (409) or a session (401)", async () => {
    state.admin = fakeSupabase({ tables: { users: usersTable({ parent_pin_hash: null }) } }).client;
    const { POST } = await import("@/app/api/child-mode/route");
    expect((await POST()).status).toBe(409);
    state.user = null;
    expect((await POST()).status).toBe(401);
  });

  it("DELETE clears the cookie", async () => {
    const { DELETE } = await import("@/app/api/child-mode/route");
    const response = await DELETE();
    expect(response.status).toBe(200);
    expect(setCookieOf(response)).toMatch(/kanoha_mode=;.*Max-Age=0/);
  });
});

describe("POST /api/parent/pin", () => {
  beforeEach(() => {
    state.user = { id: USER };
  });

  it("stores a scrypt hash through the admin client and never returns it", async () => {
    const fake = fakeSupabase({ tables: { users: () => [] } });
    state.admin = fake.client;
    const { POST } = await import("@/app/api/parent/pin/route");
    const response = await POST(post("/api/parent/pin", { pin: "1234" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, data: { pinSet: true } });
    const update = fake.calls.find((call) => call.table === "users" && call.operation === "update")!;
    expect(update.payload).toMatchObject({ parent_pin_failed_attempts: 0, parent_pin_locked_until: null });
    expect(String((update.payload as Row).parent_pin_hash)).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(update.filters).toEqual([{ op: "eq", column: "id", value: USER }]);
    expect(JSON.stringify(body)).not.toContain("scrypt");
  });

  it.each([{ pin: "12" }, { pin: "abcd" }, { pin: "1234", extra: 1 }, {}])("rejects %j", async (payload) => {
    const { POST } = await import("@/app/api/parent/pin/route");
    expect((await POST(post("/api/parent/pin", payload))).status).toBe(400);
  });
});

describe("POST /api/parent/pin/verify", () => {
  beforeEach(() => {
    state.user = { id: USER };
  });

  const pinRow = async (overrides: Row = {}) => ({
    parent_pin_hash: await hashPin("1234"),
    parent_pin_failed_attempts: 0,
    parent_pin_locked_until: null,
    ...overrides,
  });

  it("clears the child cookie and resets the counter on the right PIN", async () => {
    const fake = fakeSupabase({ tables: { users: usersTable(await pinRow({ parent_pin_failed_attempts: 3 })) } });
    state.admin = fake.client;
    const { POST } = await import("@/app/api/parent/pin/verify/route");
    const response = await POST(post("/api/parent/pin/verify", { pin: "1234" }));

    expect(response.status).toBe(200);
    expect(setCookieOf(response)).toMatch(/kanoha_mode=;.*Max-Age=0/);
    const update = fake.calls.find((call) => call.operation === "update")!;
    expect(update.payload).toEqual({ parent_pin_failed_attempts: 0, parent_pin_locked_until: null });
    expect(JSON.stringify(await response.json())).not.toContain("scrypt");
  });

  it("counts a wrong PIN and keeps the cookie", async () => {
    const fake = fakeSupabase({ tables: { users: usersTable(await pinRow({ parent_pin_failed_attempts: 1 })) } });
    state.admin = fake.client;
    const { POST } = await import("@/app/api/parent/pin/verify/route");
    const response = await POST(post("/api/parent/pin/verify", { pin: "9999" }));

    expect(response.status).toBe(401);
    expect(setCookieOf(response)).toBe("");
    const update = fake.calls.find((call) => call.operation === "update")!;
    expect(update.payload).toEqual({ parent_pin_failed_attempts: 2, parent_pin_locked_until: null });
  });

  it("locks for 5 minutes on the 5th failure", async () => {
    const fake = fakeSupabase({ tables: { users: usersTable(await pinRow({ parent_pin_failed_attempts: 4 })) } });
    state.admin = fake.client;
    const { POST } = await import("@/app/api/parent/pin/verify/route");
    const before = Date.now();
    const response = await POST(post("/api/parent/pin/verify", { pin: "9999" }));

    expect(response.status).toBe(423);
    const update = fake.calls.find((call) => call.operation === "update")!.payload as Row;
    expect(update.parent_pin_failed_attempts).toBe(0);
    const lockedUntil = new Date(String(update.parent_pin_locked_until)).getTime();
    expect(lockedUntil - before).toBeGreaterThanOrEqual(5 * 60_000 - 50);
    expect(lockedUntil - before).toBeLessThanOrEqual(5 * 60_000 + 5_000);
  });

  it("refuses even the right PIN while locked, without touching the row", async () => {
    const lockedUntil = new Date(Date.now() + 60_000).toISOString();
    const fake = fakeSupabase({ tables: { users: usersTable(await pinRow({ parent_pin_locked_until: lockedUntil })) } });
    state.admin = fake.client;
    const { POST } = await import("@/app/api/parent/pin/verify/route");
    const response = await POST(post("/api/parent/pin/verify", { pin: "1234" }));

    expect(response.status).toBe(423);
    expect(fake.calls.filter((call) => call.operation === "update")).toHaveLength(0);
    expect(setCookieOf(response)).toBe("");
  });

  it("returns 409 when no PIN is set and 401 without a session", async () => {
    state.admin = fakeSupabase({ tables: { users: usersTable({ parent_pin_hash: null }) } }).client;
    const { POST } = await import("@/app/api/parent/pin/verify/route");
    expect((await POST(post("/api/parent/pin/verify", { pin: "1234" }))).status).toBe(409);
    state.user = null;
    expect((await POST(post("/api/parent/pin/verify", { pin: "1234" }))).status).toBe(401);
  });
});
