import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { hashPin } from "@/lib/auth/pin";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const USER = "user-1";

const state = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
}));

vi.mock("@/lib/utils/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/utils/api")>();
  return {
    ...original,
    requireUser: vi.fn(async () => ({ db: getDb(), user: state.user })),
  };
});

const post = (path: string, body?: unknown, init: RequestInit = {}) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    ...init,
  });

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

  it("lets child-allowed APIs and pages through", async () => {
    const { proxy } = await import("@/proxy");
    for (const [path, method] of [["/api/attempts", "POST"], ["/api/parent/pin/verify", "POST"], ["/child/home", "GET"]]) {
      const response = await proxy(request(path, method, "kanoha_mode=child"));
      expect(response.status, `${method} ${path}`).toBe(200);
    }
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

describe("POST /api/child-mode", () => {
  const db = getDb();

  beforeEach(async () => {
    state.user = { id: USER };
    await db.delete(schema.users).where(eq(schema.users.id, USER)).run();
    await db.insert(schema.users).values({
      id: USER,
      name: "Parent",
      email: "parent@example.com",
      createdAt: new Date(),
      updatedAt: new Date(),
    }).run();
  });

  // 初回の動的 import(better-auth など)が重く、環境によっては既定の5秒を超えるため余裕を持たせる
  it("sets the httpOnly child cookie when a PIN exists", { timeout: 30_000 }, async () => {
    await db.update(schema.users)
      .set({ parentPinHash: "scrypt$a$b" })
      .where(eq(schema.users.id, USER))
      .run();

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
    const { POST } = await import("@/app/api/child-mode/route");
    expect((await POST()).status).toBe(409);
    state.user = null;
    expect((await POST()).status).toBe(401);
  });

  it("has no DELETE handler: the cookie can only be cleared by PIN verification (S1)", async () => {
    const route = await import("@/app/api/child-mode/route");
    expect("DELETE" in route).toBe(false);
  });
});

describe("POST /api/parent/pin", () => {
  const db = getDb();

  beforeEach(async () => {
    state.user = { id: USER };
    await db.delete(schema.users).where(eq(schema.users.id, USER)).run();
    await db.insert(schema.users).values({
      id: USER,
      name: "Parent",
      email: "parent@example.com",
      createdAt: new Date(),
      updatedAt: new Date(),
    }).run();
  });

  it("stores a scrypt hash through the admin client and never returns it", async () => {
    const { POST } = await import("@/app/api/parent/pin/route");
    const response = await POST(post("/api/parent/pin", { pin: "1234" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, data: { pinSet: true } });

    const user = await db.select().from(schema.users).where(eq(schema.users.id, USER)).get();
    expect(user?.parentPinFailedAttempts).toBe(0);
    expect(user?.parentPinLockedUntil).toBeNull();
    expect(String(user?.parentPinHash)).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(JSON.stringify(body)).not.toContain("scrypt");
  });

  it.each([{ pin: "12" }, { pin: "abcd" }, { pin: "1234", extra: 1 }, {}])("rejects %j", async (payload) => {
    const { POST } = await import("@/app/api/parent/pin/route");
    expect((await POST(post("/api/parent/pin", payload))).status).toBe(400);
  });
});

describe("POST /api/parent/pin/verify", () => {
  const db = getDb();

  beforeEach(async () => {
    state.user = { id: USER };
    await db.delete(schema.users).where(eq(schema.users.id, USER)).run();
    await db.insert(schema.users).values({
      id: USER,
      name: "Parent",
      email: "parent@example.com",
      createdAt: new Date(),
      updatedAt: new Date(),
    }).run();
  });

  it("clears the child cookie and resets the counter on the right PIN", async () => {
    const hash = await hashPin("1234");
    await db.update(schema.users)
      .set({ parentPinHash: hash, parentPinFailedAttempts: 3 })
      .where(eq(schema.users.id, USER))
      .run();

    const { POST } = await import("@/app/api/parent/pin/verify/route");
    const response = await POST(post("/api/parent/pin/verify", { pin: "1234" }));

    expect(response.status).toBe(200);
    expect(setCookieOf(response)).toMatch(/kanoha_mode=;.*Max-Age=0/);

    const user = await db.select().from(schema.users).where(eq(schema.users.id, USER)).get();
    expect(user?.parentPinFailedAttempts).toBe(0);
    expect(user?.parentPinLockedUntil).toBeNull();
    expect(JSON.stringify(await response.json())).not.toContain("scrypt");
  });

  it("counts a wrong PIN and keeps the cookie", async () => {
    const hash = await hashPin("1234");
    await db.update(schema.users)
      .set({ parentPinHash: hash, parentPinFailedAttempts: 1 })
      .where(eq(schema.users.id, USER))
      .run();

    const { POST } = await import("@/app/api/parent/pin/verify/route");
    const response = await POST(post("/api/parent/pin/verify", { pin: "9999" }));

    expect(response.status).toBe(401);
    expect(setCookieOf(response)).toBe("");

    const user = await db.select().from(schema.users).where(eq(schema.users.id, USER)).get();
    expect(user?.parentPinFailedAttempts).toBe(2);
    expect(user?.parentPinLockedUntil).toBeNull();
  });

  it("locks for 5 minutes on the 5th failure", async () => {
    const hash = await hashPin("1234");
    await db.update(schema.users)
      .set({ parentPinHash: hash, parentPinFailedAttempts: 4 })
      .where(eq(schema.users.id, USER))
      .run();

    const { POST } = await import("@/app/api/parent/pin/verify/route");
    const before = Date.now();
    const response = await POST(post("/api/parent/pin/verify", { pin: "9999" }));

    expect(response.status).toBe(423);

    const user = await db.select().from(schema.users).where(eq(schema.users.id, USER)).get();
    expect(user?.parentPinFailedAttempts).toBe(0);
    const lockedUntil = new Date(String(user?.parentPinLockedUntil)).getTime();
    expect(lockedUntil - before).toBeGreaterThanOrEqual(5 * 60_000 - 50);
    expect(lockedUntil - before).toBeLessThanOrEqual(5 * 60_000 + 5_000);
  });

  it("refuses even the right PIN while locked, without touching the row", async () => {
    const hash = await hashPin("1234");
    const lockedUntil = new Date(Date.now() + 60_000).toISOString();
    await db.update(schema.users)
      .set({ parentPinHash: hash, parentPinLockedUntil: lockedUntil })
      .where(eq(schema.users.id, USER))
      .run();

    const { POST } = await import("@/app/api/parent/pin/verify/route");
    const response = await POST(post("/api/parent/pin/verify", { pin: "1234" }));

    expect(response.status).toBe(423);
    expect(setCookieOf(response)).toBe("");
  });

  it("returns 409 when no PIN is set and 401 without a session", async () => {
    const { POST } = await import("@/app/api/parent/pin/verify/route");
    expect((await POST(post("/api/parent/pin/verify", { pin: "1234" }))).status).toBe(409);
    state.user = null;
    expect((await POST(post("/api/parent/pin/verify", { pin: "1234" }))).status).toBe(401);
  });
});
