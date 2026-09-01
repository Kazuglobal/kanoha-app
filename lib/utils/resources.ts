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
    .select("id, unit, sub_unit, answer")
    .eq("id", similarProblemId)
    .eq("child_id", childId)
    .maybeSingle();
  return error ? null : data;
}
