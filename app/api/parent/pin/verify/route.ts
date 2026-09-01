import { NextResponse } from "next/server";
import { z } from "zod";
import { clearedChildModeCookie } from "@/lib/auth/childMode";
import {
  loadPinRow,
  pinAfterFailure,
  pinLockRemainingSeconds,
  pinSchema,
  verifyPin,
} from "@/lib/auth/pin";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, internalError, parseJson, requireUser, type ApiResponse } from "@/lib/utils/api";
import { checkRateLimit } from "@/lib/utils/rateLimit";

const schema = z.object({ pin: pinSchema }).strict();

const LOCKED_MESSAGE = "PINを何回か間違えたため、しばらく待ってからお試しください";

/**
 * 親 PIN の照合(A1)。子どもモード中でも呼べる唯一の親向け操作。
 * 成功: 子どもモード cookie を消す。失敗: 回数を数え、5 回で 5 分ロック。
 * 総当たり対策はロック(DB)+ユーザー単位のレート制限。ハッシュは返さない。
 */
export async function POST(request: Request) {
  const parsed = await parseJson(request, schema);
  if (!parsed.success) return apiError("PIN must be 4 digits");
  const auth = await requireUser();
  if (!auth.user) return apiError("Authentication required", 401);
  if (!checkRateLimit(`pin-verify:${auth.user.id}`, 10)) return apiError("Too many requests", 429);

  try {
    const admin = createAdminClient();
    const row = await loadPinRow(admin, auth.user.id);
    if (!row?.parent_pin_hash) return apiError("PIN is not set", 409);
    const now = new Date();
    const remaining = pinLockRemainingSeconds(row, now);
    if (remaining > 0) return apiError(LOCKED_MESSAGE, 423);

    if (!(await verifyPin(parsed.data.pin, row.parent_pin_hash))) {
      const next = pinAfterFailure(row, now);
      const { error } = await admin.from("users").update(next).eq("id", auth.user.id);
      if (error) return internalError();
      return apiError(next.parent_pin_locked_until ? LOCKED_MESSAGE : "PINが違います", next.parent_pin_locked_until ? 423 : 401);
    }

    const { error } = await admin.from("users")
      .update({ parent_pin_failed_attempts: 0, parent_pin_locked_until: null })
      .eq("id", auth.user.id);
    if (error) return internalError();
  } catch {
    return internalError();
  }

  const response = NextResponse.json<ApiResponse<{ verified: true }>>({ success: true, data: { verified: true } });
  response.cookies.set(clearedChildModeCookie(process.env.NODE_ENV === "production"));
  return response;
}
