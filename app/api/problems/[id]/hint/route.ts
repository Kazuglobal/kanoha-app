import { NextResponse } from "next/server";
import { z } from "zod";
import { demoProblemById } from "@/lib/ai/mock";
import * as schema from "@/lib/db/schema";
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
import { nowJstIso } from "@/lib/utils/date";

const levelSchema = z.number().int().min(1).max(4);
const schemaValidation = z.object({ childId: uuid, sessionId: uuid, level: levelSchema });
const demoSchema = z.object({ level: levelSchema });

const DEMO_COOKIE = "kanoha_demo_hint";
const NOT_YET = "まえの ヒントを さきに みてね";

type RouteContext = { params: Promise<{ id: string }> };

const hintPayload = (level: HintLevel, text: string, maxLevel: number) => ({
  level,
  label: HINT_LABELS[level],
  text,
  maxLevel,
});

/**
 * 段階開示(A2): ヒントは 1 段階ずつ、直前の段階まで開いていないと出さない(level <= max_level + 1)。
 */
export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!uuid.safeParse(id).success) return demoHint(request, id);

  const parsed = await parseJson(request, schemaValidation);
  if (!parsed.success) return apiError("Invalid hint request");
  const { childId, sessionId } = parsed.data;
  const level = parsed.data.level as HintLevel;

  const auth = await requireOwnedChild(childId);
  if (auth.response) return auth.response;
  if (!checkRateLimit(`hint:${auth.user!.id}`, 60)) return apiError("Too many requests", 429);

  const [problem, sessionOk] = await Promise.all([
    ownedProblem(childId, id, auth.db),
    ownedSession(childId, sessionId, auth.db),
  ]);
  if (!problem || !sessionOk) return apiError("Learning resource not found", 404);

  const current = await hintMaxLevel(childId, id, sessionId, auth.db);
  if (current === null) return internalError();
  if (level > current + 1) return apiError(NOT_YET, 400);

  const maxLevel = Math.max(current, level);
  const now = nowJstIso();

  try {
    await auth.db
      .insert(schema.problemHintViews)
      .values({
        childId,
        problemId: id,
        sessionId,
        maxLevel,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [schema.problemHintViews.childId, schema.problemHintViews.problemId, schema.problemHintViews.sessionId],
        set: {
          maxLevel,
          updatedAt: now,
        },
      })
      .run();
  } catch {
    return internalError();
  }

  return apiSuccess(hintPayload(level, hintTextAtLevel(problem, level), maxLevel));
}

/** デモ問題対応: 開いた段階は cookie で数え、同じ規則で 1 段ずつ返す。 */
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
