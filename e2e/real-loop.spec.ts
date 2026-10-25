import { expect, test, type Page } from "@playwright/test";

/**
 * ログインした親の実データで v0.1 ループを一周する E2E(better-auth + D1)。
 * ローカル/テストのサーバーは in-memory D1 にマイグレーションを流して起動するので、
 * 親アカウントは毎回この中で作る(外部サービスもシードも不要。AI はモック)。
 *
 * 親登録 → 子ども作成 → PIN → 子どもモード(親画面は遮断)
 * → ステージマップの問題を学習(ヒント段階開示 → 類題5問 → 結果)
 * → PIN 解除 → 親ダッシュボードに今日の学習が載る
 */

const PIN = "4321";

// せいかいが たまると出る「レベルアップ」モーダルは、出たら閉じて学習を続ける。
test.beforeEach(async ({ page }) => {
  await page.addLocatorHandler(page.getByRole("button", { name: "べんきょうを つづける" }), async (button) => {
    await button.click();
  });
});

const signUpParent = async (page: Page) => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const response = await page.request.post("/api/auth/sign-up/email", {
    data: { email: `e2e-${stamp}@example.com`, password: `pw-${stamp}-long`, name: "e2e" },
  });
  expect(response.ok(), await response.text()).toBe(true);
};

const createChild = async (page: Page): Promise<string> => {
  const response = await page.request.post("/api/children", {
    data: { nickname: "テスト", grade: 2 },
  });
  expect(response.ok(), await response.text()).toBe(true);
  const body = (await response.json()) as { data: { id: string } };
  return body.data.id;
};

const answerPracticeSet = async (page: Page) => {
  await page.getByRole("button", { name: "れんしゅう 5もんへ" }).click();
  for (let index = 0; index < 5; index += 1) {
    await expect(page.getByText(`れんしゅう ${index + 1} / 5`)).toBeVisible();
    const choice = page.locator('[class*="choiceGrid"] button').first();
    if (await choice.isVisible().catch(() => false)) {
      await choice.click();
    } else {
      await page.getByRole("textbox", { name: "こたえ" }).fill("1");
      await page.getByRole("button", { name: "こたえる", exact: true }).click();
    }
    await page.getByRole("button", { name: /つぎの もんだい|けっかを みる/ }).click();
  }
};

test("parent sign-up → child mode → learning loop is recorded → PIN unlock", async ({ page }) => {
  await signUpParent(page);
  const childId = await createChild(page);
  expect((await page.request.post("/api/parent/pin", { data: { pin: PIN } })).ok()).toBe(true);
  expect((await page.request.post("/api/child-mode")).ok()).toBe(true);

  // 子どもモードでは親画面・親専用 API に入れない(A1)
  const blocked = await page.request.get("/parent/settings", { maxRedirects: 0 });
  expect(blocked.status()).toBe(302);

  // ホーム → きょうの おすすめ(ステージマップの問題を子どもの problems 行として学習)
  await page.goto(`/child/home?childId=${childId}`);
  await page.getByRole("link", { name: /きょうの おすすめを はじめる/ }).click();
  await expect(page).toHaveURL(new RegExp(`childId=${childId}`));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // ヒントは押したぶんだけ、1段ずつ(学習セッションの準備中は「まってね」になるので押し直す)
  const hintCards = page.getByRole("region", { name: "だんかいヒント" }).locator("article");
  await expect(async () => {
    await page.getByRole("button", { name: "ヒントを みる" }).click();
    await expect(hintCards).toHaveCount(1, { timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await page.getByRole("button", { name: /つぎの ヒント 2/ }).click();
  await expect(hintCards).toHaveCount(2);
  // れんしゅうは、こたえまで見る(または正解する)と出てくる
  await page.getByRole("button", { name: /つぎの ときかた/ }).click();
  await expect(hintCards).toHaveCount(3);
  await page.getByRole("button", { name: /つぎの こたえ/ }).click();
  await expect(hintCards).toHaveCount(4);

  await answerPracticeSet(page);
  await page.getByRole("link", { name: "きょうの けっかへ" }).click();
  await expect(page.getByText(/\d\/5/)).toBeVisible();

  // PIN で親に戻ると、今日の学習がダッシュボードに出る
  // (読み込み直後〔ハイドレーション前〕に押すとポップオーバーが閉じることがあるので、閉じたら開き直す)
  await expect(async () => {
    const pin = page.getByRole("textbox", { name: "PIN" });
    if (!(await pin.isVisible())) await page.getByRole("button", { name: "おうちのかた" }).click();
    await pin.fill(PIN, { timeout: 2_000 });
    await page.getByRole("button", { name: "かいじょ" }).click({ timeout: 2_000 });
    await page.waitForURL(/\/parent\/dashboard/, { timeout: 5_000 });
  }).toPass({ timeout: 30_000 });
  await page.goto(`/parent/dashboard?childId=${childId}`);
  // 類題5問の回答が「今日やった問題」に記録されている
  const todayCount = page.getByRole("heading", { name: "1. 今日やった問題" }).locator("xpath=following-sibling::strong[1]");
  await expect(todayCount).toHaveText(/^[1-9]\d*問$/);
});
