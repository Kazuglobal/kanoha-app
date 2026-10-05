import { eq, and } from "drizzle-orm";
import { ChildHeader } from "@/components/child/ChildHeader";
import { LearningFlow } from "@/components/child/LearningFlow";
import type { PersistedProblem } from "@/components/child/useLearningFlow";
import styles from "@/components/kanoha.module.css";
import { getServerSession } from "@/lib/auth/session";
import {
  getCurriculumProblemById,
  getCurriculumStageProgress,
  getNextCurriculumProblem,
  type CurriculumProblem,
} from "@/lib/curriculum/curriculumBank";
import { ensureCurriculumProblem } from "@/lib/curriculum/materialize";
import { demoPracticeFor } from "@/lib/curriculum/demoCheck";
import { SUBJECT_CONFIG } from "@/lib/curriculum/subjects";
import { getDb, type Database } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { ownsChild } from "@/lib/utils/api";

const UUID = /^[0-9a-f-]{36}$/i;


/**
 * 子どもの問題画面(A2): クライアントへ渡すのは問題文・単元・ID(と選択式の選択肢)だけ。
 * 答えとヒントはここでは読まず、POST /api/problems/[id]/hint が 1 段ずつ返す。
 * ステージマップ(問題バンク)の問題も、ログイン中は子どもの problems 行として登録し、
 * 正誤・苦手単元・復習予定・親レポートの学習ループに乗せる。
 */
export default async function ProblemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ childId?: string }>;
}) {
  const [{ id }, { childId }] = await Promise.all([params, searchParams]);
  const bank = getCurriculumProblemById(id);
  const loaded = childId ? await loadOwnedProblem(id, childId, bank) : null;

  const curriculumId = bank?.id ?? loaded?.curriculumProblemId ?? null;
  const curriculum = curriculumId ? getCurriculumProblemById(curriculumId) : undefined;
  const nextProblemId = curriculumId ? (getNextCurriculumProblem(curriculumId)?.id ?? null) : null;
  const persisted: PersistedProblem = loaded
    ? { ...loaded.persisted, ...curriculumExtras(curriculum), nextProblemId }
    : demoProblem(bank ?? getCurriculumProblemById(SUBJECT_CONFIG.math.defaultProblemId)!, childId, nextProblemId);

  const stageProgress = curriculumId ? getCurriculumStageProgress(curriculumId) : null;

  return (
    <div className={`${styles.childShell} ${styles.appScreen}`}>
      <ChildHeader progress={stageProgress?.label ?? "1 / 1"} />
      <main className={styles.learningStage}>
        <LearningFlow persisted={persisted} preferences={loaded?.preferences} />
      </main>
    </div>
  );
}

const curriculumExtras = (problem?: CurriculumProblem) => ({
  ...(problem?.choices ? { choices: problem.choices } : {}),
  ...(problem?.listenText ? { listenText: problem.listenText } : {}),
});

/** 未ログイン(デモ)用: 答えは渡さず、答え合わせは POST /api/demo/check が行う(A2)。 */
function demoProblem(
  bank: CurriculumProblem,
  childId: string | undefined,
  nextProblemId: string | null,
): PersistedProblem {
  return {
    childId: childId ?? "demo",
    problemId: bank.id,
    question: bank.problemText,
    unit: bank.unit,
    subject: bank.subject,
    ...curriculumExtras(bank),
    nextProblemId,
    demoPractice: demoPracticeFor(bank.id),
  };
}

/** セッションの親がその子どもを持っているときだけ、実データの問題を読む(バンク問題は登録してから読む)。 */
async function loadOwnedProblem(id: string, childId: string, bank?: CurriculumProblem) {
  if (!UUID.test(childId) || (!bank && !UUID.test(id))) return null;
  const session = await getServerSession();
  if (!session?.user) return null;
  const db = getDb();
  if (!(await ownsChild(session.user.id, childId, db))) return null;
  const problemId = bank ? await ensureCurriculumProblem(db, childId, bank) : id;
  return loadProblem(problemId, childId, db);
}

async function loadProblem(id: string, childId: string, db: Database) {
  const problem = await db
    .select({
      id: schema.problems.id,
      childId: schema.problems.childId,
      problemText: schema.problems.problemText,
      unit: schema.problems.unit,
      subject: schema.problems.subject,
      curriculumProblemId: schema.problems.curriculumProblemId,
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
      .select({ readingMode: schema.childProfiles.readingMode })
      .from(schema.childProfiles)
      .where(eq(schema.childProfiles.id, childId))
      .get(),
  ]);

  return {
    curriculumProblemId: problem.curriculumProblemId,
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
      readingMode: childProfile?.readingMode === "hiragana" ? ("hiragana" as const) : ("kanji_with_ruby" as const),
    },
  };
}
