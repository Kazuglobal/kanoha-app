import { NextResponse } from "next/server";
import { z } from "zod";
import { demoProblemById } from "@/lib/ai/mock";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild, type ApiResponse } from "@/lib/utils/api";
import { checkRateLimit } from "@/lib/utils/rateLimit";
import {
  HINT_LABELS,
  hintMaxLevel,
  hintTextAtLevel,
  ownedProblem,
  ownedSession,
  type HintLevel,
} from "@/lib/utils/resources";
import { uuid } from "@/lib/utils/schemas";

const levelSchema = z.number().int().min(1).max(4);
const schema = z.object({ childId: uuid, sessionId: uuid, level: levelSchema });
const demoSchema = z.object({ level: levelSchema });

const DEMO_COOKIE = "kanoha_demo_hint";
const NOT_YET = "まえの ヒントを さきに みてね";

type RouteContext = { params: Promise<{ id: string }> };

const isSupabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const hintPayload = (level: HintLevel, text: string, maxLevel: number) => ({
  level,
  label: HINT_LABELS[level],
  text,
  maxLevel,
});

/**
 * 段階開示(A2): ヒントは 1 段階ずつ、直前の段階まで開いていないと出さない(level <= max_level + 1)。
 * 開いた段階は problem_hint_views に記録し、/api/attempts が hint_level_used として読む。
 * 答え(level 4)はここ以外からクライアントへ渡さない。
 */
export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!isSupabaseConfigured()) return demoHint(request, id);
  if (!uuid.safeParse(id).success) return apiError("Problem not found", 404);
  const parsed = await parseJson(request, schema);
  if (!parsed.success) return apiError("Invalid hint request");
  const { childId, sessionId } = parsed.data;
  const level = parsed.data.level as HintLevel;
  const auth = await requireOwnedChild(childId);
  if (auth.response) return auth.response;
  if (!checkRateLimit(`hint:${auth.user!.id}`, 60)) return apiError("Too many requests", 429);

  const [problem, sessionOk] = await Promise.all([
    ownedProblem(auth.supabase, childId, id),
    ownedSession(auth.supabase, childId, sessionId),
  ]);
  if (!problem || !sessionOk) return apiError("Learning resource not found", 404);

  const current = await hintMaxLevel(auth.supabase, childId, id, sessionId);
  if (current === null) return internalError();
  if (level > current + 1) return apiError(NOT_YET, 400);

  const maxLevel = Math.max(current, level);
  const { error } = await auth.supabase.from("problem_hint_views").upsert({
    child_id: childId,
    problem_id: id,
    session_id: sessionId,
    max_level: maxLevel,
  }, { onConflict: "child_id,problem_id,session_id" });
  if (error) return internalError();

  return apiSuccess(hintPayload(level, hintTextAtLevel(problem, level), maxLevel));
}

/** Supabase 未設定時のデモ: 開いた段階は cookie で数え、同じ規則で 1 段ずつ返す。 */
async function demoHint(request: Request, id: string) {
  const problem = demoProblemById(id);
  if (!problem) return apiError("Problem not found", 404);
  const parsed = await parseJson(request, demoSchema);
  if (!parsed.success) return apiError("Invalid hint request");
  const level = parsed.data.level as HintLevel;
  const current = demoMaxLevel(request, id);
  if (level > current + 1) return apiError(NOT_YET, 400);

  const maxLevel = Math.max(current, level);
  const response = NextResponse.json<ApiResponse<ReturnType<typeof hintPayload>>>({
    success: true,
    data: hintPayload(level, hintTextAtLevel(problem, level), maxLevel),
  });
  response.cookies.set({
    name: DEMO_COOKIE,
    value: `${id}:${maxLevel}`,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return response;
}

const demoMaxLevel = (request: Request, id: string): number => {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${DEMO_COOKIE}=([^;]*)`));
  const [cookieId, level] = decodeURIComponent(match?.[1] ?? "").split(":");
  return cookieId === id ? Math.min(4, Math.max(0, Number(level) || 0)) : 0;
};
