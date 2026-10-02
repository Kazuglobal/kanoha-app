import { eq } from "drizzle-orm";
import { z } from "zod";
import { hashPin, pinSchema } from "@/lib/auth/pin";
import * as schemaDb from "@/lib/db/schema";
import { apiError, apiSuccess, internalError, parseJson, requireUser } from "@/lib/utils/api";
import { checkRateLimit } from "@/lib/utils/rateLimit";

const schema = z.object({ pin: pinSchema }).strict();

/**
 * 親 PIN の設定・変更(A1)。親専用(子どもモード中は proxy.ts が 403 にする)。
 */
export async function POST(request: Request) {
  const parsed = await parseJson(request, schema);
  if (!parsed.success) return apiError("PIN must be 4 digits");
  const auth = await requireUser();
  if (!auth.user) return apiError("Authentication required", 401);
  if (!checkRateLimit(`pin-set:${auth.user.id}`, 10)) return apiError("Too many requests", 429);

  try {
    const hashed = await hashPin(parsed.data.pin);
    await auth.db
      .update(schemaDb.users)
      .set({
        parentPinHash: hashed,
        parentPinFailedAttempts: 0,
        parentPinLockedUntil: null,
      })
      .where(eq(schemaDb.users.id, auth.user.id))
      .run();
  } catch {
    return internalError();
  }
  return apiSuccess({ pinSet: true });
}
