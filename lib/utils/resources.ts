import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export async function ownedProblem(childId: string, problemId: string, db = getDb()) {
  const row = await db
    .select()
    .from(schema.problems)
    .where(and(eq(schema.problems.id, problemId), eq(schema.problems.childId, childId)))
    .get();
  return row ?? null;
}

export async function ownedMaterial(childId: string, materialId: string, db = getDb()) {
  const row = await db
    .select()
    .from(schema.uploadedMaterials)
    .where(
      and(eq(schema.uploadedMaterials.id, materialId), eq(schema.uploadedMaterials.childId, childId)),
    )
    .get();
  return row ?? null;
}

export async function ownedSession(childId: string, sessionId: string, db = getDb()) {
  const row = await db
    .select({ id: schema.learningSessions.id })
    .from(schema.learningSessions)
    .where(
      and(eq(schema.learningSessions.id, sessionId), eq(schema.learningSessions.childId, childId)),
    )
    .get();
  return Boolean(row);
}

export async function ownedSimilarProblem(
  childId: string,
  similarProblemId: string,
  db = getDb(),
) {
  const row = await db
    .select({ id: schema.generatedSimilarProblems.id })
    .from(schema.generatedSimilarProblems)
    .where(
      and(
        eq(schema.generatedSimilarProblems.id, similarProblemId),
        eq(schema.generatedSimilarProblems.childId, childId),
      ),
    )
    .get();
  return Boolean(row);
}

export async function ownedSimilarProblemRecord(
  childId: string,
  similarProblemId: string,
  db = getDb(),
) {
  const row = await db
    .select({
      id: schema.generatedSimilarProblems.id,
      source_problem_id: schema.generatedSimilarProblems.sourceProblemId,
      unit: schema.generatedSimilarProblems.unit,
      sub_unit: schema.generatedSimilarProblems.subUnit,
      answer: schema.generatedSimilarProblems.answer,
      explanation: schema.generatedSimilarProblems.explanation,
      choices: schema.generatedSimilarProblems.choices,
    })
    .from(schema.generatedSimilarProblems)
    .where(
      and(
        eq(schema.generatedSimilarProblems.id, similarProblemId),
        eq(schema.generatedSimilarProblems.childId, childId),
      ),
    )
    .get();
  return row ?? null;
}

export const HINT_LEVELS = [1, 2, 3, 4] as const;
export type HintLevel = (typeof HINT_LEVELS)[number];
export const HINT_LABELS: Record<HintLevel, string> = {
  1: "ヒント 1",
  2: "ヒント 2",
  3: "ときかた",
  4: "こたえ",
};

const HINT_KEYS: Record<HintLevel, "hint1" | "hint2" | "solution" | "answer"> = {
  1: "hint1",
  2: "hint2",
  3: "solution",
  4: "answer",
};

const HINT_FALLBACKS: Record<HintLevel, string | null> = {
  1: "もんだいの たいせつな ことばを さがそう。",
  2: "わかっている かずを ならべてみよう。",
  3: "ひとつずつ じゅんばんに かんがえよう。",
  4: null,
};

interface HintSource {
  correct_answer?: string;
  correctAnswer?: string;
  explanation_json?: unknown;
  explanationJson?: unknown;
}

/** 保存済みヒント(explanation_json)から 1 段階だけ取り出す。level 4 は答え。 */
export const hintTextAtLevel = (problem: HintSource, level: HintLevel): string => {
  const raw = problem.explanation_json ?? problem.explanationJson;
  let parsed: Record<string, unknown> = {};
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }
  } else if (raw && typeof raw === "object") {
    parsed = raw as Record<string, unknown>;
  }

  const text = parsed[HINT_KEYS[level]];
  if (typeof text === "string" && text.trim()) return text;
  const answer = problem.correct_answer ?? problem.correctAnswer;
  return HINT_FALLBACKS[level] ?? String(answer ?? "");
};

/** そのセッションで子どもが開いた最大ヒント段階(0 = 未開示)。 */
export async function hintMaxLevel(
  childId: string,
  problemId: string,
  sessionId: string,
  db = getDb(),
): Promise<number | null> {
  const row = await db
    .select({ maxLevel: schema.problemHintViews.maxLevel })
    .from(schema.problemHintViews)
    .where(
      and(
        eq(schema.problemHintViews.childId, childId),
        eq(schema.problemHintViews.problemId, problemId),
        eq(schema.problemHintViews.sessionId, sessionId),
      ),
    )
    .get();
  return Number(row?.maxLevel ?? 0);
}
