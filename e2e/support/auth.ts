import { expect, type APIRequestContext } from "@playwright/test";

const RATE_LIMITED = 429;
const MAX_ATTEMPTS = 8;
const WAIT_MS = 3_000;

/**
 * 親のアカウントを作る(テストごとに別のメール)。better-auth はサインアップを同じ IP から 10 秒に 3 回までにしていて、
 * 並列のテストと 2 つの画面サイズで重なると 429 になる。そのときは少し待ってやり直す。
 */
export async function signUpParent(api: APIRequestContext, prefix = "e2e"): Promise<void> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const response = await api.post("/api/auth/sign-up/email", {
      data: { email: `${prefix}-${stamp}@example.com`, password: `pw-${stamp}-long`, name: "e2e" },
    });
    if (response.status() !== RATE_LIMITED) {
      expect(response.ok(), await response.text()).toBe(true);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, WAIT_MS));
  }
  throw new Error("サインアップが 回数制限(429)のまま通らなかった");
}
