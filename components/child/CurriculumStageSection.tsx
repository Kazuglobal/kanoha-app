"use client";

import Link from "next/link";
import type { Route } from "next";
import styles from "@/components/kanoha.module.css";
import { RubyAuto } from "@/components/child/RubyText";
import { getCurriculumStages } from "@/lib/curriculum/curriculumBank";
import type { Subject } from "@/lib/curriculum/subjects";

interface CurriculumStageSectionProps {
  currentSubject: Subject;
  childId?: string;
  readingMode?: "kanji_with_ruby" | "hiragana";
}

export function CurriculumStageSection({
  currentSubject,
  childId,
  readingMode = "kanji_with_ruby",
}: CurriculumStageSectionProps) {
  const stages = getCurriculumStages(currentSubject);
  const isJapanese = currentSubject === "japanese";

  return (
    <section className={styles.stageMapSection} aria-label="カリキュラムステージ">
      <div className={styles.stageMapHeader}>
        <div>
          <h2 className={styles.stageMapTitle}>
            <span>🗺️</span>
            <span>カリキュラム ステージマップ</span>
          </h2>
          <p className={styles.stageMapSubtitle}>
            {isJapanese
              ? "すきな たんげんを えらんで、こくごを どんどん すすめよう！"
              : "すきな たんげんを えらんで、さんすうを どんどん すすめよう！"}
          </p>
        </div>
      </div>

      <div className={styles.stageGrid}>
        {stages.map((stage) => {
          const href = `/child/problem/${stage.firstProblemId}${
            childId ? `?childId=${childId}` : ""
          }`;

          return (
            <Link
              key={stage.id}
              href={href as Route}
              className={styles.stageCard}
              title={`${stage.title}をはじめよう`}
            >
              <div className={styles.stageCardTop}>
                <span className={styles.stageCardEmoji} role="img" aria-label={stage.title}>
                  {stage.emoji}
                </span>
                <span className={styles.stageCardBadge}>{stage.problemCount}もん</span>
              </div>

              <h3 className={styles.stageCardTitle}>
                <RubyAuto text={stage.title} readingMode={readingMode} />
              </h3>

              <p className={styles.stageCardDesc}>{stage.description}</p>

              <div className={styles.stageCardAction}>
                べんきょうする ▶
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
