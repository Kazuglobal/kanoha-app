import { eq, and } from "drizzle-orm";
import { ChildHeader } from "@/components/child/ChildHeader";
import { LearningFlow } from "@/components/child/LearningFlow";
import styles from "@/components/kanoha.module.css";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";

import { demoProblemById } from "@/lib/ai/mock";

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
  const isReal = childId && UUID.test(id) && UUID.test(childId);
  const loaded = isReal ? await loadProblem(id, childId) : null;

  const demo = !isReal ? demoProblemById(id) : null;
  const persisted = loaded?.persisted ?? (demo ? {
    childId: childId ?? "demo",
    problemId: id,
    question: demo.problem_text,
    unit: demo.unit,
    subject: demo.subject,
  } : undefined);

  return (
    <div className={styles.childShell}>
      <ChildHeader progress="1 / 1" />
      <main className={styles.learningStage}>
        <LearningFlow persisted={persisted} preferences={loaded?.preferences} />
      </main>
    </div>
  );
}

async function loadProblem(id: string, childId: string) {
  const db = getDb();
  const problem = await db
    .select({
      id: schema.problems.id,
      childId: schema.problems.childId,
      problemText: schema.problems.problemText,
      unit: schema.problems.unit,
      subject: schema.problems.subject,
    })
    .from(schema.problems)
    .where(and(eq(schema.problems.id, id), eq(schema.problems.childId, childId)))
    .get();

  if (!problem) return null;

  const [settings, childProfile] = await Promise.all([
    db
      .select({
        enableAudio: schema.appSettings.enableAudio,
        enableVoiceAnswer: schema.appSettings.enableVoiceAnswer,
      })
      .from(schema.appSettings)
      .where(eq(schema.appSettings.childId, childId))
      .get(),
    db
      .select({
        readingMode: schema.childProfiles.readingMode,
      })
      .from(schema.childProfiles)
      .where(eq(schema.childProfiles.id, childId))
      .get(),
  ]);

  const readingMode: "kanji_with_ruby" | "hiragana" =
    childProfile?.readingMode === "hiragana" ? "hiragana" : "kanji_with_ruby";

  return {
    persisted: {
      childId: problem.childId,
      problemId: problem.id,
      question: problem.problemText,
      unit: problem.unit,
      subject: problem.subject,
    },
    preferences: {
      enableAudio: settings ? Boolean(settings.enableAudio) : true,
      enableVoiceAnswer: settings ? Boolean(settings.enableVoiceAnswer) : true,
      readingMode,
    },
  };
}
