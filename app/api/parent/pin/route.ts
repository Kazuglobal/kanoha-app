import { z } from "zod";
import { hashPin, pinSchema } from "@/lib/auth/pin";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess, internalError, parseJson, requireUser } from "@/lib/utils/api";
import { checkRateLimit } from "@/lib/utils/rateLimit";

const schema = z.object({ pin: pinSchema }).strict();

/**
 * 親 PIN の設定・変更(A1)。親専用(子どもモード中は proxy.ts が 403 にする)。
 * ハッシュは service_role で書き、レスポンスには含めない。
 */
export async function POST(request: Request) {
  const parsed = await parseJson(request, schema);
  if (!parsed.success) return apiError("PIN must be 4 digits");
  const auth = await requireUser();
  if (!auth.user) return apiError("Authentication required", 401);
  if (!checkRateLimit(`pin-set:${auth.user.id}`, 10)) return apiError("Too many requests", 429);

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("users")
      .update({
        parent_pin_hash: await hashPin(parsed.data.pin),
        parent_pin_failed_attempts: 0,
        parent_pin_locked_until: null,
      })
      .eq("id", auth.user.id);
    if (error) return internalError();
  } catch {
    return internalError();
  }
  return apiSuccess({ pinSet: true });
}
