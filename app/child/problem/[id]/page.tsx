import { ChildHeader } from "@/components/child/ChildHeader";
import { LearningFlow } from "@/components/child/LearningFlow";
import styles from "@/components/kanoha.module.css";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * 子どもの問題画面(A2): クライアントへ渡すのは問題文・単元・ID だけ。
 * 答えとヒントはここでは読まず、POST /api/problems/[id]/hint が 1 段ずつ返す。
 */
export default async function ProblemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ childId?: string }>;
}) {
  const [{ id }, { childId }] = await Promise.all([params, searchParams]);
  const loaded = childId && UUID.test(id) && UUID.test(childId) ? await loadProblem(id, childId) : null;

  return (
    <div className={styles.childShell}>
      <ChildHeader progress="1 / 1" />
      <main className={styles.narrow}>
        <LearningFlow persisted={loaded?.persisted} preferences={loaded?.preferences} />
      </main>
    </div>
  );
}

async function loadProblem(id: string, childId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("problems")
    .select("id, child_id, problem_text, unit")
    .eq("id", id)
    .eq("child_id", childId)
    .maybeSingle();
  if (!data) return null;

  const [{ data: settings }, { data: childProfile }] = await Promise.all([
    supabase.from("app_settings")
      .select("enable_audio, enable_voice_answer")
      .eq("child_id", childId)
      .maybeSingle(),
    supabase.from("child_profiles")
      .select("reading_mode")
      .eq("id", childId)
      .maybeSingle(),
  ]);
  const readingMode: "kanji_with_ruby" | "hiragana" =
    childProfile?.reading_mode === "hiragana" ? "hiragana" : "kanji_with_ruby";

  return {
    persisted: {
      childId: data.child_id,
      problemId: data.id,
      question: data.problem_text,
      unit: data.unit,
    },
    preferences: settings ? {
      enableAudio: settings.enable_audio,
      enableVoiceAnswer: settings.enable_voice_answer,
      readingMode,
    } : { enableAudio: true, enableVoiceAnswer: true, readingMode },
  };
}
