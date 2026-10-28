import { expect, test } from "@playwright/test";

test("えいごで おはなし: シーン一覧が開き、シーンを選べる", async ({ page }) => {
  const response = await page.goto("/child/english-talk");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "えいごで おはなし" })).toBeVisible();

  const cards = page.locator('a[href^="/child/english-talk/"]');
  expect(await cards.count()).toBeGreaterThanOrEqual(5);

  await cards.first().click();
  await expect(page).toHaveURL(/\/child\/english-talk\/[a-z-]+/);
  await expect(page.getByRole("button", { name: /おはなしを はじめる/ })).toBeVisible();
});

test("えいごで おはなし: はじめるを押すまで、えいごの音声は読み込まれない", async ({ page }) => {
  const ttsRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/ai/tts")) ttsRequests.push(request.url());
  });

  await page.goto("/child/english-talk/greeting");
  await expect(page.getByRole("button", { name: /おはなしを はじめる/ })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1_000);

  expect(ttsRequests).toEqual([]);
});

test("えいごで おはなし: 存在しないシーンは 404", async ({ page }) => {
  const response = await page.goto("/child/english-talk/no-such-scene");
  expect(response?.status()).toBe(404);
});
