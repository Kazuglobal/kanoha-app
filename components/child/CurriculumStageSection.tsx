"use client";

import Link from "next/link";
import type { Route } from "next";
import styles from "@/components/kanoha.module.css";
import { RubyAuto } from "@/components/child/RubyText";
import { getCurriculumStages } from "@/lib/curriculum/curriculumBank";
import { SUBJECT_CONFIG, type Subject } from "@/lib/curriculum/subjects";

interface CurriculumStageSectionProps {
  currentSubject: Subject;
  childId?: string;
  readingMode?: "kanji_with_ruby" | "hiragana";
  /** いちどでも正解した問題バンクの id(ログイン中のみ) */
  solvedIds?: readonly string[];
}

export function CurriculumStageSection({
  currentSubject,
  childId,
  readingMode = "kanji_with_ruby",
  solvedIds = [],
}: CurriculumStageSectionProps) {
  const stages = getCurriculumStages(currentSubject);
  const solved = new Set(solvedIds);

  return (
    <section className={styles.stageMapSection} aria-label="カリキュラムステージ">
      <div className={styles.stageMapHeader}>
        <div>
          <h2 className={styles.stageMapTitle}>
            <span>🗺️</span>
            <span>カリキュラム ステージマップ</span>
          </h2>
          <p className={styles.stageMapSubtitle}>
            {`すきな たんげんを えらんで、${SUBJECT_CONFIG[currentSubject].child}を どんどん すすめよう！`}
          </p>
        </div>
      </div>

      <div className={styles.stageGrid}>
        {stages.map((stage) => {
          const solvedCount = stage.problemIds.filter((id) => solved.has(id)).length;
          const cleared = solvedCount === stage.problemCount;
          // つづきから: まだ正解していない最初の問題へ
          const nextId = stage.problemIds.find((id) => !solved.has(id)) ?? stage.firstProblemId;
          const href = `/child/problem/${nextId}${childId ? `?childId=${childId}` : ""}`;

          return (
            <Link
              key={stage.id}
              href={href as Route}
              className={`${styles.stageCard} ${cleared ? styles.stageCardCleared : ""}`}
              title={`${stage.title}をはじめよう`}
            >
              <div className={styles.stageCardTop}>
                <span className={styles.stageCardEmoji} role="img" aria-label={stage.title}>
                  {stage.emoji}
                </span>
                <span
                  className={cleared ? styles.stageCardBadgeCleared : styles.stageCardBadge}
                  aria-label={`${stage.problemCount}もん中 ${solvedCount}もん できた`}
                >
                  {cleared ? "⭐ クリア" : solvedCount > 0 ? `${solvedCount}/${stage.problemCount}` : `${stage.problemCount}もん`}
                </span>
              </div>

              <h3 className={styles.stageCardTitle}>
                <RubyAuto text={stage.title} readingMode={readingMode} />
              </h3>

              <p className={styles.stageCardDesc}>{stage.description}</p>

              <div className={styles.stageCardAction}>
                {cleared ? "もういちど ▶" : solvedCount > 0 ? "つづきから ▶" : "べんきょうする ▶"}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
