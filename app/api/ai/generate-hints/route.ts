import { z } from "zod";
import { getAiProvider } from "@/lib/ai";
import { costLimitsFromEnv } from "@/lib/ai/costGuard";
import { scrubPiiFromHints } from "@/lib/ai/pii";
import { buildHintsPrompt } from "@/lib/ai/prompts";
import { hintsSchema, type Hints } from "@/lib/ai/schemas";
import { reserveAiUsage } from "@/lib/ai/usage";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { checkRateLimit } from "@/lib/utils/rateLimit";
import {
  HINT_LEVELS,
  hintMaxLevel,
  ownedProblem,
  ownedSession,
} from "@/lib/utils/resources";
import { explanationLevel, uuid } from "@/lib/utils/schemas";

import { demoProblemById } from "@/lib/ai/mock";
import { getCurriculumProblemById } from "@/lib/curriculum/curriculumBank";

const schema = z.object({
  childId: z.string().optional().nullable(),
  problemId: z.string().optional().nullable(),
  sessionId: z.string().optional().nullable(),
  explanationLevel: z.string().optional().nullable(),
});

const KEY_BY_LEVEL = { 1: "hint1", 2: "hint2", 3: "solution", 4: "answer" } as const;
const HINTS_COST_USD = Number(process.env.AI_HINTS_COST_USD ?? 0.002);

type Auth = Awaited<ReturnType<typeof requireOwnedChild>>;

export async function POST(request: Request) {
  const parsed = await parseJson(request, schema);
  if (!parsed.success) {
    return apiError("Invalid hint request");
  }
  const childId = parsed.data.childId?.trim() || "demo";
  const problemId = parsed.data.problemId?.trim() || "volume-1";
  const sessionId = parsed.data.sessionId?.trim() || "demo-session";
  const level: z.infer<typeof explanationLevel> =
    parsed.data.explanationLevel === "standard" ||
    parsed.data.explanationLevel === "easy" ||
    parsed.data.explanationLevel === "very_easy"
      ? parsed.data.explanationLevel
      : "very_easy";

  const isReal =
    childId !== "demo" &&
    uuid.safeParse(childId).success &&
    uuid.safeParse(problemId).success &&
    Boolean(sessionId) &&
    uuid.safeParse(sessionId).success;

  if (!isReal) {
    return handleDemoGenerateHints(problemId, level);
  }

  const auth = await requireOwnedChild(childId);
  if (auth.response) {
    // 認証に失敗した、または親に紐づかない場合でも、カリキュラム/デモ問題ならヒントを返す
    return handleDemoGenerateHints(problemId, level);
  }
  if (!checkRateLimit(`hints:${auth.user!.id}`)) return apiError("Too many requests", 429);

  const [problem, sessionOk] = await Promise.all([
    ownedProblem(childId, problemId, auth.db),
    ownedSession(childId, sessionId, auth.db),
  ]);
  if (!problem || !sessionOk) {
    return handleDemoGenerateHints(problemId, level);
  }
  const maxLevel = await hintMaxLevel(childId, problemId, sessionId, auth.db);
  if (maxLevel === null) return internalError();

  const subject = (problem.subject as "math" | "japanese") || "math";
  const regenerated = await regenerateHints(
    auth,
    problem.problemText,
    level,
    subject,
  );
  if ("response" in regenerated) return regenerated.response;

  const revealed = Object.fromEntries(
    HINT_LEVELS.filter((lvl) => lvl <= maxLevel).map((lvl) => [
      KEY_BY_LEVEL[lvl],
      regenerated.hints[KEY_BY_LEVEL[lvl]],
    ]),
  );
  return apiSuccess({
    ...revealed,
    praise: regenerated.hints.praise,
    explanationLevel: level,
    maxLevel,
  });
}

async function handleDemoGenerateHints(
  problemId: string,
  level: z.infer<typeof explanationLevel>,
) {
  const problem = demoProblemById(problemId) ?? getCurriculumProblemById(problemId);
  if (!problem) return apiError("Problem not found", 404);

  const problemText = "problem_text" in problem ? problem.problem_text : problem.problemText;
  const subject = problem.subject === "japanese" ? "japanese" : "math";
  const provider = getAiProvider();
  const raw = await provider.generateHints(buildHintsPrompt(problemText, level, subject));
  const validated = hintsSchema.safeParse(raw);

  const hints: Hints = validated.success
    ? scrubPiiFromHints(validated.data)
    : {
        hint1: subject === "japanese" ? "かん字の かたちを よく みてみよう。" : "え や すうじ を みてみよう。",
        hint2: subject === "japanese" ? "１もじずつ おもいだして みよう。" : "すこしずつ かんがえてみよう。",
        solution: "かんがえかたを つかうと、こたえが わかるよ。",
        answer: "correct_answer" in problem ? problem.correct_answer : problem.correctAnswer,
        praise: "がんばっているね！",
      };

  return apiSuccess({
    hint1: hints.hint1,
    hint2: hints.hint2,
    solution: hints.solution,
    answer: hints.answer,
    praise: hints.praise,
    explanationLevel: level,
    maxLevel: 4,
  });
}

async function regenerateHints(
  auth: Auth,
  problemText: string,
  level: z.infer<typeof explanationLevel>,
  subject: "math" | "japanese" = "math",
): Promise<{ hints: Hints } | { response: Response }> {
  const provider = getAiProvider();
  if (provider.name === "mock") {
    const raw = await provider.generateHints(buildHintsPrompt(problemText, level, subject));
    const validated = hintsSchema.safeParse(raw);
    return validated.success
      ? { hints: scrubPiiFromHints(validated.data) }
      : { response: internalError() };
  }

  const reservation = await reserveAiUsage(
    auth.user!.id,
    HINTS_COST_USD,
    costLimitsFromEnv(),
    auth.db,
  );
  if (reservation.outcome === "unavailable") {
    return {
      response: apiError("AIをいまは利用できません。しばらくしてからお試しください。", 503),
    };
  }
  if (reservation.outcome === "denied") {
    return {
      response: apiError("AIの利用上限に達しました。しばらくしてからお試しください。", 429),
    };
  }

  try {
    const raw = await provider.generateHints(buildHintsPrompt(problemText, level, subject));
    const validated = hintsSchema.safeParse(raw);
    if (!validated.success) return { response: internalError() };
    return { hints: scrubPiiFromHints(validated.data) };
  } catch {
    return {
      response: apiError("ヒントの再生成に失敗しました。もう一度お試しください。", 502),
    };
  }
}
