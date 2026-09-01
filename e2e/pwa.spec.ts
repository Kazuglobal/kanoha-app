import { expect, test } from "@playwright/test";

test("provides installable PWA assets and registers the service worker", async ({ page, request }) => {
  const manifestResponse = await request.get("/manifest.json");
  const manifest = await manifestResponse.json();
  expect(manifest.start_url).toBe("/child/home");
  expect(manifest.icons).toHaveLength(2);

  const workerResponse = await request.get("/sw.js");
  expect(workerResponse.headers()["cache-control"]).toContain("no-cache");
  expect(workerResponse.headers()["content-security-policy"]).toBe("default-src 'self'; script-src 'self'");

  await page.goto("/child/home");
  await expect.poll(() => page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.active?.scriptURL.endsWith("/sw.js");
  })).toBe(true);

  await page.goto("/offline");
  await expect(page.getByRole("heading", { name: "オフラインです" })).toBeVisible();
});
