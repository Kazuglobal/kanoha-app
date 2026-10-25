import { NextResponse, type NextRequest } from "next/server";
import { CHILD_HOME_PATH, isChildMode, isParentOnlyApi, isParentPage } from "@/lib/auth/childMode";

const isMutation = (method: string) => !["GET", "HEAD", "OPTIONS"].includes(method);

/**
 * CSRF 対策: Origin ヘッダーの host を Host ヘッダーと比べる。
 */
const sameOrigin = (request: NextRequest): boolean => {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("host") ?? request.nextUrl.host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
};

/**
 * 子どもモード(A1)の遮断:
 * cookie が立っている間は /parent/* を /child/home へ、親専用 API を 403 にする。
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isChildMode(request.cookies)) {
    if (isParentPage(pathname)) {
      const home = request.nextUrl.clone();
      home.pathname = CHILD_HOME_PATH;
      home.search = "";
      return NextResponse.redirect(home, 302);
    }
    if (isParentOnlyApi(pathname, request.method)) {
      return NextResponse.json({ success: false, error: "Not available in child mode" }, { status: 403 });
    }
  }

  if (pathname.startsWith("/api/") && isMutation(request.method) && !sameOrigin(request)) {
    return NextResponse.json({ success: false, error: "Invalid request origin" }, { status: 403 });
  }

  return NextResponse.next();
}

/** 静的ファイルだけ proxy を外す。/api/* は拡張子で終わるパス(例: /api/children/x.png)でも必ず通す。 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|(?!api/).*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
