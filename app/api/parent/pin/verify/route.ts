import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { clearedChildModeCookie } from "@/lib/auth/childMode";
import {
  loadPinRow,
  pinAfterFailure,
  pinLockRemainingSeconds,
  pinSchema,
  verifyPin,
} from "@/lib/auth/pin";
import * as schemaDb from "@/lib/db/schema";
import { apiError, internalError, parseJson, requireUser, type ApiResponse } from "@/lib/utils/api";
import { checkRateLimit } from "@/lib/utils/rateLimit";

const schema = z.object({ pin: pinSchema }).strict();

const LOCKED_MESSAGE = "PINを何回か間違えたため、しばらく待ってからお試しください";

/**
 * 親 PIN の照合(A1)。子どもモード中でも呼べる唯一の親向け操作。
 * 成功: 子どもモード cookie を消す。失敗: 回数を数え、5 回で 5 分ロック。
 */
export async function POST(request: Request) {
  const parsed = await parseJson(request, schema);
  if (!parsed.success) return apiError("PIN must be 4 digits");
  const auth = await requireUser();
  if (!auth.user) return apiError("Authentication required", 401);
  if (!checkRateLimit(`pin-verify:${auth.user.id}`, 10)) return apiError("Too many requests", 429);

  try {
    const row = await loadPinRow(auth.user.id, auth.db);
    if (!row?.parent_pin_hash) return apiError("PIN is not set", 409);
    const now = new Date();
    const remaining = pinLockRemainingSeconds(row, now);
    if (remaining > 0) return apiError(LOCKED_MESSAGE, 423);

    if (!(await verifyPin(parsed.data.pin, row.parent_pin_hash))) {
      const next = pinAfterFailure(row, now);
      await auth.db
        .update(schemaDb.users)
        .set({
          parentPinFailedAttempts: next.parent_pin_failed_attempts,
          parentPinLockedUntil: next.parent_pin_locked_until,
        })
        .where(eq(schemaDb.users.id, auth.user.id))
        .run();

      return apiError(
        next.parent_pin_locked_until ? LOCKED_MESSAGE : "PINが違います",
        next.parent_pin_locked_until ? 423 : 401,
      );
    }

    await auth.db
      .update(schemaDb.users)
      .set({ parentPinFailedAttempts: 0, parentPinLockedUntil: null })
      .where(eq(schemaDb.users.id, auth.user.id))
      .run();
  } catch {
    return internalError();
  }

  const response = NextResponse.json<ApiResponse<{ verified: true }>>({
    success: true,
    data: { verified: true },
  });
  response.cookies.set(clearedChildModeCookie(process.env.NODE_ENV === "production"));
  return response;
}
