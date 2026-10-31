import { Award, CalendarCheck, Target } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { CharacterCoach } from "@/components/child/CharacterCoach";
import { ChildHeader } from "@/components/child/ChildHeader";
import { RewardBurst } from "@/components/child/RewardBurst";
import { RubyAuto } from "@/components/child/RubyText";
import { RESULT_TEXT } from "@/components/child/childStrings";
import styles from "@/components/kanoha.module.css";
import { problemHref, homeHref } from "@/components/child/links";
import { getCurriculumStageProgress, getNextCurriculumProblem } from "@/lib/curriculum/curriculumBank";
import { isSubject } from "@/lib/curriculum/subjects";

export default async function ResultPage({
  searchParams,
}: {
  searchParams: Promise<{ score?: string; unit?: string; problemId?: string; childId?: string; nextProblemId?: string; batch?: string; subject?: string }>;
}) {
  const { score = "5", unit = "かさ", problemId, childId, nextProblemId, batch, subject } = await searchParams;
  // 「あたらしい もんだい」のセットの中の問題は、つぎの問題・やりなおしでも セットの手がかりを引きつぐ
  const homeLink = homeHref(childId, subject && isSubject(subject) ? subject : undefined);
  const mastered = Number(score) >= 4;
  const nextTargetId = nextProblemId ?? (problemId ? getNextCurriculumProblem(problemId)?.id : null);
  const stageProgress = problemId ? getCurriculumStageProgress(problemId) : null;
  const isLastInUnit = Boolean(stageProgress?.isLastInUnit);
  const nextHref = nextTargetId ? problemHref(nextTargetId, childId, batch) : null;
  // 「もういちど やる」(doc §6.1): 同じ問題のページへ戻る。デモはデモ問題へ。
  const retryHref = problemId && childId ? problemHref(problemId, childId, batch) : "/child/problem/volume-1";
  return (
    <div className={`${styles.childShell} ${styles.appScreen}`}>
      <ChildHeader childId={childId} />
      <main className={styles.narrow}>
        <section className={`${styles.card} ${styles.resultHero}`}>
          <CharacterCoach
            message={mastered ? RESULT_TEXT.coachMastered : RESULT_TEXT.coachTry}
            mood="celebrate"
          />
          {mastered ? <RewardBurst unit={unit} /> : null}
          <h1 className={styles.pageTitle}>
            {mastered
              ? <><RubyAuto text={unit} readingMode="kanji_with_ruby" />{RESULT_TEXT.masteredTitleSuffix}</>
              : RESULT_TEXT.triedTitle}
          </h1>
          <p className={styles.score}>{score}/5</p>
          <div className={styles.resultGrid}>
            <div className={styles.stat}>
              <Award size={25} />
              <strong>{mastered ? RESULT_TEXT.statMastered : RESULT_TEXT.statPracticing}</strong>
              <span><RubyAuto text={unit} readingMode="kanji_with_ruby" /></span>
            </div>
            <div className={styles.stat}>
              <Target size={25} /><strong>{Number(score) * 20}%</strong><span>{RESULT_TEXT.correctLabel}</span>
            </div>
            <div className={styles.stat}>
              <CalendarCheck size={25} /><strong>{RESULT_TEXT.streakValue}</strong><span>{RESULT_TEXT.streakLabel}</span>
            </div>
          </div>
          <p className={styles.lead}>{RESULT_TEXT.lead}</p>
          <div className={`${styles.hintActions} ${styles.resultActions}`}>
            {nextHref && (
              <Link className={styles.nextProblemButton} href={nextHref as Route}>
                {isLastInUnit ? "つぎの ステージへ すすむ 🚀" : "🚀 つぎの もんだいへ すすむ！"}
              </Link>
            )}
            <Link className={styles.primaryButton} href={homeLink as Route}>{RESULT_TEXT.home}</Link>
            <Link className={styles.secondaryButton} href={retryHref as Route}>{RESULT_TEXT.retry}</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
