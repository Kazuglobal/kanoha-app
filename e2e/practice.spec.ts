import { expect, request as playwrightRequest, test, type Page } from "@playwright/test";
import { signUpParent as signUp } from "./support/auth";

/**
 * 「あたらしい もんだい」(その子の進み具合に合わせて自動で作る 5もん)の通し。
 * ホームのカード → セットの 1 問目 → ヒントで答えを確かめて正解 → つぎの問題(2 / 5)→ ホームの「つづきから」。
 * 子どもモードのまま通ること(/api/practice は子どもに許す API)も確かめる。AI はモック。
 */

const PIN = "4321";

// 「つぎの もんだいへ」のボタンは ずっと脈うつので、動きを減らす設定にして止める(Playwright は動いている要素を押せない)
test.use({ contextOptions: { reducedMotion: "reduce" } });

// せいかいが たまると出る「レベルアップ」モーダルは、出たら閉じて学習を続ける。
test.beforeEach(async ({ page }) => {
  await page.addLocatorHandler(page.getByRole("button", { name: "べんきょうを つづける" }), async (button) => {
    await button.click();
  });
});

type Api = Page["request"];

const signUpParent = (api: Api) => signUp(api, "e2e-practice");

const createChild = async (api: Api): Promise<string> => {
  const response = await api.post("/api/children", { data: { nickname: "テスト", grade: 2 } });
  expect(response.ok(), await response.text()).toBe(true);
  return ((await response.json()) as { data: { id: string } }).data.id;
};

/** ヒントを 4 段階ひらいて、サーバーが保存している答えを読む(答えは画面の元の JS には入っていない)。 */
const readAnswerFromHints = async (page: Page): Promise<string> => {
  const cards = page.getByRole("region", { name: "だんかいヒント" }).locator("article");
  await expect(async () => {
    await page.getByRole("button", { name: "ヒントを みる" }).click();
    await expect(cards).toHaveCount(1, { timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  for (const [index, label] of [/つぎの ヒント 2/, /つぎの ときかた/, /つぎの こたえ/].entries()) {
    await page.getByRole("button", { name: label }).click();
    await expect(cards).toHaveCount(index + 2);
  }
  const text = (await cards.last().innerText()).replace(/\s+/g, " ");
  const match = /こたえは\s*『?(.+?)』?\s*だよ/.exec(text);
  expect(match, `こたえのヒントから答えを読めない: ${text}`).not.toBeNull();
  return match![1].trim();
};

const answerWith = async (page: Page, answer: string) => {
  const choices = page.getByRole("group", { name: "こたえを えらぶ" });
  if (await choices.isVisible()) {
    await choices.getByRole("button", { name: answer, exact: true }).click();
  } else {
    await page.getByRole("textbox", { name: "こたえ" }).fill(answer);
    await page.getByRole("button", { name: "こたえる", exact: true }).click();
  }
};

test("home card → set problem 1 → correct answer → problem 2 → home resumes (child mode)", async ({ page }) => {
  await signUpParent(page.request);
  const childId = await createChild(page.request);
  expect((await page.request.post("/api/parent/pin", { data: { pin: PIN } })).ok()).toBe(true);
  expect((await page.request.post("/api/child-mode")).ok()).toBe(true);

  await page.goto(`/child/home?childId=${childId}`);
  const card = page.getByRole("region", { name: "あたらしい もんだい" });
  await expect(card.getByText("いまの きみに ぴったりの 5もん")).toBeVisible();
  await expect(card.getByText("0 / 5 もん できたよ")).toBeVisible();
  const start = card.getByRole("link", { name: /はじめる/ });
  const firstHref = await start.getAttribute("href");
  expect(firstHref).toMatch(new RegExp(`^/child/problem/[0-9a-f-]{36}\\?childId=${childId}&batch=[0-9a-f-]{36}$`));

  // リロードしても同じセット(1 問目が変わらない)
  await page.reload();
  await expect(card.getByRole("link", { name: /はじめる/ })).toHaveAttribute("href", firstHref!);

  // 1 問目: セットの何問目かが出て、答えを確かめて正解する
  await card.getByRole("link", { name: /はじめる/ }).click();
  await expect(page).toHaveURL(/batch=/);
  await expect(page.getByText("1 / 5", { exact: true })).toBeVisible();
  // 小さい画面では バッジは隠れる(CSS)ので、画面にあることだけ確かめる。進みは上の「1 / 5」で見える
  await expect(page.getByText("あたらしい もんだい", { exact: true })).toBeAttached();
  const answer = await readAnswerFromHints(page);
  await answerWith(page, answer);
  await expect(page.getByRole("status").filter({ hasText: /せいかい/ })).toBeVisible();

  // つぎの問題(セットの 2 問目)
  const next = page.getByRole("link", { name: /つぎの もんだいへ すすむ/ });
  await expect(next).toBeVisible();
  expect(await next.getAttribute("href")).toContain("batch=");
  await next.click();
  await expect(page.getByText("2 / 5", { exact: true })).toBeVisible();

  // ホームに もどると 「つづきから」(1 問できた)
  await page.goto(`/child/home?childId=${childId}`);
  await expect(card.getByText("1 / 5 もん できたよ")).toBeVisible();
  await expect(card.getByRole("link", { name: /つづきから/ })).toBeVisible();
});

test("the practice API is closed to other families' children and never returns answers", async ({ page, baseURL }) => {
  await signUpParent(page.request);
  const childId = await createChild(page.request);
  const ok = await page.request.post("/api/practice/new-set", { data: { childId, subject: "math" } });
  expect(ok.status()).toBe(200);
  const text = await ok.text();
  expect(text).not.toMatch(/correctAnswer|correct_answer|hint1|solution|generator_ref|generatorRef|problemText|listenText/);

  // 別の家族(別のログイン)の子ども: 存在するが、自分の子どもではない
  const other = await playwrightRequest.newContext({ baseURL });
  try {
    await signUpParent(other);
    const strangerChild = await createChild(other);
    const denied = await page.request.post("/api/practice/new-set", { data: { childId: strangerChild, subject: "math" } });
    expect(denied.status()).toBe(404);
    // 相手のセットは 作られていない(持ち主が はじめて開いたとき 1 セット目になる)
    const theirs = await other.post("/api/practice/new-set", { data: { childId: strangerChild, subject: "math" } });
    expect(((await theirs.json()) as { data: { seq: number } }).data.seq).toBe(1);
  } finally {
    await other.dispose();
  }
});
