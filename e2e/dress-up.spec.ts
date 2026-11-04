import { expect, test, type Page } from "@playwright/test";

const REWARD_KEY = "kanoha_child_rewards_v1";
const EQUIPPED_KEY = "kanoha_child_equipped_accessories_v1";

const startWith = (page: Page, totalCorrectCount: number, equipped: Record<string, string> = {}) =>
  page.addInitScript(
    ([rewardKey, equippedKey, total, worn]) => {
      localStorage.setItem(
        rewardKey as string,
        JSON.stringify({ currentCycleCount: (total as number) % 10, totalCorrectCount: total, totalRewardYen: 0 }),
      );
      if (Object.keys(worn as object).length > 0) localStorage.setItem(equippedKey as string, JSON.stringify(worn));
    },
    [REWARD_KEY, EQUIPPED_KEY, totalCorrectCount, equipped] as const,
  );

const openCloset = async (page: Page) => {
  await page.goto("/child/home");
  await page.getByRole("button", { name: /きがえ をひらく/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
};

test("きがえ: 鍵と「あと◯もん」が見え、コーデをワンタップで着て、ペットが出る", async ({ page }) => {
  await startWith(page, 5);
  const dialog = await openCloset(page);

  await dialog.getByRole("tab", { name: /ぼうし/ }).click();
  const crown = dialog.getByRole("button", { name: /きんのクラウン/ });
  await expect(crown).toHaveAttribute("aria-disabled", "true");
  await expect(crown).toContainText("あと 45もん");

  await dialog.getByRole("tab", { name: /コーデ/ }).click();
  await dialog.getByRole("button", { name: /おでかけ/ }).click();
  await expect(dialog.getByRole("button", { name: /おでかけ/ })).toHaveAttribute("aria-current", "true");
  await expect(dialog.locator("[data-pet='pet_cat']")).toBeVisible();

  await page.screenshot({ path: "test-results/dress-up-outfit.png" });

  // 閉じても着たままで、ほかの画面のキャラクターにもペットが出る
  await dialog.getByRole("button", { name: /できた/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("[data-pet='pet_cat']").first()).toBeAttached();
});

test("きがえ: 鍵の説明は、はっきり読める濃さ(カード全体を うすくしない)", async ({ page }) => {
  await startWith(page, 5);
  const dialog = await openCloset(page);
  await dialog.getByRole("tab", { name: /ぼうし/ }).click();

  const crown = dialog.getByRole("button", { name: /きんのクラウン/ });
  const notice = crown.getByText(/あと 45もん/);
  // 文字の色(#b45309)が そのまま見える: 自分も 親も 透明度を下げていない(開くときの ふわっと出る動きが終わるまで待つ)
  await expect
    .poll(() =>
      notice.evaluate((element) => {
        for (let node: Element | null = element; node && node.tagName !== "BODY"; node = node.parentElement) {
          if (Number(getComputedStyle(node).opacity) !== 1) return false;
        }
        return true;
      }),
    )
    .toBe(true);
});

test("きがえ: 新しい枠(エフェクト・ペット・うごき)を選ぶと、すぐにキャラクターに出る", async ({ page }) => {
  await startWith(page, 300);
  const dialog = await openCloset(page);

  await dialog.getByRole("tab", { name: /エフェクト/ }).click();
  await dialog.getByRole("button", { name: /ゆき/ }).click();
  await expect(dialog.locator("[data-effect='snow']")).toBeVisible();

  await dialog.getByRole("tab", { name: /ペット/ }).click();
  await dialog.getByRole("button", { name: /ドラゴン/ }).click();
  await expect(dialog.locator("[data-pet='pet_dragon']")).toBeVisible();

  await dialog.getByRole("tab", { name: /うごき/ }).click();
  await dialog.getByRole("button", { name: /ダンス/ }).click();
  await expect(dialog.locator("[data-motion='dance']")).toBeVisible();

  await page.screenshot({ path: "test-results/dress-up-effects.png" });

  await dialog.getByRole("button", { name: /いつもの ふく/ }).click();
  await expect(dialog.locator("[data-pet]")).toHaveCount(0);
  await expect(dialog.locator("[data-effect]")).toHaveCount(0);
  await expect(dialog.locator("[data-motion='calm']")).toBeVisible();
});

test("きがえ: タブは矢印キーで動かせる", async ({ page }) => {
  await startWith(page, 0);
  const dialog = await openCloset(page);

  await dialog.getByRole("tab", { name: /キャラ/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByRole("tab", { name: /ふく/, selected: true })).toBeFocused();
  await page.keyboard.press("End");
  await expect(dialog.getByRole("tab", { name: /うごき/, selected: true })).toBeFocused();
  await expect(dialog.getByRole("tabpanel")).toContainText("しずか");
});

test.describe("「動きを減らす」設定", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  for (const effect of ["effect_snow", "effect_sparkle", "effect_hearts", "effect_bubbles", "effect_rainbow", "effect_aura"]) {
    test(`キャラクターのうごきと ${effect} のアニメーションが止まり、顔の上に粒が残らない(ペットは見えたまま)`, async ({ page }) => {
      await startWith(page, 300, { motion: "motion_dance", effect, pet: "pet_cat" });
      const dialog = await openCloset(page);

      const seen = await dialog.evaluate((root) => {
        /** 見えている濃さ: その要素から エフェクトの枠(svg)までの透明度を かけあわせる */
        const shown = (el: Element) => {
          let value = 1;
          for (let node: Element | null = el; node; node = node.parentElement) {
            value *= Number(getComputedStyle(node).opacity);
            if (node.hasAttribute("data-effect")) break;
          }
          return value;
        };
        const at = (el: Element) => ({
          x: Number(el.getAttribute("x") ?? el.getAttribute("cx")),
          y: Number(el.getAttribute("y") ?? el.getAttribute("cy")),
        });
        const describe = (el: Element) => ({
          animation: getComputedStyle(el).animationName,
          opacity: shown(el),
          tag: el.tagName.toLowerCase(),
          ...at(el),
        });
        return {
          body: [...root.querySelectorAll("[data-motion]")].map(describe),
          effect: [...root.querySelectorAll("[data-effect] *")].map(describe),
          pet: [...root.querySelectorAll("[data-pet] text")].map(describe),
        };
      });

      expect(seen.body.map((item) => item.animation)).toEqual(["none"]);
      expect(seen.effect.length).toBeGreaterThan(0);
      expect(new Set(seen.effect.map((item) => item.animation))).toEqual(new Set(["none"]));

      // 粒・光は 止めたまま見える。ただし 顔のあたりにある粒は 出さない
      const dots = seen.effect.filter((item) => item.tag === "text" || item.tag === "circle");
      const onFace = (item: { x: number; y: number }) => item.x >= 250 && item.x <= 790 && item.y >= 100 && item.y <= 720;
      for (const item of dots) {
        if (onFace(item)) expect(item.opacity, `${effect} 顔の上の粒`).toBe(0);
        else expect(item.opacity, `${effect} 顔の外の粒`).toBeGreaterThan(0);
      }
      if (effect === "effect_hearts" || effect === "effect_bubbles") expect(dots.some((item) => item.opacity > 0)).toBe(true);
      if (effect === "effect_aura") expect(seen.effect.find((item) => item.tag === "ellipse")?.opacity).toBeGreaterThan(0); // 静かな光は 残る
      expect(seen.pet.map((item) => item.animation)).toEqual(["none"]);
      await expect(dialog.locator("[data-pet='pet_cat']")).toBeVisible();
    });
  }
});

test("「動きを減らす」でないときは、選んだうごきが実際に動く(ダンスの動き)", async ({ page }) => {
  await startWith(page, 300, { motion: "motion_dance" });
  const dialog = await openCloset(page);
  const name = await dialog.locator("[data-motion]").evaluate((el) => getComputedStyle(el).animationName);
  // 基本の ふわふわ(float)ではなく、ダンスの動き(CSS Modules は 名前の前後に目印がつく)
  expect(name).toMatch(/motionDance/);
});

for (const motion of ["motion_bouncy", "motion_float", "motion_dance", "motion_calm"]) {
  test(`${motion}: 頭のてっぺんが枠で切れない(枠の上に、動きの大きさ以上の余白がある)`, async ({ page }) => {
    await startWith(page, 300, { motion });
    const dialog = await openCloset(page);

    // 動いている最中の位置ではなく、動く前の場所(offset*)を見る
    const layout = await dialog.evaluate((root) => {
      const body = root.querySelector("[data-motion]") as HTMLElement;
      const stage = body.parentElement as HTMLElement;
      return { top: body.offsetTop, height: body.offsetHeight, bottomGap: stage.clientHeight - (body.offsetTop + body.offsetHeight) };
    });
    // 一番高く動いても(体の高さの 5% 上へ + 下がはらを原点に 3% のび = 8%)、枠の上に はみ出さない。足もとは 枠の下にそろっている
    expect(layout.top).toBeGreaterThanOrEqual(layout.height * 0.08);
    expect(Math.abs(layout.bottomGap)).toBeLessThan(2);
  });
}
