import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function ownedProblem(supabase: Supabase, childId: string, problemId: string) {
  const { data, error } = await supabase
    .from("problems")
    .select("*")
    .eq("id", problemId)
    .eq("child_id", childId)
    .maybeSingle();
  return error ? null : data;
}

export async function ownedMaterial(supabase: Supabase, childId: string, materialId: string) {
  const { data, error } = await supabase
    .from("uploaded_materials")
    .select("*")
    .eq("id", materialId)
    .eq("child_id", childId)
    .maybeSingle();
  return error ? null : data;
}

export async function ownedSession(supabase: Supabase, childId: string, sessionId: string) {
  const { data, error } = await supabase
    .from("learning_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("child_id", childId)
    .maybeSingle();
  return !error && Boolean(data);
}

export async function ownedSimilarProblem(
  supabase: Supabase,
  childId: string,
  similarProblemId: string,
) {
  const { data, error } = await supabase
    .from("generated_similar_problems")
    .select("id")
    .eq("id", similarProblemId)
    .eq("child_id", childId)
    .maybeSingle();
  return !error && Boolean(data);
}

export async function ownedSimilarProblemRecord(
  supabase: Supabase,
  childId: string,
  similarProblemId: string,
) {
  const { data, error } = await supabase
    .from("generated_similar_problems")
    .select("id, source_problem_id, unit, sub_unit, answer, explanation, choices")
    .eq("id", similarProblemId)
    .eq("child_id", childId)
    .maybeSingle();
  return error ? null : data;
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
  correct_answer: string;
  explanation_json: unknown;
}

/** 保存済みヒント(explanation_json)から 1 段階だけ取り出す。level 4 は答え。 */
export const hintTextAtLevel = (problem: HintSource, level: HintLevel): string => {
  const saved = problem.explanation_json && typeof problem.explanation_json === "object"
    ? (problem.explanation_json as Record<string, unknown>)
    : {};
  const text = saved[HINT_KEYS[level]];
  if (typeof text === "string" && text.trim()) return text;
  return HINT_FALLBACKS[level] ?? String(problem.correct_answer);
};

/** そのセッションで子どもが開いた最大ヒント段階(0 = 未開示)。 */
export async function hintMaxLevel(
  supabase: Supabase,
  childId: string,
  problemId: string,
  sessionId: string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from("problem_hint_views")
    .select("max_level")
    .eq("child_id", childId)
    .eq("problem_id", problemId)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) return null;
  return Number(data?.max_level ?? 0);
}
