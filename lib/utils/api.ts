import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return { supabase, user: error ? null : user };
}

export async function ownsChild(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  childId: string,
) {
  const { data, error } = await supabase
    .from("child_profiles")
    .select("id")
    .eq("id", childId)
    .eq("user_id", userId)
    .maybeSingle();

  return !error && Boolean(data);
}

export async function requireOwnedChild(childId: string) {
  const auth = await requireUser();
  if (!auth.user) return { ...auth, response: apiError("Authentication required", 401) };
  if (!(await ownsChild(auth.supabase, auth.user.id, childId))) {
    return { ...auth, response: apiError("Child profile not found", 404) };
  }
  return { ...auth, response: null };
}

export function internalError() {
  return apiError("Unable to complete the request", 500);
}
