import { z } from "zod";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { checkRateLimit } from "@/lib/utils/rateLimit";
import {
  HINT_LEVELS,
  hintMaxLevel,
  hintTextAtLevel,
  ownedProblem,
  ownedSession,
} from "@/lib/utils/resources";
import { explanationLevel, uuid } from "@/lib/utils/schemas";

const schema = z.object({ childId: uuid, problemId: uuid, sessionId: uuid, explanationLevel });

const KEY_BY_LEVEL = { 1: "hint1", 2: "hint2", 3: "solution", 4: "answer" } as const;

/**
 * 「もっとかんたんに」(doc.md §6.1)。返すのは、そのセッションで子どもが既に開いた段階
 * (problem_hint_views.max_level)までに限る。未開示のヒント・答えは含めない(A2)。
 * 平易化の再生成そのもの(Gemini)は W4 で接続する。
 */
export async function POST(request: Request) {
  const parsed = await parseJson(request, schema);
  if (!parsed.success) return apiError("Invalid hint request");
  const { childId, problemId, sessionId } = parsed.data;
  const auth = await requireOwnedChild(childId);
  if (auth.response) return auth.response;
  if (!checkRateLimit(`hints:${auth.user!.id}`)) return apiError("Too many requests", 429);

  const [problem, sessionOk] = await Promise.all([
    ownedProblem(auth.supabase, childId, problemId),
    ownedSession(auth.supabase, childId, sessionId),
  ]);
  if (!problem || !sessionOk) return apiError("Learning resource not found", 404);
  const maxLevel = await hintMaxLevel(auth.supabase, childId, problemId, sessionId);
  if (maxLevel === null) return internalError();

  const revealed = Object.fromEntries(
    HINT_LEVELS.filter((level) => level <= maxLevel)
      .map((level) => [KEY_BY_LEVEL[level], hintTextAtLevel(problem, level)]),
  );
  return apiSuccess({
    ...revealed,
    praise: praiseFrom(problem.explanation_json),
    explanationLevel: parsed.data.explanationLevel,
    maxLevel,
  });
}

const praiseFrom = (explanation: unknown): string => {
  const saved = explanation && typeof explanation === "object" ? (explanation as Record<string, unknown>) : {};
  return typeof saved.praise === "string" && saved.praise ? saved.praise : "ここまで よく かんがえたね。";
};
