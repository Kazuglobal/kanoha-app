import { defineConfig, devices } from "@playwright/test";

/**
 * 本番モード(`next start`)では子どもモードの cookie が Secure になる。Playwright は Secure cookie を
 * https と `localhost` にしか送らず `127.0.0.1` には送らないので、http のテストサーバーは localhost で呼ぶ。
 */
const ORIGIN = process.env.E2E_ORIGIN ?? "http://localhost:3107";
const PORT = new URL(ORIGIN).port || "3107";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  use: {
    baseURL: ORIGIN,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: ORIGIN,
    reuseExistingServer: true,
    timeout: 120_000,
    // `next start` は本番モードなので、署名鍵と AI プロバイダが必須(E2E 専用の値を既定にする)
    env: {
      BETTER_AUTH_SECRET:
        process.env.BETTER_AUTH_SECRET ?? "e2e-only-better-auth-secret-not-for-production",
      AI_PROVIDER_TEXT: process.env.AI_PROVIDER_TEXT ?? "mock",
    },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
