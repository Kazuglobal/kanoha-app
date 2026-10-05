/** 開発・テスト専用。本番では絶対に使わない(resolveAuthSecret が拒否する)。 */
export const DEV_AUTH_SECRET = "kanoha-app-secret-key-must-be-at-least-32-chars-long";

const MIN_SECRET_LENGTH = 32;

/**
 * better-auth の署名鍵を決める。本番で BETTER_AUTH_SECRET が無い・短い・開発用の値なら
 * 起動を止める(固定値のままセッションに署名して動き続けるのを防ぐ)。
 * `next build` 中はモジュールを読み込むだけなので開発用の値で通す。
 */
export function resolveAuthSecret(env: Record<string, string | undefined>): string {
  const secret = env.BETTER_AUTH_SECRET?.trim() ?? "";
  const isProduction = env.NODE_ENV === "production";
  const isBuild = env.NEXT_PHASE === "phase-production-build";

  if (!isProduction || isBuild) return secret || DEV_AUTH_SECRET;

  if (!secret || secret === DEV_AUTH_SECRET) {
    throw new Error(
      "BETTER_AUTH_SECRET is not set. Run `wrangler secret put BETTER_AUTH_SECRET` before deploying.",
    );
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`BETTER_AUTH_SECRET must be at least ${MIN_SECRET_LENGTH} characters.`);
  }
  return secret;
}
