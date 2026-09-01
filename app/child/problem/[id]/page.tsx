import { ChildHeader } from "@/components/child/ChildHeader";
import { LearningFlow } from "@/components/child/LearningFlow";
import styles from "@/components/kanoha.module.css";
import { createClient } from "@/lib/supabase/server";

export default async function ProblemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ childId?: string }>;
}) {
  const [{ id }, { childId }] = await Promise.all([params, searchParams]);
  let persisted;
  let preferences;

  if (childId && /^[0-9a-f-]{36}$/i.test(id) && /^[0-9a-f-]{36}$/i.test(childId)) {
    const supabase = await createClient();
    const { data } = await supabase.from("problems")
      .select("id, child_id, problem_text, correct_answer, unit, explanation_json")
      .eq("id", id)
      .eq("child_id", childId)
      .maybeSingle();
    if (data) {
      const saved = data.explanation_json as Record<string, string>;
      persisted = {
        childId: data.child_id,
        problemId: data.id,
        question: data.problem_text,
        correctAnswer: data.correct_answer,
        unit: data.unit,
        hints: [
          saved.hint1 ?? "もんだいの たいせつな ことばを さがそう。",
          saved.hint2 ?? "わかっている かずを ならべてみよう。",
          saved.solution ?? "ひとつずつ じゅんばんに かんがえよう。",
          saved.answer ?? data.correct_answer,
        ] as const,
      };
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
      preferences = settings ? {
        enableAudio: settings.enable_audio,
        enableVoiceAnswer: settings.enable_voice_answer,
        readingMode,
      } : { enableAudio: true, enableVoiceAnswer: true, readingMode };
    }
  }

  return <div className={styles.childShell}><ChildHeader progress="1 / 1" /><main className={styles.narrow}><LearningFlow persisted={persisted} preferences={preferences} /></main></div>;
}
