import { describe, expect, it } from "vitest";

import {
  CHILD_MODE_COOKIE,
  childModeCookie,
  clearedChildModeCookie,
  isChildMode,
  isParentOnlyApi,
  isParentPage,
} from "@/lib/auth/childMode";

const cookies = (value?: string) => ({
  get: (name: string) => (name === CHILD_MODE_COOKIE && value !== undefined ? { value } : undefined),
});

describe("child mode cookie", () => {
  it("is detected only for kanoha_mode=child", () => {
    expect(isChildMode(cookies("child"))).toBe(true);
    expect(isChildMode(cookies("parent"))).toBe(false);
    expect(isChildMode(cookies(""))).toBe(false);
    expect(isChildMode(cookies())).toBe(false);
  });

  it("is httpOnly, lax, path=/, 24h, and secure only in production", () => {
    expect(childModeCookie(true)).toEqual({
      name: "kanoha_mode",
      value: "child",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: true,
      maxAge: 86_400,
    });
    expect(childModeCookie(false).secure).toBe(false);
    expect(clearedChildModeCookie(false)).toMatchObject({ name: "kanoha_mode", value: "", maxAge: 0 });
  });
});

describe("parent-only routing", () => {
  it.each(["/parent", "/parent/dashboard", "/parent/settings", "/parent/upload/x"])(
    "treats %s as a parent page",
    (path) => expect(isParentPage(path)).toBe(true),
  );

  it.each(["/child/home", "/parents", "/api/parent/pin", "/login"])(
    "does not treat %s as a parent page",
    (path) => expect(isParentPage(path)).toBe(false),
  );

  it.each([
    ["/api/children", "GET"],
    ["/api/children", "POST"],
    ["/api/children/123", "PATCH"],
    ["/api/materials", "GET"],
    ["/api/materials/upload", "POST"],
    ["/api/materials/1", "DELETE"],
    ["/api/ai/analyze-problem", "POST"],
    ["/api/settings/123", "GET"],
    ["/api/settings/123/slack", "POST"],
    ["/api/parent/pin", "POST"],
    ["/api/child-mode", "POST"],
  ])("blocks %s %s in child mode", (path, method) => {
    expect(isParentOnlyApi(path, method)).toBe(true);
  });

  it.each([
    ["/api/attempts", "POST"],
    ["/api/sessions", "POST"],
    ["/api/sessions", "GET"],
    ["/api/sessions/123", "PATCH"],
    ["/api/reviews/schedule", "POST"],
    ["/api/recommendations/today", "GET"],
    ["/api/ai/generate-hints", "POST"],
    ["/api/ai/generate-similar-problems", "POST"],
    ["/api/ai/generate-image", "POST"],
    ["/api/ai/recognize-handwriting", "POST"],
    ["/api/problems/123/hint", "POST"],
    ["/api/reports/slack", "POST"],
    ["/api/parent/pin/verify", "POST"],
    ["/api/child-mode", "DELETE"],
    ["/api/childrens-day", "GET"],
  ])("allows %s %s in child mode", (path, method) => {
    expect(isParentOnlyApi(path, method)).toBe(false);
  });
});
