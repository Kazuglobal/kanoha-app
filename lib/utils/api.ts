import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json<ApiResponse<T>>({ success: true, data }, { status });
}

export function apiError(error: string, status = 400) {
  return NextResponse.json<ApiResponse<never>>({ success: false, error }, { status });
}

/** 文字列の本文を JSON として読み、スキーマで検証する(失敗は success: false)。 */
export function parseJsonText<T>(text: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>) {
  try {
    if (!text || text.trim() === "") {
      return schema.safeParse(undefined);
    }
    return schema.safeParse(JSON.parse(text));
  } catch (error) {
    // エラー本文には入力の一部が引用されることがあるので、種類だけを記録する
    console.error("[parseJson] JSON parse error:", error instanceof Error ? error.name : "unknown");
    return schema.safeParse(undefined);
  }
}

export async function parseJson<T>(request: Request, schema: z.ZodType<T, z.ZodTypeDef, unknown>) {
  let text = "";
  try {
    text = await request.text();
  } catch {
    // 本文を読めないときは空として扱う
  }
  return parseJsonText(text, schema);
}

/**
 * 本文を maxBytes までだけ読む。超えたら読むのをやめて null(Content-Length が無いストリームでも全部は貯めない)。
 */
export async function readBodyText(request: Request, maxBytes: number): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return "";
  }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(joined);
}

/** Content-Length が上限を超えていれば、本文を読む前に断るために使う。 */
export function bodyTooLarge(request: Request, maxBytes: number): boolean {
  const length = Number(request.headers.get("content-length"));
  return Number.isFinite(length) && length > maxBytes;
}

export async function requireUser() {
  const session = await getServerSession();
  const db = getDb();
  return { db, user: session?.user ?? null };
}

export async function ownsChild(userId: string, childId: string, db = getDb()) {
  const row = await db
    .select({ id: schema.childProfiles.id })
    .from(schema.childProfiles)
    .where(and(eq(schema.childProfiles.id, childId), eq(schema.childProfiles.userId, userId)))
    .get();

  return Boolean(row);
}

export async function requireOwnedChild(childId: string) {
  const auth = await requireUser();
  if (!auth.user) return { ...auth, response: apiError("Authentication required", 401) };
  if (!(await ownsChild(auth.user.id, childId, auth.db))) {
    return { ...auth, response: apiError("Child profile not found", 404) };
  }
  return { ...auth, response: null };
}

export function internalError() {
  return apiError("Unable to complete the request", 500);
}
