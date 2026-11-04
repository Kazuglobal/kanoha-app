import { expect, test, type Page } from "@playwright/test";

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

/** 音を出す呼び出し(<audio>・Web Audio・ブラウザの読み上げ)を数える。通信(先読み)ではなく、実際に鳴らすことを見る。 */
const recordPlayback = () => {
  const played: string[] = [];
  Object.assign(window, { __played: played });
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...args) {
    played.push("media");
    return play.apply(this, args);
  };
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...args) {
    played.push("buffer");
    return start.apply(this, args);
  };
  const synth = window.speechSynthesis;
  if (synth) {
    const speak = synth.speak.bind(synth);
    synth.speak = (utterance) => {
      played.push(`speech:${utterance.text}`);
      return speak(utterance);
    };
  }
};

const playedSounds = (page: Page) => page.evaluate(() => (window as unknown as { __played: string[] }).__played);

test("えいごで おはなし: こたえたあとも、つぎへ を押すまで次の問いは読まれない", async ({ page }) => {
  await page.addInitScript(recordPlayback);
  await page.goto("/child/english-talk/greeting");
  await page.getByRole("button", { name: /おはなしを はじめる/ }).click();
  // 声のかわりに「こたえの ヒント」(4択)で答える
  await page.getByRole("button", { name: /こたえの ヒント（えらんで こたえる）/ }).click();
  await page.getByRole("button", { name: "My name is Yuki." }).click();
  await expect(page.getByText(/ばっちり つたわったよ/)).toBeVisible();

  // ほめる声は答えへの返事なので鳴ってよい。そのあとは、自動では何も鳴らさない
  await page.waitForTimeout(1_500);
  const settled = (await playedSounds(page)).length;
  await page.waitForTimeout(1_500);
  const after = await playedSounds(page);
  expect(after).toHaveLength(settled);
  expect(after.some((sound) => sound.includes("How are you?"))).toBe(false);

  await page.getByRole("button", { name: "つぎへ ▶" }).click();
  await expect(page.getByText("How are you?").first()).toBeVisible();
  await expect.poll(async () => (await playedSounds(page)).length).toBeGreaterThan(settled);
});

test("えいごで おはなし: 存在しないシーンは 404", async ({ page }) => {
  const response = await page.goto("/child/english-talk/no-such-scene");
  expect(response?.status()).toBe(404);
});
