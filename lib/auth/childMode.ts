/**
 * 子どもモード(A1): 親が `kanoha_mode=child` cookie を立てると、proxy.ts が
 * /parent/* と親専用 API を遮断する。cookie は署名しない(偽造しても権限が下がるだけ)。
 * 解除は親 PIN(POST /api/parent/pin/verify)か、24 時間の失効。
 */
export const CHILD_MODE_COOKIE = "kanoha_mode";
export const CHILD_MODE_VALUE = "child";
export const CHILD_MODE_MAX_AGE_SECONDS = 24 * 60 * 60;
export const CHILD_HOME_PATH = "/child/home";

/** 子どもモード中は呼べない API(前方一致)。 */
export const PARENT_ONLY_API = [
  "/api/children",
  "/api/materials",
  "/api/ai/analyze-problem",
  "/api/settings",
] as const;

/** メソッド込みで判定する親専用エンドポイント。 */
const PARENT_ONLY_EXACT: readonly { path: string; methods: readonly string[] | null }[] = [
  { path: "/api/parent/pin", methods: null },
  { path: "/api/child-mode", methods: ["POST"] },
];

interface CookieReader {
  get(name: string): { value: string } | undefined;
}

export const isChildMode = (cookies: CookieReader): boolean =>
  cookies.get(CHILD_MODE_COOKIE)?.value === CHILD_MODE_VALUE;

/**
 * PARENT_ONLY_API の配下でも、子ども画面が使うため子どもモードで通す API。
 * (ごほうび・着せかえの読み書き。所有確認は各ルートの requireOwnedChild が行う)
 * `%` や `.` を含む ID は通さない(エンコード経由の迂回を許さない)。
 */
const CHILD_ALLOWED_API: readonly RegExp[] = [/^\/api\/children\/[A-Za-z0-9_-]+\/rewards$/];

const hasPrefix = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

/** `/api/%63hildren` のようなエンコード済みの綴りも遮断対象にするため、生の値と復号後の両方を調べる。復号できないパスは調べられないので遮断側に倒す。 */
const pathVariants = (pathname: string): string[] | null => {
  try {
    return [pathname, decodeURIComponent(pathname)];
  } catch {
    return null;
  }
};

export const isParentPage = (pathname: string): boolean => {
  const variants = pathVariants(pathname);
  return variants === null || variants.some((path) => hasPrefix(path, "/parent"));
};

const isBlockedApi = (pathname: string, method: string): boolean =>
  PARENT_ONLY_API.some((prefix) => hasPrefix(pathname, prefix)) ||
  PARENT_ONLY_EXACT.some(
    (rule) => rule.path === pathname && (rule.methods === null || rule.methods.includes(method.toUpperCase())),
  );

export const isParentOnlyApi = (pathname: string, method: string): boolean => {
  if (CHILD_ALLOWED_API.some((pattern) => pattern.test(pathname))) return false;
  const variants = pathVariants(pathname);
  return variants === null || variants.some((path) => isBlockedApi(path, method));
};

export const childModeCookie = (secure: boolean) => ({
  name: CHILD_MODE_COOKIE,
  value: CHILD_MODE_VALUE,
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure,
  maxAge: CHILD_MODE_MAX_AGE_SECONDS,
});

export const clearedChildModeCookie = (secure: boolean) => ({
  ...childModeCookie(secure),
  value: "",
  maxAge: 0,
});
