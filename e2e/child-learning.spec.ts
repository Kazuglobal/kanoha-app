import { expect, test, type Page } from "@playwright/test";

/** デモ問題(lib/ai/mock.ts)のヒント。漢字を含まない部分だけを見る(ルビ変換の影響を受けない)。 */
const HINT_1 = "いくつあるかな";
const HINT_2 = "100mLが10こで1Lだよ";
const SOLUTION = "100を10こあわせます";
const ANSWER = "1000mL";

const expectHidden = async (page: Page, ...texts: string[]) => {
  const html = await page.content();
  for (const text of texts) {
    expect(html, `${text} must not be in the page`).not.toContain(text);
  }
};

// せいかいが たまると出る「レベルアップ」モーダルは、出たら閉じて学習を続ける。
test.beforeEach(async ({ page }) => {
  await page.addLocatorHandler(page.getByRole("button", { name: "べんきょうを つづける" }), async (button) => {
    await button.click();
  });
});

test("child completes the learning loop with server-side staged answer reveal", async ({ page }) => {
  await page.goto("/child/home");
  await page.getByRole("link", { name: /きょうの おすすめを はじめる/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("mLですか");

  // 初期表示: 答えもヒントも HTML に含まれない。
  await expectHidden(page, ANSWER, HINT_1, HINT_2, SOLUTION);

  await page.getByRole("button", { name: "ヒントを みる" }).click();
  await expect(page.getByText(HINT_1)).toBeVisible();
  await expectHidden(page, ANSWER, HINT_2, SOLUTION);

  await page.getByRole("button", { name: /つぎの ヒント 2/ }).click();
  await expect(page.getByText(HINT_2)).toBeVisible();
  await expectHidden(page, ANSWER, SOLUTION);

  await page.getByRole("button", { name: /つぎの ときかた/ }).click();
  await expect(page.getByText(SOLUTION)).toBeVisible();
  await expectHidden(page, ANSWER);

  await page.getByRole("button", { name: /つぎの こたえ/ }).click();
  await expect(page.getByText(ANSWER, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "れんしゅう 5もんへ" }).click();
  for (const answer of ["2000mL", "3L", "1500mL", "4000mL", "5L"]) {
    const choices = page.getByRole("button", { name: /^\d+m?L$/ });
    await expect(choices).toHaveCount(4);
    const labels = await choices.allTextContents();
    expect(new Set(labels).size).toBe(4);
    await page.getByRole("button", { name: answer, exact: true }).click();
    await expect(page.getByText(/せいかい/)).toBeVisible();
    await page.getByRole("button", { name: /つぎの もんだい|けっかを みる/ }).click();
  }
  await expect(page.getByText("できた！", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "きょうの けっかへ" }).click();
  await expect(page.getByRole("heading", { name: "かさ、できた！" })).toBeVisible();
  await expect(page.getByText("かさ マスター！")).toBeVisible();
});

test("the hint API refuses to skip levels", async ({ page }) => {
  const skipped = await page.request.post("/api/problems/volume-1/hint", { data: { level: 3 } });
  expect(skipped.status()).toBe(400);
  expect(JSON.stringify(await skipped.json())).not.toContain(ANSWER);

  const first = await page.request.post("/api/problems/volume-1/hint", { data: { level: 1 } });
  expect(first.status()).toBe(200);
  const body = await first.json();
  expect(body.data.level).toBe(1);
  expect(JSON.stringify(body)).not.toContain(ANSWER);
});

test("ruby is rendered and えで おしえて appears only after two hints", async ({ page }) => {
  await page.goto("/child/problem/volume-1");
  await expect(page.getByRole("button", { name: "えで おしえて" })).toHaveCount(0);

  await page.getByRole("button", { name: "ヒントを みる" }).click();
  await expect(page.getByText(HINT_1)).toBeVisible();
  // ヒント1「1Lの中には…」の 中 にルビが付く。
  expect(await page.locator("ruby").count()).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "えで おしえて" })).toHaveCount(0);

  await page.getByRole("button", { name: /つぎの ヒント 2/ }).click();
  await expect(page.getByText(HINT_2)).toBeVisible();
  await page.getByRole("button", { name: "えで おしえて" }).click();
  await expect(page.getByRole("img", { name: "もんだいの えヒント" })).toHaveAttribute(
    "src",
    "/visuals/volume.svg",
  );
});

test("もういちど やる resets the practice flow (doc §6.1)", async ({ page }) => {
  await page.goto("/child/problem/volume-1");
  // れんしゅうは、元の問題に正解してから(または答えのヒントまで見てから)出る
  await expect(page.getByRole("button", { name: "れんしゅう 5もんへ" })).toHaveCount(0);
  await page.getByLabel("こたえ").fill("1000");
  await page.getByRole("button", { name: "こたえる", exact: true }).click();
  await page.getByRole("button", { name: "れんしゅう 5もんへ" }).click();
  for (const answer of ["2000mL", "3L", "1500mL", "4000mL", "5L"]) {
    await page.getByRole("button", { name: answer, exact: true }).click();
    await page.getByRole("button", { name: /つぎの もんだい|けっかを みる/ }).click();
  }
  await expect(page.getByText("できた！", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "もういちど やる" }).click();
  await expect(page.getByRole("button", { name: "ヒントを みる" })).toBeVisible();
  await expectHidden(page, ANSWER, HINT_1, HINT_2, SOLUTION);

  // けっか画面からも「もういちど やる」で同じ問題に戻れる。
  await page.goto("/child/result?score=5&unit=かさ");
  await page.getByRole("link", { name: "もういちど やる" }).click();
  await expect(page).toHaveURL(/\/child\/problem\/volume-1/);
});

test("えいご: the child hears the word and answers by tapping a choice", async ({ page }) => {
  await page.goto("/child/home?subject=english");
  await expect(page.getByRole("link", { name: "えいご", exact: true })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: /きょうの おすすめを はじめる/ }).click();
  await expect(page).toHaveURL(/\/child\/problem\/english-alphabet-1/);
  await expect(page.getByLabel("数字キーパッド")).toHaveCount(0);

  await page.getByRole("button", { name: "e", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("おしい");
  await page.getByRole("button", { name: "a", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("せいかい");
  await page.getByRole("button", { name: "れんしゅう 5もんへ" }).click();
  await expect(page.getByText(/れんしゅう 1 \/ 5/)).toBeVisible();
});
