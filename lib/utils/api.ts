import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/session";
import { getDb, type Database } from "@/lib/db";
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

export async function parseJson<T>(request: Request, schema: z.ZodType<T>) {
  try {
    return schema.safeParse(await request.json());
  } catch {
    return schema.safeParse(undefined);
  }
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
