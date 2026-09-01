import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 親 PIN(4桁)のハッシュとロックアウト規則(A1)。
 * 依存を増やさないため Node の scrypt を使う。保存形式: `scrypt$<salt hex>$<hash hex>`。
 * ハッシュとロック列は service_role だけが読める(supabase/migrations/0010_child_mode_hints.sql)。
 */
const scrypt = promisify<string, Buffer, number, { N: number }, Buffer>(scryptCallback);

const SCRYPT_COST = 16_384;
const SALT_BYTES = 16;
const KEY_BYTES = 32;
const FORMAT = "scrypt";

export const PIN_MAX_FAILURES = 5;
export const PIN_LOCK_MINUTES = 5;

export const pinSchema = z.string().regex(/^\d{4}$/, "PIN must be 4 digits");

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scrypt(pin, salt, KEY_BYTES, { N: SCRYPT_COST });
  return [FORMAT, salt.toString("hex"), derived.toString("hex")].join("$");
}

export async function verifyPin(pin: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const [format, saltHex, hashHex] = stored.split("$");
  if (format !== FORMAT || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length !== KEY_BYTES) return false;
  const derived = await scrypt(pin, Buffer.from(saltHex, "hex"), KEY_BYTES, { N: SCRYPT_COST });
  return timingSafeEqual(derived, expected);
}

export interface PinLockRow {
  parent_pin_hash: string | null;
  parent_pin_failed_attempts: number | null;
  parent_pin_locked_until: string | null;
}

/** ロック中なら残り秒数を返す(0 = ロックなし)。 */
export const pinLockRemainingSeconds = (row: Pick<PinLockRow, "parent_pin_locked_until">, now: Date): number => {
  if (!row.parent_pin_locked_until) return 0;
  const until = new Date(row.parent_pin_locked_until).getTime();
  if (Number.isNaN(until)) return 0;
  return Math.max(0, Math.ceil((until - now.getTime()) / 1000));
};

/** 失敗 1 回分を加算し、上限に達したらロック期限を付ける(純粋関数)。 */
export const pinAfterFailure = (
  row: Pick<PinLockRow, "parent_pin_failed_attempts">,
  now: Date,
): { parent_pin_failed_attempts: number; parent_pin_locked_until: string | null } => {
  const failures = (row.parent_pin_failed_attempts ?? 0) + 1;
  const locked = failures >= PIN_MAX_FAILURES;
  return {
    parent_pin_failed_attempts: locked ? 0 : failures,
    parent_pin_locked_until: locked
      ? new Date(now.getTime() + PIN_LOCK_MINUTES * 60_000).toISOString()
      : null,
  };
};

export const PIN_COLUMNS = "parent_pin_hash, parent_pin_failed_attempts, parent_pin_locked_until";

/** service_role クライアントで PIN 列を読む(anon/authenticated には権限が無い)。 */
export async function loadPinRow(admin: SupabaseClient, userId: string): Promise<PinLockRow | null> {
  const { data, error } = await admin.from("users").select(PIN_COLUMNS).eq("id", userId).maybeSingle();
  if (error || !data) return null;
  return data as PinLockRow;
}

/** 親が PIN を登録済みか(service_role で読む)。設定不備や失敗は「未登録」として扱う。 */
export async function parentHasPin(userId: string): Promise<boolean> {
  try {
    const row = await loadPinRow(createAdminClient(), userId);
    return Boolean(row?.parent_pin_hash);
  } catch {
    return false;
  }
}
