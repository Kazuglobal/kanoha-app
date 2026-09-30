import { NextResponse } from "next/server";
import { childModeCookie } from "@/lib/auth/childMode";
import { loadPinRow } from "@/lib/auth/pin";
import { apiError, internalError, requireUser, type ApiResponse } from "@/lib/utils/api";

const isProduction = () => process.env.NODE_ENV === "production";

/**
 * 子どもモード開始(A1)。親専用(proxy.ts が子どもモード中の POST を 403 にする)。
 * PIN 未設定のまま始めると親画面に戻れなくなるため 409 で断る。
 */
export async function POST() {
  const auth = await requireUser();
  if (!auth.user) return apiError("Authentication required", 401);

  try {
    const row = await loadPinRow(auth.user.id, auth.db);
    if (!row?.parent_pin_hash) return apiError("Set a parent PIN before starting child mode", 409);
  } catch {
    return internalError();
  }

  const response = NextResponse.json<ApiResponse<{ mode: "child" }>>({
    success: true,
    data: { mode: "child" },
  });
  response.cookies.set(childModeCookie(isProduction()));
  return response;
}
