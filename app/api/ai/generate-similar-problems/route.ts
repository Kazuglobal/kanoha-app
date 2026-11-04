import { z } from "zod";
import { getAiProvider } from "@/lib/ai";
import { costLimitsFromEnv } from "@/lib/ai/costGuard";
import { scrubPiiFromSimilarProblem } from "@/lib/ai/pii";
import { allUnitSchema, similarProblemDraftsSchema } from "@/lib/ai/schemas";
import type { SimilarProblemDraft, SimilarProblemRequest } from "@/lib/ai/schemas";
import { reserveAiUsage } from "@/lib/ai/usage";
import { ALL_MISTAKE_TYPE_IDS } from "@/lib/curriculum/mistakeTypes";
import { buildCurriculumPractice } from "@/lib/curriculum/practice";
import { resolveSubject } from "@/lib/curriculum/subjects";
import * as schema from "@/lib/db/schema";
import { generateSimilarSet } from "@/lib/generation/similar";
import { difficultyFromLevel } from "@/lib/learning/level";
import { recentUnitAttempts } from "@/lib/review/loop";
import { buildChoices } from "@/lib/review/choices";
import { difficultyForNextSimilarSet } from "@/lib/review/recommend";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { envNumber } from "@/lib/utils/envNumber";
import { checkRateLimitDb } from "@/lib/utils/rateLimit";
import { asc, and, eq, sql } from "drizzle-orm";
import { ownedProblem } from "@/lib/utils/resources";
import { difficulty, uuid } from "@/lib/utils/schemas";
import { nowJstIso } from "@/lib/utils/date";

const schemaValidation = z.object({
  childId: uuid,
  problemId: uuid,
  difficulty: difficulty.optional(),
  mistakeType: z.enum(ALL_MISTAKE_TYPE_IDS).optional(),
});

/** Workers では環境変数がリクエスト時にしか確定しないので、呼ぶたびに読む。 */
const similarCostUsd = () => envNumber("AI_SIMILAR_COST_USD", 0.005);
const MISTAKE_HISTORY_SIZE = 5;

type Auth = Awaited<ReturnType<typeof requireOwnedChild>>;
type Problem = NonNullable<Awaited<ReturnType<typeof ownedProblem>>>;

export async function POST(request: Request) {
  const parsed = await parseJson(request, schemaValidation);
  if (!parsed.success) return apiError("Invalid similar problem request");
  const auth = await requireOwnedChild(parsed.data.childId);
  if (auth.response) return auth.response;
  if (!(await checkRateLimitDb(auth.user!.id, "similar", 10))) return apiError("Too many requests", 429);
  const problem = await ownedProblem(parsed.data.childId, parsed.data.problemId, auth.db);
  if (!problem) return apiError("Problem not found", 404);

  const unit = allUnitSchema.safeParse(problem.unit);
  if (!unit.success) return internalError();
  if (problem.curriculumProblemId) return persistCurriculumPractice(auth, problem, problem.curriculumProblemId);
  if (problem.generatorRef) return persistGeneratedPractice(auth, problem, problem.generatorRef);
  const history = await recentUnitAttempts(parsed.data.childId, unit.data, MISTAKE_HISTORY_SIZE, auth.db);
  const { difficulty: adjusted, streak } = difficultyForNextSimilarSet(
    parsed.data.difficulty ?? difficulty.safeParse(problem.difficulty).data ?? "standard",
    history,
  );
  const input: SimilarProblemRequest = {
    difficulty: adjusted,
    mistakeType: parsed.data.mistakeType ?? streak.mistakeType ?? undefined,
    problemText: problem.problemText,
    subUnit: problem.subUnit,
    unit: unit.data,
    subject: resolveSubject(problem.subject, problem.unit),
  };

  const provider = getAiProvider();
  if (provider.name === "mock") {
    const drafts = await provider.generateSimilarProblems(input);
    return persistDrafts(auth, problem, drafts);
  }
  return generateWithGemini(auth, problem, provider, input);
}

async function generateWithGemini(
  auth: Auth,
  problem: Problem,
  provider: ReturnType<typeof getAiProvider>,
  input: SimilarProblemRequest,
) {
  const reservation = await reserveAiUsage(
    auth.user!.id,
    similarCostUsd(),
    costLimitsFromEnv(),
    auth.db,
  );
  if (reservation.outcome === "unavailable") {
    return apiError("AIをいまは利用できません。しばらくしてからお試しください。", 503);
  }
  if (reservation.outcome === "denied") {
    return apiError("AIの利用上限に達しました。しばらくしてからお試しください。", 429);
  }

  let drafts: readonly SimilarProblemDraft[];
  try {
    drafts = await provider.generateSimilarProblems(input);
  } catch {
    return apiError("れんしゅう問題の生成に失敗しました。もう一度お試しください。", 502);
  }

  return persistDrafts(auth, problem, drafts);
}

const SIMILAR_COUNT = 5;

type SimilarRow = {
  id: string;
  problem_text: string;
  unit: string;
  sub_unit: string;
  difficulty: string;
  choices: string | null;
  listen_text: string | null;
};

const parseStoredChoices = (stored: string | null): unknown => {
  try {
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const similarResponse = (row: SimilarRow) => ({ ...row, choices: parseStoredChoices(row.choices) });

/**
 * すでに作ってある類題 5 問(同じ元の問題の)。バンク・自動で作った問題の類題は、中身が元の問題だけで決まるので
 * 何度頼まれても作りなおさず 同じ 5 問を返す(行を増やさない)。5 問そろっていなければ null。
 */
async function existingSimilar(auth: Auth, problem: Problem) {
  const rows = await auth.db
    .select({
      id: schema.generatedSimilarProblems.id,
      problem_text: schema.generatedSimilarProblems.problemText,
      unit: schema.generatedSimilarProblems.unit,
      sub_unit: schema.generatedSimilarProblems.subUnit,
      difficulty: schema.generatedSimilarProblems.difficulty,
      choices: schema.generatedSimilarProblems.choices,
      listen_text: schema.generatedSimilarProblems.listenText,
    })
    .from(schema.generatedSimilarProblems)
    .where(and(eq(schema.generatedSimilarProblems.childId, problem.childId), eq(schema.generatedSimilarProblems.sourceProblemId, problem.id)))
    .orderBy(asc(sql`rowid`))
    .limit(SIMILAR_COUNT)
    .all();
  return rows.length === SIMILAR_COUNT ? rows.map(similarResponse) : null;
}

/** 問題バンク由来の問題は、同じバンクから決定的に類題を組む(AI を使わず、選択肢・聞き取り音声つき)。 */
async function persistCurriculumPractice(auth: Auth, problem: Problem, curriculumProblemId: string) {
  const existing = await existingSimilar(auth, problem);
  if (existing) return apiSuccess(existing);
  const items = buildCurriculumPractice(curriculumProblemId);
  const drafts: SimilarProblemDraft[] = items.map((item) => ({
    answer: item.answer,
    difficulty: "standard",
    explanation: item.explanation,
    problemText: item.question,
    subUnit: item.subUnit,
    unit: item.unit,
  }));
  return persistDrafts(
    auth,
    problem,
    drafts,
    items.map(({ choices, listenText }) => ({ choices, listenText })),
    false,
  );
}

/** 自動で作った問題は、同じ生成器で類題を組む(AI を使わず、答えは計算で決まる)。 */
async function persistGeneratedPractice(auth: Auth, problem: Problem, ref: string) {
  const existing = await existingSimilar(auth, problem);
  if (existing) return apiSuccess(existing);
  const set = generateSimilarSet({ id: problem.id, ref });
  if (!set) return internalError();
  const drafts: SimilarProblemDraft[] = set.map((item) => ({
    answer: item.correctAnswer,
    difficulty: difficultyFromLevel(item.level),
    explanation: item.hints.solution,
    problemText: item.problemText,
    subUnit: item.subUnit,
    unit: item.unit,
  }));
  return persistDrafts(
    auth,
    problem,
    drafts,
    set.map((item) => ({ choices: item.choices ?? null, listenText: item.listenText ?? null })),
    false,
  );
}

interface DraftExtras {
  choices: readonly string[] | null;
  listenText: string | null;
}

/** 保存する行(4 択は 渡されたもの、なければ答えから決めた数字の 4 択)。 */
function similarRows(problem: Problem, items: readonly SimilarProblemDraft[], extras: readonly DraftExtras[] | undefined) {
  const now = nowJstIso();
  return items.map((item, index) => ({
    id: crypto.randomUUID(),
    sourceProblemId: problem.id,
    childId: problem.childId,
    problemText: item.problemText,
    answer: item.answer,
    explanation: item.explanation,
    unit: item.unit,
    subUnit: item.subUnit,
    difficulty: item.difficulty,
    choices: JSON.stringify(extras?.[index]?.choices ?? buildChoices(item.answer, `${problem.id}:${index}`)),
    listenText: extras?.[index]?.listenText ?? null,
    createdAt: now,
  }));
}

async function persistDrafts(
  auth: Auth,
  problem: Problem,
  drafts: readonly SimilarProblemDraft[],
  extras?: readonly DraftExtras[],
  /** AI が作った文だけ個人情報を取りのぞく。テンプレートで作った文には個人情報が無く、「先生」「小さい」のような語を こわしてしまう。 */
  scrubPii = true,
) {
  const validated = similarProblemDraftsSchema.safeParse(drafts);
  if (!validated.success) return internalError();
  const rows = similarRows(problem, scrubPii ? validated.data.map(scrubPiiFromSimilarProblem) : validated.data, extras);

  try {
    const inserted = [];
    for (const row of rows) {
      const saved = await auth.db
        .insert(schema.generatedSimilarProblems)
        .values(row)
        .returning({
          id: schema.generatedSimilarProblems.id,
          problem_text: schema.generatedSimilarProblems.problemText,
          unit: schema.generatedSimilarProblems.unit,
          sub_unit: schema.generatedSimilarProblems.subUnit,
          difficulty: schema.generatedSimilarProblems.difficulty,
          choices: schema.generatedSimilarProblems.choices,
          listen_text: schema.generatedSimilarProblems.listenText,
        })
        .get();
      inserted.push(similarResponse(saved));
    }
    return apiSuccess(inserted, 201);
  } catch {
    return internalError();
  }
}
