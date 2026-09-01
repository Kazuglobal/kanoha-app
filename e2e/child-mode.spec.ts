import { expect, test } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:3107";
const CHILD_PAGES = ["/child/home", "/child/problem/volume-1", "/child/result?score=5&unit=かさ"];

test.describe("child mode (kanoha_mode=child cookie)", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{ name: "kanoha_mode", value: "child", url: BASE_URL }]);
  });

  test("redirects parent pages to the child home", async ({ page }) => {
    const response = await page.request.get("/parent/settings", { maxRedirects: 0 });
    expect(response.status()).toBe(302);
    expect(response.headers()["location"]).toContain("/child/home");

    await page.goto("/parent/dashboard");
    await expect(page).toHaveURL(/\/child\/home$/);
  });

  test("returns 403 JSON for parent-only APIs", async ({ page }) => {
    const response = await page.request.post("/api/children", {
      data: { nickname: "test", grade: 2, readingMode: "kanji_with_ruby" },
    });
    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(typeof body.error).toBe("string");

    const materials = await page.request.get("/api/materials");
    expect(materials.status()).toBe(403);
  });

  test("child pages contain no links to the parent area", async ({ page }) => {
    for (const path of CHILD_PAGES) {
      await page.goto(path);
      await expect(page.locator('a[href^="/parent"]')).toHaveCount(0);
      expect(await page.content()).not.toContain('href="/parent');
    }
  });

  test("the child cookie cannot be cleared without the PIN (no DELETE handler)", async ({ page }) => {
    const response = await page.request.delete("/api/child-mode");
    expect(response.status()).toBe(405);
    const again = await page.request.get("/parent/settings", { maxRedirects: 0 });
    expect(again.status()).toBe(302);
  });

  test("child-allowed APIs are still reachable", async ({ page }) => {
    const hint = await page.request.post("/api/problems/volume-1/hint", { data: { level: 1 } });
    expect(hint.status()).toBe(200);
  });
});

test.describe("without the child cookie", () => {
  test("parent pages are reachable", async ({ page }) => {
    const response = await page.request.get("/parent/settings", { maxRedirects: 0 });
    expect(response.status()).toBe(200);
  });

  test("child pages still have no links to the parent area", async ({ page }) => {
    await page.goto("/child/home");
    await expect(page.locator('a[href^="/parent"]')).toHaveCount(0);
  });
});
