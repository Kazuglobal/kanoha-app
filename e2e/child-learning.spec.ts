import { expect, test } from "@playwright/test";

test("child completes the learning loop with staged answer reveal", async ({ page }) => {
  const baseUrl = process.env.KANOHA_BASE_URL ?? "";
  await page.goto(`${baseUrl}/child/home`);
  await page.getByRole("link", { name: /きょうの おすすめを はじめる/ }).click();

  await expect(page.getByText("1000mL", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "ヒントを みる" }).click();
  await expect(page.getByText("1000mL", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /つぎの ヒント 2/ }).click();
  await page.getByRole("button", { name: /つぎの ときかた/ }).click();
  await expect(page.getByText("1000mL", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /つぎの こたえ/ }).click();
  await expect(page.getByText("1000mL", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "れんしゅう 5もんへ" }).click();
  for (const answer of ["2000mL", "3L", "1500mL", "4000mL", "5L"]) {
    await page.getByRole("button", { name: answer, exact: true }).click();
    await page.getByRole("button", { name: /つぎの もんだい|けっかを みる/ }).click();
  }
  await expect(page.getByText("できた！", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "きょうの けっかへ" }).click();
  await expect(page.getByRole("heading", { name: "かさ、できた！" })).toBeVisible();
  await expect(page.getByText("かさ マスター！")).toBeVisible();
});
