import { expect, test } from "@playwright/test";

/**
 * 実 Supabase(シード済み親アカウント)で v0.1 ループを一周する E2E。
 * W6 では環境変数が無いためスキップされる(環境ゲート・W7 で有効化する承認済み例外)。
 *
 * 必要な環境変数:
 * - NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY(サーバー起動用)
 * - E2E_PARENT_EMAIL / E2E_PARENT_PASSWORD(シード済み親アカウント)
 * - E2E_PARENT_PIN(任意。省略時 4321)
 * 前提データ: 親に子どもプロフィール1件と解析済み問題が最低1問シードされていること。
 */
test.skip(!process.env.NEXT_PUBLIC_SUPABASE_URL, "requires real Supabase");
test.skip(
  !process.env.E2E_PARENT_EMAIL || !process.env.E2E_PARENT_PASSWORD,
  "requires seeded parent credentials",
);

const PIN = process.env.E2E_PARENT_PIN ?? "4321";

test("parent login → PIN → child mode → full learning loop → PIN unlock", async ({ page }) => {
  // 親ログイン(UI 経由)
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(process.env.E2E_PARENT_EMAIL ?? "");
  await page.locator('input[type="password"]').fill(process.env.E2E_PARENT_PASSWORD ?? "");
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/\/parent\//);

  // PIN 設定と子どもモード切替(API。UI 導線は W7 で置き換え可)
  const pinResponse = await page.request.post("/api/parent/pin", { data: { pin: PIN } });
  expect(pinResponse.ok()).toBe(true);
  const childMode = await page.request.post("/api/child-mode");
  expect(childMode.ok()).toBe(true);

  // 子どもモードでは親画面に入れない
  const blocked = await page.request.get("/parent/settings", { maxRedirects: 0 });
  expect(blocked.status()).toBe(302);

  // 今日のおすすめ → ヒント → 類題5問 → 結果
  await page.goto("/child/home");
  await page.getByRole("link", { name: /きょうの おすすめを はじめる/ }).click();
  await page.getByRole("button", { name: "ヒントを みる" }).click();
  // 答えのヒントまで見ると、れんしゅうへ すすめる
  for (const next of [/つぎの ヒント 2/, /つぎの ときかた/, /つぎの こたえ/]) {
    await page.getByRole("button", { name: next }).click();
  }
  await page.getByRole("button", { name: "れんしゅう 5もんへ" }).click();
  for (let index = 0; index < 5; index += 1) {
    const choice = page.locator('[class*="choiceGrid"] button').first();
    if (await choice.isVisible().catch(() => false)) {
      await choice.click();
    } else {
      await page.getByLabel("こたえ").fill("1");
      await page.getByRole("button", { name: "こたえる" }).click();
    }
    await page.getByRole("button", { name: /つぎの もんだい|けっかを みる/ }).click();
  }
  await page.getByRole("link", { name: "きょうの けっかへ" }).click();
  await expect(page.getByText(/\/5/)).toBeVisible();

  // PIN 解除で親に戻る
  await page.getByRole("button", { name: "おうちのかた" }).click();
  await page.getByLabel("PIN").fill(PIN);
  await page.getByRole("button", { name: "かいじょ" }).click();
  await page.waitForURL(/\/parent\/dashboard/);
});
