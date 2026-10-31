import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  use: {
    // localhost を使う: 本番モードの子どもモード cookie は Secure 付きで、
    // http://127.0.0.1 には送られない(localhost はブラウザがセキュアコンテキスト扱い)
    baseURL: "http://localhost:3107",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run build && npm run start -- -p 3107",
    url: "http://localhost:3107",
    reuseExistingServer: true,
    // OpenNext ビルド込みで起動するため長めに待つ
    timeout: 600_000,
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
